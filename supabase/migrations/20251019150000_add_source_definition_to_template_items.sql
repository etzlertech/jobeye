-- Migration: 20251019150000_add_source_definition_to_template_items.sql
-- Purpose: Link task_template_items to task_definitions for library support
-- Feature: 014-add-task-management (T034)
-- Dependencies: task_definitions table, task_template_items table

-- Add source_definition_id column (nullable for backward compatibility)
ALTER TABLE task_template_items
ADD COLUMN IF NOT EXISTS source_definition_id UUID NULL
REFERENCES task_definitions(id) ON DELETE SET NULL;

-- Add index for performance when querying usage
CREATE INDEX IF NOT EXISTS idx_task_template_items_source_definition
  ON task_template_items(source_definition_id)
  WHERE source_definition_id IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN task_template_items.source_definition_id IS 'Reference to task_definition if created from library (NULL for custom tasks)';
