-- =====================================================================
-- Migration: 050_inventory_vision_extend.sql
-- Feature: 004-voice-vision-inventory
-- Purpose: Create inventory management tables with vision integration
-- Date: 2025-09-30
-- Style: Idempotent single-statement migrations (Constitution RULE 1)
-- =====================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================================
-- ENUMS
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE item_type AS ENUM ('equipment', 'material');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE item_status AS ENUM ('active', 'maintenance', 'repair', 'retired', 'lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tracking_mode AS ENUM ('individual', 'quantity');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE container_type AS ENUM ('truck', 'trailer', 'storage_bin', 'warehouse', 'building', 'toolbox');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('check_out', 'check_in', 'transfer', 'register', 'purchase', 'usage', 'decommission', 'audit', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_method AS ENUM ('manual', 'qr_scan', 'photo_vision', 'voice');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ocr_method AS ENUM ('tesseract', 'gpt4_vision');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE filter_action AS ENUM ('always_exclude', 'always_include', 'ask');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE relationship_type AS ENUM ('accessory', 'part', 'alternative', 'replacement', 'upgrade');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================================
-- TABLE 1: inventory_items
-- =====================================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type item_type NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  status item_status NOT NULL DEFAULT 'active',
  current_location_id UUID,
  specifications JSONB DEFAULT '{}',
  attributes JSONB DEFAULT '{}',
  images JSONB[] NOT NULL DEFAULT '{}',
  tracking_mode tracking_mode NOT NULL,
  current_quantity INTEGER,
  reorder_level INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT equipment_no_quantity CHECK (type = 'equipment' AND tracking_mode = 'individual' AND current_quantity IS NULL OR type != 'equipment'),
  CONSTRAINT material_has_quantity CHECK (type = 'material' AND tracking_mode = 'quantity' AND current_quantity IS NOT NULL OR type != 'material')
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_company_status ON inventory_items(company_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_company_category ON inventory_items(company_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(current_location_id);

-- RLS Policies
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inventory_items;
CREATE POLICY tenant_isolation ON inventory_items
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- =====================================================================
-- TABLE 2: containers
-- =====================================================================

CREATE TABLE IF NOT EXISTS containers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type container_type NOT NULL,
  name TEXT NOT NULL,
  identifier TEXT,
  capacity INTEGER,
  parent_container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  default_location_gps GEOMETRY(POINT, 4326),
  photo_url TEXT,
  voice_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_containers_company_active ON containers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_containers_company_type ON containers(company_id, type);
CREATE INDEX IF NOT EXISTS idx_containers_parent ON containers(parent_container_id);

-- Add FK constraint for inventory_items.current_location_id after containers table exists
DO $$ BEGIN
  ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_items_location
    FOREIGN KEY (current_location_id) REFERENCES containers(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON containers;
CREATE POLICY tenant_isolation ON containers
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- =====================================================================
-- TABLE 3: container_assignments
-- =====================================================================

CREATE TABLE IF NOT EXISTS container_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ,
  job_id UUID,
  status assignment_status NOT NULL DEFAULT 'active',
  CONSTRAINT checkout_after_checkin CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);

CREATE INDEX IF NOT EXISTS idx_container_assignments_item_active ON container_assignments(item_id, checked_out_at);
CREATE INDEX IF NOT EXISTS idx_container_assignments_container_status ON container_assignments(container_id, status);
CREATE INDEX IF NOT EXISTS idx_container_assignments_job ON container_assignments(job_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_container_assignments_active_unique
  ON container_assignments(container_id, item_id)
  WHERE checked_out_at IS NULL;

-- RLS Policies
ALTER TABLE container_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON container_assignments;
CREATE POLICY tenant_isolation ON container_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM containers
      WHERE containers.id = container_assignments.container_id
        AND containers.company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );

-- =====================================================================
-- TABLE 4: inventory_transactions
-- =====================================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  item_ids UUID[] NOT NULL,
  quantity INTEGER,
  source_container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  destination_container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  job_id UUID,
  performer_id UUID NOT NULL,
  verification_method verification_method NOT NULL,
  photo_evidence_url TEXT,
  voice_session_id UUID,
  voice_transcript TEXT,
  notes TEXT,
  cost_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT item_ids_not_empty CHECK (array_length(item_ids, 1) > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_company_type_date ON inventory_transactions(company_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_performer ON inventory_transactions(performer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_job ON inventory_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_ids ON inventory_transactions USING GIN(item_ids);

-- RLS Policies
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inventory_transactions;
CREATE POLICY tenant_isolation ON inventory_transactions
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- =====================================================================
-- TABLE 5: purchase_receipts
-- =====================================================================

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  vendor_location TEXT,
  purchase_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  line_items JSONB[] NOT NULL,
  receipt_photo_url TEXT NOT NULL,
  ocr_extracted_data JSONB NOT NULL,
  ocr_confidence_scores JSONB,
  ocr_method ocr_method NOT NULL,
  po_reference TEXT,
  assigned_job_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  CONSTRAINT line_items_not_empty CHECK (array_length(line_items, 1) > 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_company_date ON purchase_receipts(company_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_vendor ON purchase_receipts(vendor_name);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_job ON purchase_receipts(assigned_job_id);

-- RLS Policies
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON purchase_receipts;
CREATE POLICY tenant_isolation ON purchase_receipts
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- =====================================================================
-- TABLE 6: training_data_records
-- =====================================================================

CREATE TABLE IF NOT EXISTS training_data_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  original_photo_url TEXT NOT NULL,
  yolo_detections JSONB NOT NULL,
  vlm_analysis JSONB,
  user_selections INTEGER[] NOT NULL,
  user_corrections JSONB[] NOT NULL DEFAULT '{}',
  user_exclusions JSONB[] NOT NULL DEFAULT '{}',
  context JSONB NOT NULL,
  voice_transcript TEXT,
  quality_metrics JSONB,
  created_record_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT created_records_not_empty CHECK (array_length(created_record_ids, 1) > 0)
);

CREATE INDEX IF NOT EXISTS idx_training_data_company_date ON training_data_records(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_data_context ON training_data_records USING GIN(context);
CREATE INDEX IF NOT EXISTS idx_training_data_vlm_usage ON training_data_records(created_at) WHERE vlm_analysis IS NOT NULL;

-- RLS Policies
ALTER TABLE training_data_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON training_data_records;
CREATE POLICY tenant_isolation ON training_data_records
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- =====================================================================
-- TABLE 7: vision_training_annotations
-- =====================================================================

CREATE TABLE IF NOT EXISTS vision_training_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_record_id UUID NOT NULL REFERENCES training_data_records(id) ON DELETE CASCADE,
  item_detection_number INTEGER NOT NULL,
  corrected_label TEXT NOT NULL,
  corrected_bbox JSONB NOT NULL,
  correction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_annotations_training_record ON vision_training_annotations(training_record_id);
CREATE INDEX IF NOT EXISTS idx_vision_annotations_label ON vision_training_annotations(corrected_label);

-- RLS Policies
ALTER TABLE vision_training_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON vision_training_annotations;
CREATE POLICY tenant_isolation ON vision_training_annotations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM training_data_records
      WHERE training_data_records.id = vision_training_annotations.training_record_id
        AND training_data_records.company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );

-- =====================================================================
-- TABLE 8: detection_confidence_thresholds
-- =====================================================================

CREATE TABLE IF NOT EXISTS detection_confidence_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  local_confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  max_daily_vlm_requests INTEGER NOT NULL DEFAULT 100,
  daily_cost_budget_cap DECIMAL(6,2) NOT NULL DEFAULT 10.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT threshold_range CHECK (local_confidence_threshold >= 0.0 AND local_confidence_threshold <= 1.0),
  CONSTRAINT budget_positive CHECK (daily_cost_budget_cap > 0)
);

-- RLS Policies
ALTER TABLE detection_confidence_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON detection_confidence_thresholds;
CREATE POLICY tenant_isolation ON detection_confidence_thresholds
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- =====================================================================
-- TABLE 9: background_filter_preferences
-- =====================================================================

CREATE TABLE IF NOT EXISTS background_filter_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID,
  object_label TEXT NOT NULL,
  action filter_action NOT NULL,
  context_filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_background_filter_unique
  ON background_filter_preferences(company_id, COALESCE(user_id::text, 'NULL'), object_label, COALESCE(context_filters::text, 'NULL'));

CREATE INDEX IF NOT EXISTS idx_background_filter_company_action ON background_filter_preferences(company_id, action);

-- RLS Policies
ALTER TABLE background_filter_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON background_filter_preferences;
CREATE POLICY tenant_isolation ON background_filter_preferences
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- =====================================================================
-- TABLE 10: item_relationships
-- =====================================================================

CREATE TABLE IF NOT EXISTS item_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  related_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_reference CHECK (parent_item_id != related_item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_relationships_parent ON item_relationships(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_item_relationships_related ON item_relationships(related_item_id);

-- RLS Policies
ALTER TABLE item_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON item_relationships;
CREATE POLICY tenant_isolation ON item_relationships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_items
      WHERE inventory_items.id = item_relationships.parent_item_id
        AND inventory_items.company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Trigger 1: Update item location when container assignments change
CREATE OR REPLACE FUNCTION update_item_location()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active') THEN
    UPDATE inventory_items
    SET current_location_id = NEW.container_id,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.checked_out_at IS NOT NULL THEN
    UPDATE inventory_items
    SET current_location_id = NULL,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_item_location_trigger ON container_assignments;
CREATE TRIGGER update_item_location_trigger
AFTER INSERT OR UPDATE ON container_assignments
FOR EACH ROW EXECUTE FUNCTION update_item_location();

-- Trigger 2: Prevent circular container hierarchy
CREATE OR REPLACE FUNCTION check_container_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  current_id UUID;
  depth INTEGER := 0;
  max_depth INTEGER := 10;
BEGIN
  IF NEW.parent_container_id IS NULL THEN
    RETURN NEW;
  END IF;

  current_id := NEW.parent_container_id;
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular container hierarchy detected';
    END IF;

    SELECT parent_container_id INTO current_id
    FROM containers
    WHERE id = current_id;

    depth := depth + 1;
  END LOOP;

  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Container hierarchy too deep (max 10 levels)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_circular_hierarchy_trigger ON containers;
CREATE TRIGGER prevent_circular_hierarchy_trigger
BEFORE INSERT OR UPDATE ON containers
FOR EACH ROW EXECUTE FUNCTION check_container_hierarchy();

-- =====================================================================
-- UPDATED_AT TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_containers_updated_at ON containers;
CREATE TRIGGER update_containers_updated_at
BEFORE UPDATE ON containers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_detection_thresholds_updated_at ON detection_confidence_thresholds;
CREATE TRIGGER update_detection_thresholds_updated_at
BEFORE UPDATE ON detection_confidence_thresholds
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_background_filter_updated_at ON background_filter_preferences;
CREATE TRIGGER update_background_filter_updated_at
BEFORE UPDATE ON background_filter_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================