-- 037_scheduling_core_tables.sql
-- Scheduling core tables: day_plans, schedule_events, crew_assignments, job_kits
-- Part of 003-scheduling-kits feature

CREATE TABLE IF NOT EXISTS public.day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  plan_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled')),
  route_data JSONB,
  total_distance_miles DECIMAL(10,2),
  estimated_duration_minutes INTEGER,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  voice_session_id UUID,
  auto_schedule_breaks BOOLEAN DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, plan_date)
);

-- Schedule Events: Individual events within a day plan
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_plan_id UUID NOT NULL REFERENCES public.day_plans(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('job', 'break', 'travel', 'maintenance', 'meeting')),
  job_id TEXT, -- External reference
  sequence_order INTEGER NOT NULL,
  scheduled_start TIMESTAMPTZ,
  scheduled_duration_minutes INTEGER,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'skipped')),
  location_data GEOGRAPHY(POINT),
  address JSONB,
  notes TEXT,
  voice_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crew Assignments: Track which team members are assigned to schedule events
CREATE TABLE IF NOT EXISTS public.crew_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  schedule_event_id UUID NOT NULL REFERENCES public.schedule_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead', 'helper', 'trainee')),
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  voice_confirmed BOOLEAN DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_event_id, user_id)
);

-- Job Kits: Links kits to specific jobs (replacing kit_assignments)
CREATE TABLE IF NOT EXISTS public.job_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  kit_id UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.kit_variants(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'partial', 'failed')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, job_id, kit_id)
);

-- Update kit_override_logs to match expected schema
ALTER TABLE public.kit_override_logs 
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  DROP COLUMN IF EXISTS assignment_id CASCADE,
  DROP COLUMN IF EXISTS delta CASCADE,
  ADD COLUMN IF NOT EXISTS job_id TEXT,
  ADD COLUMN IF NOT EXISTS kit_id UUID,
  ADD COLUMN IF NOT EXISTS item_id TEXT,
  ADD COLUMN IF NOT EXISTS technician_id UUID,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_id UUID,
  ADD COLUMN IF NOT EXISTS supervisor_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_method TEXT,
  ADD COLUMN IF NOT EXISTS notification_status TEXT,
  ADD COLUMN IF NOT EXISTS notification_attempts JSONB,
  ADD COLUMN IF NOT EXISTS sla_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS sla_met BOOLEAN,
  ADD COLUMN IF NOT EXISTS notification_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS voice_initiated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  DROP COLUMN IF EXISTS reason CASCADE;

-- Update triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER day_plans_set_updated_at
  BEFORE UPDATE ON public.day_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER schedule_events_set_updated_at
  BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER crew_assignments_set_updated_at
  BEFORE UPDATE ON public.crew_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER job_kits_set_updated_at
  BEFORE UPDATE ON public.job_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER kit_override_logs_set_updated_at
  BEFORE UPDATE ON public.kit_override_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_day_plans_tenant_user_date ON public.day_plans(tenant_id, user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_day_plans_status ON public.day_plans(status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_schedule_events_plan_sequence ON public.schedule_events(day_plan_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_schedule_events_job ON public.schedule_events(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_events_location USING GIST (location_data);
CREATE INDEX IF NOT EXISTS idx_crew_assignments_user_date ON public.crew_assignments(user_id, assigned_at);
CREATE INDEX IF NOT EXISTS idx_job_kits_job ON public.job_kits(job_id);
CREATE INDEX IF NOT EXISTS idx_kit_override_logs_tenant_job ON public.kit_override_logs(tenant_id, job_id);

-- Enable RLS
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_kits FORCE ROW LEVEL SECURITY;

-- RLS Policies - Tenant Access
CREATE POLICY day_plans_tenant_access ON public.day_plans
  USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'))
  WITH CHECK (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'));

CREATE POLICY schedule_events_tenant_access ON public.schedule_events
  USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'))
  WITH CHECK (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'));

CREATE POLICY crew_assignments_tenant_access ON public.crew_assignments
  USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'))
  WITH CHECK (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'));

CREATE POLICY job_kits_tenant_access ON public.job_kits
  USING (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'))
  WITH CHECK (tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'));

-- RLS Policies - Service Role Bypass
CREATE POLICY day_plans_service_role ON public.day_plans
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY schedule_events_service_role ON public.schedule_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY crew_assignments_service_role ON public.crew_assignments
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY job_kits_service_role ON public.job_kits
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Helper function for checking job count limit
CREATE OR REPLACE FUNCTION check_job_limit(p_day_plan_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_job_count INTEGER;
  v_tenant_id UUID;
  v_max_jobs INTEGER := 6; -- Default max
BEGIN
  -- Get tenant_id from day plan
  SELECT tenant_id INTO v_tenant_id
  FROM public.day_plans
  WHERE id = p_day_plan_id;

  -- Count existing job events
  SELECT COUNT(*) INTO v_job_count
  FROM public.schedule_events
  WHERE day_plan_id = p_day_plan_id
    AND event_type = 'job'
    AND status != 'cancelled';

  -- TODO: Check company-specific limit from settings
  -- For now, use default of 6

  RETURN v_job_count < v_max_jobs;
END;
$$ LANGUAGE plpgsql;

-- Analytics function for override patterns
CREATE OR REPLACE FUNCTION get_override_analytics(
  p_tenant_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH override_stats AS (
    SELECT
      COUNT(*) as total_overrides,
      COUNT(DISTINCT technician_id) as unique_technicians,
      COUNT(DISTINCT kit_id) as unique_kits,
      COUNT(DISTINCT item_id) as unique_items
    FROM public.kit_override_logs
    WHERE tenant_id = p_tenant_id
      AND created_at BETWEEN p_start_date AND p_end_date
  ),
  by_item AS (
    SELECT
      item_id,
      COUNT(*) as count,
      array_agg(DISTINCT override_reason) as reasons
    FROM public.kit_override_logs
    WHERE tenant_id = p_tenant_id
      AND created_at BETWEEN p_start_date AND p_end_date
    GROUP BY item_id
    ORDER BY count DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total_overrides', s.total_overrides,
    'unique_technicians', s.unique_technicians,
    'unique_kits', s.unique_kits,
    'unique_items', s.unique_items,
    'by_item', jsonb_agg(
      jsonb_build_object(
        'item_id', i.item_id,
        'count', i.count,
        'reasons', i.reasons
      )
    ),
    'tenant_id', p_tenant_id
  ) INTO v_result
  FROM override_stats s
  CROSS JOIN LATERAL (
    SELECT * FROM by_item
  ) i;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
