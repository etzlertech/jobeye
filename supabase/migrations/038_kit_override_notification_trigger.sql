-- 038_kit_override_notification_trigger.sql
-- Notification queue + triggers aligned with tenant_id standard

-- Create notification queue table if not exists
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  message TEXT NOT NULL,
  data JSONB,
  method TEXT CHECK (method IN ('sms', 'push', 'email', 'call')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on notification queue
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue FORCE ROW LEVEL SECURITY;

-- RLS policies for notification queue
DROP POLICY IF EXISTS notification_queue_tenant_access ON public.notification_queue;
CREATE POLICY notification_queue_tenant_access ON public.notification_queue
  USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  )
  WITH CHECK (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );

DROP POLICY IF EXISTS notification_queue_service_role ON public.notification_queue;
CREATE POLICY notification_queue_service_role ON public.notification_queue
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to queue supervisor notification on kit override
CREATE OR REPLACE FUNCTION notify_supervisor_on_kit_override()
RETURNS TRIGGER AS $$
DECLARE
  v_kit_name TEXT;
  v_message TEXT;
BEGIN
  -- Only notify if supervisor_id is set
  IF NEW.supervisor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get kit name
  SELECT name INTO v_kit_name
  FROM public.kits
  WHERE id = NEW.kit_id;

  -- Build notification message
  v_message := format(
    'Tech %s needs override for %s kit item %s: %s',
    COALESCE(NEW.technician_id::text, 'Unknown'),
    COALESCE(v_kit_name, 'Unknown'),
    COALESCE(NEW.item_id, 'Unknown'),
    COALESCE(NEW.override_reason, 'No reason provided')
  );

  -- Insert into notification queue
  INSERT INTO public.notification_queue (
    tenant_id,
    recipient_id,
    type,
    priority,
    message,
    data
  ) VALUES (
    NEW.tenant_id,
    NEW.supervisor_id,
    'kit_override',
    'high',
    v_message,
    jsonb_build_object(
      'job_id', NEW.job_id,
      'kit_id', NEW.kit_id,
      'item_id', NEW.item_id,
      'technician_id', NEW.technician_id,
      'override_reason', NEW.override_reason
    )
  );

  -- Update override log to mark notification sent
  NEW.supervisor_notified_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS kit_override_notify_supervisor ON public.kit_override_logs;
CREATE TRIGGER kit_override_notify_supervisor
  AFTER INSERT ON public.kit_override_logs
  FOR EACH ROW
  WHEN (NEW.supervisor_id IS NOT NULL)
  EXECUTE FUNCTION notify_supervisor_on_kit_override();

-- Function to check break compliance and notify
CREATE OR REPLACE FUNCTION check_break_compliance(p_day_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_work_start TIMESTAMPTZ;
  v_last_break TIMESTAMPTZ;
  v_total_work_minutes INTEGER := 0;
  v_break_minutes INTEGER := 0;
  v_hours_since_break NUMERIC;
  v_compliant BOOLEAN := TRUE;
  v_message TEXT;
BEGIN
  -- Get day plan details
  SELECT tenant_id, user_id, actual_start_time
  INTO v_tenant_id, v_user_id, v_work_start
  FROM public.day_plans
  WHERE id = p_day_plan_id;

  IF v_work_start IS NULL THEN
    RETURN jsonb_build_object('compliant', true, 'message', 'Day not started');
  END IF;

  -- Calculate total work time and breaks
  WITH event_times AS (
    SELECT
      event_type,
      actual_start,
      actual_end,
      EXTRACT(EPOCH FROM (COALESCE(actual_end, NOW()) - actual_start)) / 60 AS duration_minutes
    FROM public.schedule_events
    WHERE day_plan_id = p_day_plan_id
      AND actual_start IS NOT NULL
      AND status IN ('completed', 'in_progress')
  )
  SELECT
    SUM(CASE WHEN event_type != 'break' THEN duration_minutes ELSE 0 END)::INTEGER,
    SUM(CASE WHEN event_type = 'break' THEN duration_minutes ELSE 0 END)::INTEGER,
    MAX(CASE WHEN event_type = 'break' THEN actual_start END)
  INTO v_total_work_minutes, v_break_minutes, v_last_break
  FROM event_times;

  -- Calculate hours since last break
  IF v_last_break IS NOT NULL THEN
    v_hours_since_break := EXTRACT(EPOCH FROM (NOW() - v_last_break)) / 3600;
  ELSE
    v_hours_since_break := EXTRACT(EPOCH FROM (NOW() - v_work_start)) / 3600;
  END IF;

  -- Check if 4+ hours without break
  IF v_hours_since_break >= 4 THEN
    v_compliant := FALSE;
    v_message := format('Technician has worked %.1f hours without a break', v_hours_since_break);

    INSERT INTO public.notification_queue (
      tenant_id,
      recipient_id,
      type,
      priority,
      message,
      data
    ) VALUES (
      v_tenant_id,
      v_user_id,
      'break_warning',
      'high',
      v_message || ' - Please take a break soon!',
      jsonb_build_object(
        'day_plan_id', p_day_plan_id,
        'hours_worked', v_hours_since_break,
        'last_break', v_last_break
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'compliant', v_compliant,
    'total_work_hours', ROUND(v_total_work_minutes::NUMERIC / 60, 1),
    'breaks_taken', COALESCE((
      SELECT COUNT(*)
      FROM public.schedule_events
      WHERE day_plan_id = p_day_plan_id
        AND event_type = 'break'
        AND status = 'completed'
    ), 0),
    'break_minutes', v_break_minutes,
    'last_break_at', v_last_break,
    'hours_since_break', ROUND(v_hours_since_break, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify on job limit approach
CREATE OR REPLACE FUNCTION notify_job_limit_approaching()
RETURNS TRIGGER AS $$
DECLARE
  v_job_count INTEGER;
  v_user_id UUID;
  v_max_jobs INTEGER := 6;
BEGIN
  -- Only check for job events
  IF NEW.event_type != 'job' THEN
    RETURN NEW;
  END IF;

  -- Get user_id from day plan
  SELECT user_id INTO v_user_id
  FROM public.day_plans
  WHERE id = NEW.day_plan_id;

  -- Count jobs for this day plan
  SELECT COUNT(*) INTO v_job_count
  FROM public.schedule_events
  WHERE day_plan_id = NEW.day_plan_id
    AND event_type = 'job'
    AND status != 'cancelled';

  -- Notify at 5 jobs (approaching limit)
  IF v_job_count = 5 THEN
    INSERT INTO public.notification_queue (
      tenant_id,
      recipient_id,
      type,
      priority,
      message,
      data
    ) VALUES (
      NEW.tenant_id,
      v_user_id,
      'job_limit_warning',
      'medium',
      format('Technician has %s of %s jobs scheduled for today', v_job_count, v_max_jobs),
      jsonb_build_object(
        'technician_id', v_user_id,
        'day_plan_id', NEW.day_plan_id,
        'current_job_count', v_job_count,
        'max_jobs', v_max_jobs
      )
    );
  END IF;

  -- Notify at limit
  IF v_job_count >= v_max_jobs THEN
    INSERT INTO public.notification_queue (
      tenant_id,
      recipient_id,
      type,
      priority,
      message,
      data
    ) VALUES (
      NEW.tenant_id,
      v_user_id,
      'job_limit_reached',
      'high',
      'Maximum daily job limit reached',
      jsonb_build_object(
        'technician_id', v_user_id,
        'day_plan_id', NEW.day_plan_id,
        'current_job_count', v_job_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for job limit notifications
DROP TRIGGER IF EXISTS schedule_events_job_limit_check ON public.schedule_events;
CREATE TRIGGER schedule_events_job_limit_check
  AFTER INSERT ON public.schedule_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'job')
  EXECUTE FUNCTION notify_job_limit_approaching();

-- Indexes and trigger for notification queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending ON public.notification_queue(status, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient ON public.notification_queue(recipient_id, created_at);

DROP TRIGGER IF EXISTS notification_queue_set_updated_at ON public.notification_queue;
CREATE TRIGGER notification_queue_set_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
