-- Migration: Add RLS policies for crew members to access their assigned jobs
-- Date: 2025-10-20
-- Purpose: Allow crew members to read jobs, customers, and properties for jobs they're assigned to

-- Policy for crew to read their own job assignments
CREATE POLICY IF NOT EXISTS "Crew can read own assignments"
ON job_assignments FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- Policy for crew to read jobs they're assigned to
CREATE POLICY IF NOT EXISTS "Crew can read assigned jobs"
ON jobs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_assignments
    WHERE job_assignments.job_id = jobs.id
    AND job_assignments.user_id = auth.uid()
  )
);

-- Policy for crew to read customers for their assigned jobs
CREATE POLICY IF NOT EXISTS "Crew can read customers for assigned jobs"
ON customers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs
    JOIN job_assignments ON job_assignments.job_id = jobs.id
    WHERE jobs.customer_id = customers.id
    AND job_assignments.user_id = auth.uid()
  )
);

-- Policy for crew to read properties for their assigned jobs
CREATE POLICY IF NOT EXISTS "Crew can read properties for assigned jobs"
ON properties FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs
    JOIN job_assignments ON job_assignments.job_id = jobs.id
    WHERE jobs.property_id = properties.id
    AND job_assignments.user_id = auth.uid()
  )
);

-- Policy for crew to read job templates for their assigned jobs
CREATE POLICY IF NOT EXISTS "Crew can read job templates for assigned jobs"
ON job_templates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs
    JOIN job_assignments ON job_assignments.job_id = jobs.id
    WHERE jobs.template_id = job_templates.id
    AND job_assignments.user_id = auth.uid()
  )
);
