-- Migration: Create Unified Inventory Schema
-- Description: Consolidates equipment, inventory, tools, and materials into unified items table
-- Date: 2025-10-03
-- Feature: 009-codebase-cleanup-and-refactoring

-- 1. Create unified items table
CREATE TABLE IF NOT EXISTS items (
  -- Core Identity
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  -- Classification
  item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material', 'consumable', 'tool')),
  category TEXT NOT NULL,
  tracking_mode TEXT NOT NULL CHECK (tracking_mode IN ('individual', 'quantity', 'batch')),
  
  -- Basic Information  
  name TEXT NOT NULL,
  description TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  sku TEXT,
  barcode TEXT,
  
  -- Quantity Management (for quantity/batch tracked items)
  current_quantity DECIMAL(10,2) DEFAULT 0,
  unit_of_measure TEXT DEFAULT 'each',
  min_quantity DECIMAL(10,2),
  max_quantity DECIMAL(10,2),
  reorder_point DECIMAL(10,2),
  
  -- Location & Assignment
  current_location_id UUID,
  home_location_id UUID,
  assigned_to_user_id UUID,
  assigned_to_job_id UUID,
  
  -- Status & Condition
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired', 'lost', 'damaged')),
  condition TEXT CHECK (condition IN ('new', 'excellent', 'good', 'fair', 'poor')),
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  
  -- Financial
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  current_value DECIMAL(10,2),
  depreciation_method TEXT,
  
  -- Metadata & Extensibility
  attributes JSONB DEFAULT '{}',
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  
  -- Media
  primary_image_url TEXT,
  image_urls TEXT[],
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID,
  
  -- Unique constraints
  UNIQUE(tenant_id, serial_number),
  UNIQUE(tenant_id, sku),
  UNIQUE(tenant_id, barcode)
);

-- 2. Create indexes for performance
CREATE INDEX idx_items_tenant_type ON items(tenant_id, item_type);
CREATE INDEX idx_items_tenant_category ON items(tenant_id, category);
CREATE INDEX idx_items_tenant_status ON items(tenant_id, status);
CREATE INDEX idx_items_location ON items(current_location_id);
CREATE INDEX idx_items_assigned_job ON items(assigned_to_job_id) WHERE assigned_to_job_id IS NOT NULL;
CREATE INDEX idx_items_assigned_user ON items(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX idx_items_search ON items USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- 3. Create unified transaction table
CREATE TABLE IF NOT EXISTS item_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  -- Transaction Details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'check_in', 'check_out', 'transfer', 'adjustment',
    'purchase', 'sale', 'maintenance', 'disposal'
  )),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  
  -- Movement Tracking
  from_location_id UUID,
  to_location_id UUID,
  from_user_id UUID,
  to_user_id UUID,
  
  -- Context
  job_id UUID,
  purchase_order_id UUID,
  work_order_id UUID,
  
  -- Details
  cost DECIMAL(10,2),
  notes TEXT,
  reason TEXT,
  
  -- Voice/Vision Integration
  voice_session_id UUID,
  detection_session_id UUID,
  confidence_score DECIMAL(3,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

-- 4. Create indexes for transaction queries
CREATE INDEX idx_transactions_tenant_item ON item_transactions(tenant_id, item_id);
CREATE INDEX idx_transactions_type_date ON item_transactions(transaction_type, created_at DESC);
CREATE INDEX idx_transactions_job ON item_transactions(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_transactions_voice ON item_transactions(voice_session_id) WHERE voice_session_id IS NOT NULL;

-- 5. RLS Policies for items table
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_tenant_isolation" ON items
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "items_admin_access" ON items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.tenant_id = items.tenant_id
    )
  );

-- 6. RLS Policies for item_transactions table
ALTER TABLE item_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_tenant_isolation" ON item_transactions
  FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "transactions_admin_access" ON item_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
      AND user_roles.tenant_id = item_transactions.tenant_id
    )
  );

-- 7. Create helper function for quantity adjustments
CREATE OR REPLACE FUNCTION adjust_item_quantity(
  p_item_id UUID,
  p_adjustment DECIMAL,
  p_transaction_type TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_current_quantity DECIMAL;
  v_tenant_id UUID;
BEGIN
  -- Get current quantity and tenant
  SELECT current_quantity, tenant_id 
  INTO v_current_quantity, v_tenant_id
  FROM items 
  WHERE id = p_item_id;

  -- Update quantity
  UPDATE items 
  SET 
    current_quantity = current_quantity + p_adjustment,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_item_id;

  -- Record transaction
  INSERT INTO item_transactions (
    tenant_id,
    transaction_type,
    item_id,
    quantity,
    notes,
    created_by
  ) VALUES (
    v_tenant_id,
    p_transaction_type,
    p_item_id,
    p_adjustment,
    p_notes,
    p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Create view for item availability
CREATE OR REPLACE VIEW item_availability AS
SELECT 
  i.*,
  CASE 
    WHEN i.tracking_mode = 'individual' THEN 
      CASE WHEN i.assigned_to_job_id IS NULL THEN 'available' ELSE 'assigned' END
    WHEN i.tracking_mode IN ('quantity', 'batch') THEN
      CASE 
        WHEN i.current_quantity > 0 THEN 'available'
        ELSE 'out_of_stock'
      END
  END as availability_status
FROM items i;

-- 9. Grant permissions
GRANT ALL ON items TO authenticated;
GRANT ALL ON item_transactions TO authenticated;
GRANT ALL ON item_availability TO authenticated;