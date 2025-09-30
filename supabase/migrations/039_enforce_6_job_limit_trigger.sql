-- Add trigger to enforce 6-job limit per day plan
-- This prevents race conditions at the database level

CREATE OR REPLACE FUNCTION check_job_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_job_count INTEGER;
BEGIN
  -- Only check for job events
  IF NEW.event_type = 'job' THEN
    -- Count existing jobs for this day plan
    SELECT COUNT(*) INTO current_job_count
    FROM schedule_events
    WHERE day_plan_id = NEW.day_plan_id
      AND event_type = 'job'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- Enforce 6-job limit
    IF current_job_count >= 6 THEN
      RAISE EXCEPTION 'Cannot add job: maximum of 6 jobs per technician per day'
        USING ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs before INSERT or UPDATE
DROP TRIGGER IF EXISTS enforce_job_limit ON schedule_events;
CREATE TRIGGER enforce_job_limit
  BEFORE INSERT OR UPDATE ON schedule_events
  FOR EACH ROW
  EXECUTE FUNCTION check_job_limit();