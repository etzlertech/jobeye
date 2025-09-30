-- Fix RLS policies for scheduling tables to use app_metadata.company_id
-- Migration 037 incorrectly used jwt.claims->>'company_id' instead of jwt.claims->'app_metadata'->>'company_id'

-- Drop old policies
DROP POLICY IF EXISTS day_plans_tenant_access ON public.day_plans;
DROP POLICY IF EXISTS schedule_events_tenant_access ON public.schedule_events;

-- Recreate with correct app_metadata path
CREATE POLICY day_plans_tenant_access ON public.day_plans
  USING (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))
  WITH CHECK (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'));

CREATE POLICY schedule_events_tenant_access ON public.schedule_events
  USING (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))
  WITH CHECK (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'));