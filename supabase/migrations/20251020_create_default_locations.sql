-- Migration: Create locations table and seed default locations for item_transactions
-- Created: 2025-10-20
-- Description: Creates locations table for tracking item storage locations
--              Seeds default yard/warehouse for each tenant
--              Provides helper function for transaction logging

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK (location_type IN ('yard', 'warehouse', 'truck', 'job_site', 'other')),
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
CREATE POLICY "tenant_isolation" ON locations
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_locations_tenant_default
  ON locations(tenant_id, is_default)
  WHERE is_default = true;

-- Seed default yard/warehouse location for each tenant
DO $$
DECLARE
  v_tenant RECORD;
  v_location_id UUID;
BEGIN
  FOR v_tenant IN SELECT id, name FROM tenants LOOP
    -- Check if default location already exists
    SELECT id INTO v_location_id
    FROM locations
    WHERE tenant_id = v_tenant.id
      AND is_default = true;

    -- Create if not exists
    IF v_location_id IS NULL THEN
      INSERT INTO locations (
        tenant_id,
        name,
        location_type,
        is_default,
        metadata
      )
      VALUES (
        v_tenant.id,
        'Default Yard/Warehouse',
        'yard',
        true,
        jsonb_build_object(
          'created_by', 'migration_20251020',
          'purpose', 'default_location_for_item_transactions',
          'description', 'Auto-created default storage location for equipment and materials'
        )
      )
      RETURNING id INTO v_location_id;

      RAISE NOTICE 'Created default location % for tenant %', v_location_id, v_tenant.name;
    ELSE
      RAISE NOTICE 'Default location already exists for tenant %', v_tenant.name;
    END IF;
  END LOOP;
END $$;

-- Create helper function to get tenant's default location
CREATE OR REPLACE FUNCTION get_default_location_id(p_tenant_id UUID)
RETURNS UUID AS $$
  SELECT id
  FROM locations
  WHERE tenant_id = p_tenant_id
    AND is_default = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_default_location_id IS
  'Returns the default yard/warehouse location ID for a tenant, used by item_transactions for from_location_id';

COMMENT ON TABLE locations IS 'Storage locations for tracking item movements (yards, warehouses, trucks, job sites)';
COMMENT ON COLUMN locations.is_default IS 'Default location for item transactions when from_location_id is needed';
