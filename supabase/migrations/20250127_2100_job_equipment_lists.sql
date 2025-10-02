-- Migration: Create job equipment lists and demo data
-- Feature: 007-mvp-intent-driven
-- Purpose: Allow editable equipment lists per job with CRUD operations

-- Create table for job equipment requirements
CREATE TABLE IF NOT EXISTS job_equipment_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  equipment_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT CHECK (category IN ('primary', 'safety', 'support', 'materials')),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT unique_job_equipment UNIQUE (job_id, equipment_name),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Add RLS
ALTER TABLE job_equipment_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "job_equipment_tenant_isolation" ON job_equipment_requirements
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id')::UUID 
    OR 
    current_setting('app.bypass_rls', true)::BOOLEAN
  );

CREATE POLICY "job_equipment_crew_read" ON job_equipment_requirements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_assignments ja 
      WHERE ja.job_id = job_equipment_requirements.job_id 
      AND ja.crew_id = auth.uid()
    )
  );

CREATE POLICY "job_equipment_supervisor_write" ON job_equipment_requirements
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'user_metadata'::TEXT)::JSONB ->> 'role' IN ('supervisor', 'admin'))
  WITH CHECK ((auth.jwt() ->> 'user_metadata'::TEXT)::JSONB ->> 'role' IN ('supervisor', 'admin'));

-- Add indexes
CREATE INDEX idx_job_equipment_job_id ON job_equipment_requirements(job_id);
CREATE INDEX idx_job_equipment_tenant_id ON job_equipment_requirements(tenant_id);
CREATE INDEX idx_job_equipment_category ON job_equipment_requirements(category);
CREATE INDEX idx_job_equipment_verified ON job_equipment_requirements(is_verified) WHERE is_verified = TRUE;

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at_job_equipment
BEFORE UPDATE ON job_equipment_requirements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add equipment list column to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS equipment_list_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS equipment_list_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS equipment_list_locked_by UUID REFERENCES auth.users(id);

-- Comments
COMMENT ON TABLE job_equipment_requirements IS 'Equipment requirements for each job with verification tracking';
COMMENT ON COLUMN job_equipment_requirements.category IS 'Equipment category: primary (mowers, trimmers), safety (gear, cones), support (fuel, tools), materials';
COMMENT ON COLUMN job_equipment_requirements.is_verified IS 'Whether this equipment has been verified as loaded';
COMMENT ON COLUMN job_equipment_requirements.display_order IS 'Order to display items in UI';
COMMENT ON COLUMN jobs.equipment_list_locked IS 'Prevent changes to equipment list once job is started';

-- Function to copy equipment from template (for future use)
CREATE OR REPLACE FUNCTION copy_equipment_from_template(
  p_job_id UUID,
  p_template_id UUID,
  p_tenant_id UUID
) RETURNS VOID AS $$
DECLARE
  v_equipment_count INT;
BEGIN
  -- Copy standard equipment list from template
  INSERT INTO job_equipment_requirements (
    tenant_id, job_id, equipment_name, quantity, 
    category, is_required, display_order
  )
  SELECT 
    p_tenant_id, 
    p_job_id, 
    equipment_name, 
    quantity, 
    category, 
    is_required, 
    display_order
  FROM job_template_equipment
  WHERE template_id = p_template_id;
  
  GET DIAGNOSTICS v_equipment_count = ROW_COUNT;
  
  RAISE NOTICE 'Copied % equipment items from template', v_equipment_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert demo equipment for existing jobs
DO $$
DECLARE
  demo_tenant_id UUID := '11111111-1111-1111-1111-111111111111';
  job_record RECORD;
BEGIN
  -- Check if we're in demo mode
  IF EXISTS (SELECT 1 FROM companies WHERE id = demo_tenant_id) THEN
    -- Job 1: Johnson Family - Standard lawn service
    IF EXISTS (SELECT 1 FROM jobs WHERE id = '00000000-0000-0000-0001-000000000001') THEN
      INSERT INTO job_equipment_requirements (tenant_id, job_id, equipment_name, quantity, category, is_required, display_order) VALUES
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'Walk-Behind Mower', 1, 'primary', true, 1),
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'String Trimmer', 1, 'primary', true, 2),
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'Leaf Blower', 1, 'primary', true, 3),
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'Safety Glasses', 1, 'safety', true, 4),
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'Hearing Protection', 1, 'safety', true, 5),
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'Gas Can (2 gal)', 1, 'support', true, 6),
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'Hand Tools Bag', 1, 'support', false, 7),
        (demo_tenant_id, '00000000-0000-0000-0001-000000000001', 'Trash Bags', 10, 'materials', false, 8)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Job 2: Smith Residence - Full service with edging
    IF EXISTS (SELECT 1 FROM jobs WHERE id = '00000000-0000-0000-0002-000000000002') THEN
      INSERT INTO job_equipment_requirements (tenant_id, job_id, equipment_name, quantity, category, is_required, display_order) VALUES
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'Zero-Turn Mower', 1, 'primary', true, 1),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'String Trimmer', 1, 'primary', true, 2),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'Edger', 1, 'primary', true, 3),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'Backpack Blower', 1, 'primary', true, 4),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'Safety Kit', 1, 'safety', true, 5),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'Gas Can (5 gal)', 1, 'support', true, 6),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', '2-Cycle Oil', 2, 'support', true, 7),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'Trimmer Line', 1, 'materials', false, 8),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'First Aid Kit', 1, 'safety', false, 9),
        (demo_tenant_id, '00000000-0000-0000-0002-000000000002', 'Water Cooler', 1, 'support', false, 10)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Job 3: Green Acres HOA - Commercial property
    IF EXISTS (SELECT 1 FROM jobs WHERE id = '00000000-0000-0000-0003-000000000003') THEN
      INSERT INTO job_equipment_requirements (tenant_id, job_id, equipment_name, quantity, category, is_required, display_order) VALUES
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Commercial Mower (60")', 1, 'primary', true, 1),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Zero-Turn Mower', 1, 'primary', true, 2),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'String Trimmer', 2, 'primary', true, 3),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Edger', 2, 'primary', true, 4),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Backpack Blower', 2, 'primary', true, 5),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Safety Cones', 6, 'safety', true, 6),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Team Safety Gear', 2, 'safety', true, 7),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Gas Can (5 gal)', 2, 'support', true, 8),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', '2-Cycle Mix', 4, 'support', true, 9),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Trailer', 1, 'support', true, 10),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Hedge Trimmer', 1, 'primary', false, 11),
        (demo_tenant_id, '00000000-0000-0000-0003-000000000003', 'Mulch (bags)', 20, 'materials', false, 12)
      ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Inserted demo equipment requirements for existing jobs';
  END IF;
END $$;

-- Function to verify equipment item
CREATE OR REPLACE FUNCTION verify_equipment_item(
  p_job_id UUID,
  p_equipment_name TEXT,
  p_verified_by UUID DEFAULT auth.uid()
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE job_equipment_requirements
  SET 
    is_verified = TRUE,
    verified_at = NOW()
  WHERE job_id = p_job_id 
    AND equipment_name = p_equipment_name
    AND is_verified = FALSE;
    
  GET DIAGNOSTICS v_updated = FOUND;
  
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON job_equipment_requirements TO authenticated;
GRANT EXECUTE ON FUNCTION verify_equipment_item TO authenticated;
GRANT EXECUTE ON FUNCTION copy_equipment_from_template TO authenticated;