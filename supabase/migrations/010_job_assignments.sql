-- Migration: Job Assignments Table for Crew Hub Feature
-- Feature: 010-job-assignment-and
-- Date: 2025-10-16
-- Constitutional Pattern: RLS with app_metadata.tenant_id

-- ============================================================================
-- 1. Create job_assignments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_assignments (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation (CONSTITUTIONAL REQUIREMENT)
  tenant_id uuid NOT NULL REFERENCES tenants(id),

  -- Core relationships
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Audit trail
  assigned_by uuid REFERENCES auth.users(id), -- Supervisor who made assignment
  assigned_at timestamptz DEFAULT NOW(),

  -- Standard metadata
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  -- Prevent duplicate assignments
  UNIQUE(tenant_id, job_id, user_id)
);

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_assignments_tenant
  ON job_assignments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_job
  ON job_assignments(job_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_user
  ON job_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_composite
  ON job_assignments(tenant_id, user_id); -- Crew dashboard query optimization

-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Create RLS policies using constitutional pattern
-- ============================================================================

-- Tenant isolation policy (CONSTITUTIONAL PATTERN)
CREATE POLICY "tenant_isolation" ON job_assignments
  FOR ALL USING (
    tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata' ->> 'tenant_id'
    )
  );

-- Crew can view own assignments OR supervisors can view all in tenant
CREATE POLICY "crew_view_own_assignments" ON job_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (
          u.raw_app_meta_data->>'role' = 'manager'
          OR u.raw_app_meta_data->>'role' = 'admin'
          OR u.raw_app_meta_data->>'role' = 'supervisor'
        )
    )
  );

-- Only supervisors can INSERT assignments
CREATE POLICY "supervisor_insert_assignments" ON job_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (
          u.raw_app_meta_data->>'role' = 'manager'
          OR u.raw_app_meta_data->>'role' = 'admin'
          OR u.raw_app_meta_data->>'role' = 'supervisor'
        )
    )
  );

-- Only supervisors can DELETE assignments
CREATE POLICY "supervisor_delete_assignments" ON job_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (
          u.raw_app_meta_data->>'role' = 'manager'
          OR u.raw_app_meta_data->>'role' = 'admin'
          OR u.raw_app_meta_data->>'role' = 'supervisor'
        )
    )
  );

-- ============================================================================
-- 5. Create sync trigger for backward compatibility
-- ============================================================================

-- Trigger function to sync first assignment to jobs.assigned_to
CREATE OR REPLACE FUNCTION sync_job_assigned_to()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: Update jobs.assigned_to with first assignment
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs
    SET assigned_to = NEW.user_id,
        updated_at = NOW()
    WHERE id = NEW.job_id
      AND assigned_to IS NULL; -- Only if not already assigned
    RETURN NEW;
  END IF;

  -- On DELETE: Update jobs.assigned_to to next assignment or NULL
  IF TG_OP = 'DELETE' THEN
    UPDATE jobs j
    SET assigned_to = (
      SELECT user_id
      FROM job_assignments
      WHERE job_id = OLD.job_id
      LIMIT 1
    ),
    updated_at = NOW()
    WHERE id = OLD.job_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to job_assignments table
CREATE TRIGGER trigger_sync_assigned_to
  AFTER INSERT OR DELETE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_assigned_to();

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Next steps:
-- 1. Run: npm run generate:types (T006a)
-- 2. Backfill existing assignments (T006)
-- 3. Write tests (T007-T015)
