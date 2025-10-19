-- Migration: Add image URL columns to task_templates and workflow_tasks
-- Date: 2025-10-19
-- Purpose: Enable image attachments for task templates and workflow tasks with three size variants
-- Related: Feature 013-lets-plan-to - Template and Task Image Management
-- Spec: /specs/013-lets-plan-to/

-- Add image columns to task_templates
ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Add image columns to workflow_tasks
ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Add indexes for better query performance when filtering by image presence
CREATE INDEX IF NOT EXISTS idx_task_templates_thumbnail_url
  ON task_templates(thumbnail_url)
  WHERE thumbnail_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_thumbnail_url
  ON workflow_tasks(thumbnail_url)
  WHERE thumbnail_url IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN task_templates.thumbnail_url IS 'Thumbnail image URL (150x150px square crop) - used in template list cards';
COMMENT ON COLUMN task_templates.medium_url IS 'Medium image URL (800x800px square crop) - used in template detail views';
COMMENT ON COLUMN task_templates.primary_image_url IS 'Full resolution image URL (2048x2048px square crop) - stored for high quality display';

COMMENT ON COLUMN workflow_tasks.thumbnail_url IS 'Thumbnail image URL (150x150px square crop) - used in task list cards';
COMMENT ON COLUMN workflow_tasks.medium_url IS 'Medium image URL (800x800px square crop) - used in task detail views';
COMMENT ON COLUMN workflow_tasks.primary_image_url IS 'Full resolution image URL (2048x2048px square crop) - stored for high quality display';

-- Note: These image URLs are separate from verification_photo_url in workflow_tasks
-- verification_photo_url: Photo taken to verify task completion
-- thumbnail_url/medium_url/primary_image_url: Reference images showing what the task should look like
