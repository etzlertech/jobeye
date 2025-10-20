-- Migration: Create job template instantiation logic
-- Created: 2025-10-20
-- Description: Auto-populates workflow_task_item_associations when workflow_tasks are created from templates
--              Copies item requirements from task_template_item_associations to instantiated tasks

-- Function to instantiate task items from templates
CREATE OR REPLACE FUNCTION instantiate_task_items_from_template(
  p_job_id UUID,
  p_template_id UUID,
  p_tenant_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_inserted_count INTEGER := 0;
  v_task_mapping RECORD;
BEGIN
  -- For each task in the template that was instantiated for this job
  FOR v_task_mapping IN
    SELECT tt.id as template_task_id, wt.id as workflow_task_id
    FROM task_templates tt
    JOIN workflow_tasks wt ON wt.template_id = tt.id
    WHERE wt.job_id = p_job_id
      AND tt.job_template_id = p_template_id
      AND wt.tenant_id = p_tenant_id
      AND wt.is_deleted = false
  LOOP
    -- Copy item associations from template to workflow task
    INSERT INTO workflow_task_item_associations (
      tenant_id,
      workflow_task_id,
      item_id,
      kit_id,
      quantity,
      is_required,
      status,
      source_template_association_id,
      created_at,
      updated_at
    )
    SELECT
      p_tenant_id,
      v_task_mapping.workflow_task_id,
      ttia.item_id,
      ttia.kit_id,
      ttia.quantity,
      ttia.is_required,
      'pending'::task_item_status,
      ttia.id,
      NOW(),
      NOW()
    FROM task_template_item_associations ttia
    WHERE ttia.task_template_id = v_task_mapping.template_task_id
      AND ttia.tenant_id = p_tenant_id
    ON CONFLICT (workflow_task_id, item_id) DO NOTHING; -- Skip if already exists

    GET DIAGNOSTICS v_inserted_count = v_inserted_count + ROW_COUNT;
  END LOOP;

  RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION instantiate_task_items_from_template IS
  'Copies item requirements from task templates to workflow tasks when a job is created from a template. Returns count of associations created.';

-- Trigger function to auto-instantiate task items when workflow_tasks are created
CREATE OR REPLACE FUNCTION trigger_instantiate_task_items()
RETURNS TRIGGER AS $$
DECLARE
  v_job_template_id UUID;
  v_count INTEGER;
BEGIN
  -- Only instantiate if this task came from a template
  IF NEW.template_id IS NOT NULL THEN
    -- Get the job template ID from the task template
    SELECT job_template_id INTO v_job_template_id
    FROM task_templates
    WHERE id = NEW.template_id;

    IF v_job_template_id IS NOT NULL THEN
      -- Instantiate item associations
      v_count := instantiate_task_items_from_template(
        NEW.job_id,
        v_job_template_id,
        NEW.tenant_id
      );

      RAISE NOTICE 'Auto-instantiated % item associations for task % from template %',
        v_count, NEW.id, NEW.template_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (idempotent)
DROP TRIGGER IF EXISTS auto_instantiate_task_items ON workflow_tasks;

CREATE TRIGGER auto_instantiate_task_items
  AFTER INSERT ON workflow_tasks
  FOR EACH ROW
  WHEN (NEW.template_id IS NOT NULL)
  EXECUTE FUNCTION trigger_instantiate_task_items();

COMMENT ON TRIGGER auto_instantiate_task_items ON workflow_tasks IS
  'Automatically copies item requirements from task templates to workflow_task_item_associations when a task is instantiated from a template';
