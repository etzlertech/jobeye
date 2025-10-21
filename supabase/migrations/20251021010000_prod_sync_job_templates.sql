-- Migration: Add job_templates table and FK constraint
-- Purpose: Fix PGRST200 error in production by creating missing job_templates table
-- Date: 2025-10-21

-- Create job_templates table (idempotent)
CREATE TABLE IF NOT EXISTS job_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  estimated_duration INTEGER, -- in minutes
  default_priority job_priority DEFAULT 'normal',
  required_skills TEXT[],
  required_equipment_types TEXT[],
  default_materials JSONB DEFAULT '[]'::jsonb,
  checklist_items JSONB DEFAULT '[]'::jsonb,
  voice_shortcuts TEXT[],
  voice_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, template_code)
);

-- Add FK constraint from jobs.template_id to job_templates.id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_template_id_fkey'
    AND table_name = 'jobs'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_template_id_fkey
      FOREIGN KEY (template_id)
      REFERENCES job_templates(id);
  END IF;
END $$;

-- Add updated_at trigger (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_job_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_job_templates_updated_at
    BEFORE UPDATE ON job_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their tenant's job templates" ON job_templates;
DROP POLICY IF EXISTS "Users can manage their tenant's job templates" ON job_templates;

-- Create RLS policies for job_templates
CREATE POLICY "Users can view their tenant's job templates" ON job_templates
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's job templates" ON job_templates
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Refresh schema cache by touching pg_catalog
-- This forces PostgREST to rediscover the new FK relationship
NOTIFY pgrst, 'reload schema';
