-- Migration: Add Task Item Associations
-- Feature: 015-task-item-association
-- Date: 2025-10-19
-- Description: Create tables and supporting infrastructure for associating items/kits
--              with task template items and workflow tasks (job instances).
--
-- Tables Created:
--   1. task_template_item_associations - Links template items to required items/kits
--   2. workflow_task_item_associations - Links workflow tasks to items/kits with status
--
-- Dependencies:
--   - task_templates table (existing)
--   - task_template_items table (existing)
--   - workflow_tasks table (existing)
--   - items table (existing)
--   - kits table (existing)
--
-- Rollback:
--   See end of file for DROP statements

-- ==============================================================================
-- T001: Create task_item_status ENUM
-- ==============================================================================

-- Status values for workflow task item associations (runtime tracking)
-- pending: Association created, item not yet loaded
-- loaded: Worker marked item as loaded
-- verified: Supervisor confirmed item is loaded
-- missing: Item not available (may block task completion if required)
-- returned: Item returned to inventory after task completion

CREATE TYPE task_item_status AS ENUM (
  'pending',
  'loaded',
  'verified',
  'missing',
  'returned'
);

COMMENT ON TYPE task_item_status IS 'Status tracking for equipment loading workflow';

-- ==============================================================================
-- T002: Create task_template_item_associations table
-- ==============================================================================

-- Links task template items to required items or kits.
-- Template-level associations define default equipment requirements.
-- When a template is instantiated to a job, these associations are copied
-- to workflow_task_item_associations with status tracking.

CREATE TABLE IF NOT EXISTS task_template_item_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_item_id UUID NOT NULL REFERENCES task_template_items(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE RESTRICT,
  kit_id UUID REFERENCES kits(id) ON DELETE RESTRICT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_required BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Business rule: Exactly one of item_id or kit_id must be set (XOR)
  CONSTRAINT task_template_item_associations_item_or_kit_check CHECK (
    (item_id IS NOT NULL AND kit_id IS NULL) OR
    (item_id IS NULL AND kit_id IS NOT NULL)
  ),

  -- Prevent duplicate item associations for same template item
  CONSTRAINT task_template_item_associations_item_unique
    UNIQUE (template_item_id, item_id),

  -- Prevent duplicate kit associations for same template item
  CONSTRAINT task_template_item_associations_kit_unique
    UNIQUE (template_item_id, kit_id)
);

COMMENT ON TABLE task_template_item_associations IS 'Defines required items/kits for task template items';
COMMENT ON COLUMN task_template_item_associations.item_id IS 'Individual item reference (XOR with kit_id)';
COMMENT ON COLUMN task_template_item_associations.kit_id IS 'Item kit reference (XOR with item_id)';
COMMENT ON COLUMN task_template_item_associations.is_required IS 'If true, item must be loaded before task completion';
COMMENT ON COLUMN task_template_item_associations.notes IS 'Usage notes, special instructions';

-- ==============================================================================
-- T003: Create workflow_task_item_associations table
-- ==============================================================================

-- Links workflow tasks (job instances) to required items or kits with status tracking.
-- Runtime associations track which equipment is needed for specific tasks on actual jobs.
-- Can be inherited from templates (source_template_association_id) or custom additions.

CREATE TABLE IF NOT EXISTS workflow_task_item_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_task_id UUID NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE RESTRICT,
  kit_id UUID REFERENCES kits(id) ON DELETE RESTRICT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_required BOOLEAN NOT NULL DEFAULT true,
  status task_item_status NOT NULL DEFAULT 'pending',
  loaded_at TIMESTAMPTZ,
  loaded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  source_template_association_id UUID REFERENCES task_template_item_associations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Business rule: Exactly one of item_id or kit_id must be set (XOR)
  CONSTRAINT workflow_task_item_associations_item_or_kit_check CHECK (
    (item_id IS NOT NULL AND kit_id IS NULL) OR
    (item_id IS NULL AND kit_id IS NOT NULL)
  ),

  -- Business rule: loaded_at and loaded_by must be set together
  CONSTRAINT workflow_task_item_associations_loaded_check CHECK (
    (loaded_at IS NULL AND loaded_by IS NULL) OR
    (loaded_at IS NOT NULL AND loaded_by IS NOT NULL)
  ),

  -- Prevent duplicate item associations for same workflow task
  CONSTRAINT workflow_task_item_associations_item_unique
    UNIQUE (workflow_task_id, item_id),

  -- Prevent duplicate kit associations for same workflow task
  CONSTRAINT workflow_task_item_associations_kit_unique
    UNIQUE (workflow_task_id, kit_id)
);

COMMENT ON TABLE workflow_task_item_associations IS 'Tracks required items/kits for workflow tasks with loading status';
COMMENT ON COLUMN workflow_task_item_associations.status IS 'Equipment loading status (pending, loaded, verified, missing, returned)';
COMMENT ON COLUMN workflow_task_item_associations.loaded_at IS 'When item was marked as loaded';
COMMENT ON COLUMN workflow_task_item_associations.loaded_by IS 'User who marked item as loaded';
COMMENT ON COLUMN workflow_task_item_associations.source_template_association_id IS 'Link to template association if inherited from template';

-- ==============================================================================
-- T004: Create indexes for performance
-- ==============================================================================

-- Indexes for task_template_item_associations
-- These optimize queries when loading template associations

CREATE INDEX IF NOT EXISTS idx_template_item_assoc_template_item
  ON task_template_item_associations(template_item_id);

CREATE INDEX IF NOT EXISTS idx_template_item_assoc_item
  ON task_template_item_associations(item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_template_item_assoc_kit
  ON task_template_item_associations(kit_id)
  WHERE kit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_template_item_assoc_tenant
  ON task_template_item_associations(tenant_id);

-- Indexes for workflow_task_item_associations
-- These optimize queries when loading job equipment and checking status

CREATE INDEX IF NOT EXISTS idx_workflow_task_assoc_task
  ON workflow_task_item_associations(workflow_task_id);

CREATE INDEX IF NOT EXISTS idx_workflow_task_assoc_item
  ON workflow_task_item_associations(item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_task_assoc_kit
  ON workflow_task_item_associations(kit_id)
  WHERE kit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_task_assoc_source
  ON workflow_task_item_associations(source_template_association_id)
  WHERE source_template_association_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_task_assoc_status
  ON workflow_task_item_associations(status);

CREATE INDEX IF NOT EXISTS idx_workflow_task_assoc_tenant
  ON workflow_task_item_associations(tenant_id);

-- ==============================================================================
-- T005: Enable RLS and create policies
-- ==============================================================================

-- Enable RLS on task_template_item_associations
ALTER TABLE task_template_item_associations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on workflow_task_item_associations
ALTER TABLE workflow_task_item_associations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: tenant_isolation for task_template_item_associations
-- Users can only access associations from their own tenant
CREATE POLICY tenant_isolation ON task_template_item_associations
  FOR ALL
  TO public
  USING ((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text));

-- RLS Policy: tenant_isolation for workflow_task_item_associations
-- Users can only access associations from their own tenant
CREATE POLICY tenant_isolation ON workflow_task_item_associations
  FOR ALL
  TO public
  USING ((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text));

COMMENT ON POLICY tenant_isolation ON task_template_item_associations IS 'Enforce tenant isolation via JWT app_metadata';
COMMENT ON POLICY tenant_isolation ON workflow_task_item_associations IS 'Enforce tenant isolation via JWT app_metadata';

-- ==============================================================================
-- T005: Create trigger functions and triggers
-- ==============================================================================

-- Function: Auto-update updated_at timestamp
-- This function is likely already created, but we'll ensure it exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at column on row modification';

-- Trigger: Auto-update updated_at for task_template_item_associations
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON task_template_item_associations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update updated_at for workflow_task_item_associations
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON workflow_task_item_associations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-set loaded_at timestamp when status changes to 'loaded'
-- This ensures loaded_at is automatically set when a worker marks an item as loaded
CREATE OR REPLACE FUNCTION set_loaded_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to 'loaded' and loaded_at is not set, set it now
  IF NEW.status = 'loaded' AND OLD.status != 'loaded' AND NEW.loaded_at IS NULL THEN
    NEW.loaded_at = NOW();
  END IF;

  -- If status is changing away from 'loaded' to 'pending', clear loaded_at and loaded_by
  IF NEW.status = 'pending' AND OLD.status = 'loaded' THEN
    NEW.loaded_at = NULL;
    NEW.loaded_by = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_loaded_timestamp() IS 'Auto-set loaded_at when status becomes loaded, clear when reset to pending';

-- Trigger: Auto-set loaded_at for workflow_task_item_associations
CREATE TRIGGER auto_set_loaded_timestamp
  BEFORE UPDATE OF status ON workflow_task_item_associations
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION set_loaded_timestamp();

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS
-- ==============================================================================
-- To rollback this migration, run the following SQL:
--
-- DROP TRIGGER IF EXISTS auto_set_loaded_timestamp ON workflow_task_item_associations;
-- DROP TRIGGER IF EXISTS set_updated_at ON workflow_task_item_associations;
-- DROP TRIGGER IF EXISTS set_updated_at ON task_template_item_associations;
-- DROP FUNCTION IF EXISTS set_loaded_timestamp();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS workflow_task_item_associations CASCADE;
-- DROP TABLE IF EXISTS task_template_item_associations CASCADE;
-- DROP TYPE IF EXISTS task_item_status;
--
-- ==============================================================================

