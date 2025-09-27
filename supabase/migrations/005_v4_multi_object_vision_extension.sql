-- Migration: 005_v4_multi_object_vision_extension.sql
-- Purpose: Add container management and multi-object vision support
-- Dependencies: Previous JobEye migrations

-- Create enum types for containers
DO $$ 
BEGIN
  -- Create container_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'container_type') THEN
    CREATE TYPE container_type AS ENUM ('truck', 'van', 'trailer', 'storage_bin', 'ground');
  END IF;
  
  -- Create container_color if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'container_color') THEN
    CREATE TYPE container_color AS ENUM ('red', 'black', 'white', 'blue', 'green', 'yellow', 'gray', 'orange', 'silver', 'other');
  END IF;
END $$;

-- Containers table
CREATE TABLE IF NOT EXISTS containers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  container_type container_type NOT NULL,
  identifier VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color container_color,
  capacity_info JSONB,
  primary_image_url TEXT,
  additional_image_urls TEXT[],
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT container_identifier_unique UNIQUE(company_id, identifier),
  CONSTRAINT container_identifier_format CHECK (identifier ~ '^[A-Z0-9-]+$')
);

-- Reference images for inventory items
CREATE TABLE IF NOT EXISTS inventory_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material')),
  item_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  angle TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job checklist items with container assignments
CREATE TABLE IF NOT EXISTS job_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sequence_number INT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material')),
  item_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  quantity INT DEFAULT 1,
  container_id UUID REFERENCES containers(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'loaded', 'verified', 'missing')),
  vlm_prompt TEXT,
  acceptance_criteria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT job_checklist_sequence_unique UNIQUE(job_id, sequence_number)
);

-- Multi-object vision verifications
CREATE TABLE IF NOT EXISTS load_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  
  -- Detected containers
  detected_containers JSONB DEFAULT '[]'::jsonb,
  /* Structure:
  [{
    container_id: string (nullable),
    container_type: string,
    color: string,
    identifier: string,
    confidence: number,
    bounding_box: {x, y, width, height}
  }]
  */
  
  -- Detected items with container associations  
  detected_items JSONB DEFAULT '[]'::jsonb,
  /* Structure:
  [{
    item_type: 'equipment' | 'material',
    item_id: string (nullable),
    item_name: string,
    container_id: string (nullable),
    confidence: number,
    bounding_box: {x, y, width, height},
    attributes: {}
  }]
  */
  
  -- Verification results
  verified_checklist_items UUID[],
  missing_items UUID[],
  unexpected_items JSONB,
  
  tokens_used INT,
  cost_usd NUMERIC(18,6),
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add default container to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS default_container_id UUID REFERENCES containers(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_containers_company_active ON containers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_containers_default ON containers(company_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_inventory_images_item ON inventory_images(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_job ON job_checklist_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checklist_items_status ON job_checklist_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_load_verifications_job ON load_verifications(job_id);

-- Updated-at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_containers
BEFORE UPDATE ON containers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_job_checklist_items
BEFORE UPDATE ON job_checklist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS policies

-- Enable RLS on new tables
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_verifications ENABLE ROW LEVEL SECURITY;

-- Containers: company isolation
CREATE POLICY containers_company_isolation ON containers
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Inventory images: company isolation
CREATE POLICY inventory_images_company_isolation ON inventory_images
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Job checklist items: access via job
CREATE POLICY job_checklist_items_company_isolation ON job_checklist_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN users u ON u.id = auth.uid()
    WHERE j.id = job_checklist_items.job_id 
    AND j.company_id = u.company_id
  )
);

-- Load verifications: access via job
CREATE POLICY load_verifications_company_isolation ON load_verifications
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN users u ON u.id = auth.uid()
    WHERE j.id = load_verifications.job_id 
    AND j.company_id = u.company_id
  )
);

-- Insert some default containers for testing
DO $$
DECLARE
  test_company_id UUID;
BEGIN
  -- Get first company for testing (if exists)
  SELECT id INTO test_company_id FROM companies LIMIT 1;
  
  IF test_company_id IS NOT NULL THEN
    -- Insert default containers if they don't exist
    INSERT INTO containers (company_id, container_type, identifier, name, color, is_default, capacity_info)
    VALUES 
      (test_company_id, 'truck', 'VH-TKR', 'Red Truck', 'red', true, '{"itemLimit": 20}'::jsonb),
      (test_company_id, 'van', 'VH-VN1', 'White Van #1', 'white', false, '{"itemLimit": 15}'::jsonb),
      (test_company_id, 'trailer', 'TR-DU12R', 'Red Dump Trailer', 'red', false, '{"itemLimit": 30}'::jsonb),
      (test_company_id, 'trailer', 'TR-LB16A', 'Black Lowboy Trailer', 'black', false, '{"itemLimit": 40}'::jsonb)
    ON CONFLICT (company_id, identifier) DO NOTHING;
  END IF;
END $$;