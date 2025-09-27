-- Migration: Voice-Vision MVP for JobEye (Supabase Compliant)
-- Purpose: Add tables for voice job creation and vision-based checklist verification
-- Phase: 3-4 (Voice Pipeline & Job Execution)
-- Dependencies: Requires existing companies, customers, properties tables

-- 1. Create profiles table if not exists (links to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);

-- 2. Create job-related tables (Phase 4)
CREATE TABLE IF NOT EXISTS job_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  job_type text NOT NULL,
  default_duration_minutes int DEFAULT 60,
  default_checklist jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  job_template_id uuid REFERENCES job_templates(id),
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  due_by timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  priority text DEFAULT 'normal',
  checklist jsonb DEFAULT '[]'::jsonb,
  voice_source_media_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- 3. Media storage for voice and images
CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  storage_path text,
  file_size_bytes bigint,
  mime_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  CONSTRAINT valid_type CHECK (type IN ('audio', 'image', 'video', 'document'))
);

-- 4. Voice processing tables
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  device_info jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  session_id uuid REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  transcript text NOT NULL,
  asr_provider text NOT NULL,
  confidence numeric(3,2),
  word_timings jsonb,
  processing_time_ms int,
  cost_cents numeric(10,4),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_provider CHECK (asr_provider IN ('openai', 'google', 'aws', 'azure'))
);

CREATE TABLE IF NOT EXISTS intent_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL REFERENCES voice_transcripts(id) ON DELETE CASCADE,
  intent text NOT NULL,
  confidence numeric(3,2),
  slots jsonb NOT NULL,
  llm_provider text NOT NULL,
  model_version text,
  cost_cents numeric(10,4),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_intent CHECK (intent IN ('create_scheduled_job', 'check_job_status', 'update_job', 'unknown'))
);

-- 5. Vision verification tables
CREATE TABLE IF NOT EXISTS vision_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  checklist_item text NOT NULL,
  verification_status text NOT NULL,
  confidence numeric(3,2),
  vlm_provider text NOT NULL,
  model_version text,
  cost_cents numeric(10,4),
  verified_at timestamptz DEFAULT now(),
  verified_by uuid REFERENCES public.profiles(id),
  CONSTRAINT valid_status CHECK (verification_status IN ('completed', 'not_visible', 'unclear', 'failed'))
);

-- 6. Request deduplication
CREATE TABLE IF NOT EXISTS request_deduplication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  response_data jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(company_id, request_hash)
);

-- 7. Cost tracking
CREATE TABLE IF NOT EXISTS ai_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_type text NOT NULL, -- 'asr', 'llm', 'vlm'
  provider text NOT NULL,
  model_id text NOT NULL,
  tokens_used int,
  cost_cents numeric(10,4) NOT NULL,
  reference_type text, -- 'voice_transcript', 'intent_recognition', 'vision_verification'
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_assignee ON jobs(assignee_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_company ON media_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON voice_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_intents_transcript ON intent_recognitions(transcript_id);
CREATE INDEX IF NOT EXISTS idx_verifications_job ON vision_verifications(job_id);
CREATE INDEX IF NOT EXISTS idx_dedup_hash ON request_deduplication(company_id, request_hash);
CREATE INDEX IF NOT EXISTS idx_cost_company_date ON ai_cost_ledger(company_id, created_at);

-- 9. Enable RLS on all tables
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_deduplication ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_ledger ENABLE ROW LEVEL SECURITY;

-- 10. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON 
  job_templates, jobs, media_assets, conversation_sessions, 
  voice_transcripts, intent_recognitions, vision_verifications, 
  request_deduplication, ai_cost_ledger 
TO authenticated;

-- 11. Create RLS policies (using profiles table)

-- Helper function to get current user's company
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Job templates policies
CREATE POLICY "job_templates_select" ON job_templates FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());
CREATE POLICY "job_templates_insert" ON job_templates FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "job_templates_update" ON job_templates FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "job_templates_delete" ON job_templates FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- Jobs policies
CREATE POLICY "jobs_select" ON jobs FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());
CREATE POLICY "jobs_insert" ON jobs FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "jobs_update" ON jobs FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "jobs_delete" ON jobs FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- Media assets policies
CREATE POLICY "media_select" ON media_assets FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());
CREATE POLICY "media_insert" ON media_assets FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "media_update" ON media_assets FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "media_delete" ON media_assets FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- Conversation sessions policies
CREATE POLICY "sessions_select" ON conversation_sessions FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());
CREATE POLICY "sessions_insert" ON conversation_sessions FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "sessions_update" ON conversation_sessions FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "sessions_delete" ON conversation_sessions FOR DELETE TO authenticated
  USING (company_id = get_user_company_id());

-- Voice transcripts policies (via session)
CREATE POLICY "transcripts_select" ON voice_transcripts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversation_sessions cs
    WHERE cs.id = voice_transcripts.session_id 
    AND cs.company_id = get_user_company_id()
  ));
CREATE POLICY "transcripts_insert" ON voice_transcripts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversation_sessions cs
    WHERE cs.id = voice_transcripts.session_id 
    AND cs.company_id = get_user_company_id()
  ));
CREATE POLICY "transcripts_update" ON voice_transcripts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversation_sessions cs
    WHERE cs.id = voice_transcripts.session_id 
    AND cs.company_id = get_user_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversation_sessions cs
    WHERE cs.id = voice_transcripts.session_id 
    AND cs.company_id = get_user_company_id()
  ));

-- Intent recognitions policies (via transcript)
CREATE POLICY "intents_select" ON intent_recognitions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM voice_transcripts vt
    JOIN conversation_sessions cs ON cs.id = vt.session_id
    WHERE vt.id = intent_recognitions.transcript_id 
    AND cs.company_id = get_user_company_id()
  ));
CREATE POLICY "intents_insert" ON intent_recognitions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM voice_transcripts vt
    JOIN conversation_sessions cs ON cs.id = vt.session_id
    WHERE vt.id = intent_recognitions.transcript_id 
    AND cs.company_id = get_user_company_id()
  ));

-- Vision verifications policies (via job)
CREATE POLICY "vision_select" ON vision_verifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = vision_verifications.job_id 
    AND j.company_id = get_user_company_id()
  ));
CREATE POLICY "vision_insert" ON vision_verifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = vision_verifications.job_id 
    AND j.company_id = get_user_company_id()
  ));

-- Request deduplication policies
CREATE POLICY "dedup_select" ON request_deduplication FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());
CREATE POLICY "dedup_insert" ON request_deduplication FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- AI cost ledger policies
CREATE POLICY "cost_select" ON ai_cost_ledger FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());
CREATE POLICY "cost_insert" ON ai_cost_ledger FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- 12. Updated-at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_job_templates
  BEFORE UPDATE ON job_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_jobs
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 13. Create private schema for materialized views
CREATE SCHEMA IF NOT EXISTS private;

-- 14. Helper functions for entity resolution
CREATE OR REPLACE FUNCTION search_customers_fuzzy(
  p_company_id uuid,
  p_search_term text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  similarity numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    similarity(c.name, p_search_term)
  FROM public.customers c
  WHERE c.company_id = p_company_id
    AND c.name % p_search_term
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION search_users_by_name_or_email(
  p_company_id uuid,
  p_search_term text
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email
  FROM public.profiles p
  WHERE p.company_id = p_company_id
    AND (p.email ILIKE p_search_term || '%'
         OR p.full_name ILIKE '%' || p_search_term || '%');
END;
$$;

-- 15. Add comments
COMMENT ON TABLE jobs IS 'Main jobs table for scheduling and tracking field service work';
COMMENT ON TABLE media_assets IS 'Storage references for voice recordings and verification images';
COMMENT ON TABLE voice_transcripts IS 'ASR results from voice recordings';
COMMENT ON TABLE intent_recognitions IS 'Parsed intents from voice commands for job creation';
COMMENT ON TABLE vision_verifications IS 'Image-based verification of completed checklist items';
COMMENT ON COLUMN jobs.voice_source_media_id IS 'References the original voice recording that created this job';
COMMENT ON COLUMN voice_transcripts.cost_cents IS 'Cost in cents (e.g., 15.5 = $0.155)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Voice-Vision migration completed successfully';
  RAISE NOTICE 'Created tables: job_templates, jobs, media_assets, conversation_sessions, voice_transcripts, intent_recognitions, vision_verifications, request_deduplication, ai_cost_ledger';
  RAISE NOTICE 'All RLS policies applied using profiles table for company isolation';
END;
$$;