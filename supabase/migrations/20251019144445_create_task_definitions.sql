-- Migration: 20251019144445_create_task_definitions.sql
-- Purpose: Create task_definitions table for reusable task library
-- Feature: 014-add-task-management
-- Dependencies: tenants table, auth.users, update_updated_at_column() function

-- Create task_definitions table
CREATE TABLE IF NOT EXISTS task_definitions (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (constitutional requirement)
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Core fields
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) >= 1 AND char_length(description) <= 2000),
  acceptance_criteria TEXT CHECK (acceptance_criteria IS NULL OR char_length(acceptance_criteria) <= 2000),

  -- Configuration flags
  requires_photo_verification BOOLEAN NOT NULL DEFAULT false,
  requires_supervisor_approval BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT true,

  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT task_definitions_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT task_definitions_description_not_empty CHECK (char_length(trim(description)) > 0)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_task_definitions_tenant
  ON task_definitions(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_definitions_tenant_name
  ON task_definitions(tenant_id, name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_definitions_created_by
  ON task_definitions(created_by) WHERE deleted_at IS NULL;

-- RLS Policy (constitutional requirement - correct JWT path)
ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_task_definitions" ON task_definitions
  FOR ALL USING (
    tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata' ->> 'tenant_id'
    )
  );

-- Auto-update updated_at timestamp
CREATE TRIGGER update_task_definitions_updated_at
  BEFORE UPDATE ON task_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE task_definitions IS 'Reusable task definitions for building task templates';
COMMENT ON COLUMN task_definitions.tenant_id IS 'Tenant ID for multi-tenancy isolation';
COMMENT ON COLUMN task_definitions.name IS 'Task name (1-255 characters)';
COMMENT ON COLUMN task_definitions.description IS 'Detailed task description (1-2000 characters)';
COMMENT ON COLUMN task_definitions.acceptance_criteria IS 'Optional success criteria (max 2000 characters)';
COMMENT ON COLUMN task_definitions.requires_photo_verification IS 'Whether photo verification is required';
COMMENT ON COLUMN task_definitions.requires_supervisor_approval IS 'Whether supervisor approval is required';
COMMENT ON COLUMN task_definitions.is_required IS 'Whether task is required (vs optional)';
COMMENT ON COLUMN task_definitions.created_by IS 'User who created this definition';
COMMENT ON COLUMN task_definitions.deleted_at IS 'Soft delete timestamp (NULL = active)';
