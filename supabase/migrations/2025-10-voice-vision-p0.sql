-- Migration: Voice-Vision MVP for JobEye
-- Purpose: Add tables for voice job creation and vision-based checklist verification
-- Phase: 3-4 (Voice Pipeline & Job Execution)
-- Dependencies: Requires existing companies, users, customers, properties tables

-- 1. Fix auth helper function
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid;
$$ LANGUAGE sql STABLE;

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
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  due_by timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  priority text DEFAULT 'normal',
  checklist jsonb DEFAULT '[]'::jsonb,
  voice_source_media_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- 3. Media storage for voice and images
CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES users(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_type CHECK (type IN ('audio', 'image', 'video'))
);

-- 4. Voice processing tables (Phase 3)
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  session_type text NOT NULL DEFAULT 'voice_command',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS voice_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES conversation_sessions(id) ON DELETE RESTRICT,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  language text DEFAULT 'en',
  transcript text NOT NULL,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  words jsonb,
  tokens_used int,
  cost_usd numeric(18,6),
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intent_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid REFERENCES voice_transcripts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  intent text NOT NULL,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  entities jsonb NOT NULL,
  raw_response jsonb,
  tokens_used int,
  cost_usd numeric(18,6),
  created_at timestamptz DEFAULT now()
);

-- 5. Vision verification tables (Phase 4)
CREATE TABLE IF NOT EXISTS vision_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  checklist_item_id text NOT NULL,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  meets_criteria boolean NOT NULL,
  reasons jsonb,
  hints jsonb,
  tokens_used int,
  cost_usd numeric(18,6),
  created_at timestamptz DEFAULT now()
);

-- 6. Idempotency tracking
CREATE TABLE IF NOT EXISTS request_deduplication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  response jsonb,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  request_count int DEFAULT 1,
  UNIQUE (company_id, request_hash)
);

-- 7. Cost tracking ledger
CREATE TABLE IF NOT EXISTS ai_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_type text NOT NULL, -- 'asr', 'llm', 'vlm'
  provider text NOT NULL,
  model_id text NOT NULL,
  tokens_used int,
  cost_usd numeric(18,6) NOT NULL,
  reference_type text, -- 'voice_transcript', 'intent_recognition', 'vision_verification'
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 8. Create indexes for performance
CREATE INDEX idx_jobs_company_scheduled ON jobs(company_id, scheduled_start);
CREATE INDEX idx_jobs_assignee ON jobs(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_jobs_status ON jobs(status) WHERE status IN ('scheduled', 'in_progress');
CREATE INDEX idx_media_assets_company_type ON media_assets(company_id, type);
CREATE INDEX idx_voice_transcripts_session ON voice_transcripts(session_id);
CREATE INDEX idx_vision_verifications_job ON vision_verifications(job_id);
CREATE INDEX idx_ai_cost_ledger_company_date ON ai_cost_ledger(company_id, created_at);

-- 9. Updated-at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at_job_templates
BEFORE UPDATE ON job_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_jobs
BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. Enable RLS on all new tables
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_deduplication ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_ledger ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies - Company Isolation

-- Job templates: company isolation
CREATE POLICY job_templates_company_isolation ON job_templates
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Jobs: company isolation
CREATE POLICY jobs_company_isolation ON jobs
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Media assets: company isolation
CREATE POLICY media_company_isolation ON media_assets
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Conversation sessions: company isolation
CREATE POLICY sessions_company_isolation ON conversation_sessions
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Voice transcripts: access via session company
CREATE POLICY transcripts_company_isolation ON voice_transcripts
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_sessions cs
    JOIN users u ON u.id = auth.uid()
    WHERE cs.id = voice_transcripts.session_id 
    AND cs.company_id = u.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_sessions cs
    JOIN users u ON u.id = auth.uid()
    WHERE cs.id = voice_transcripts.session_id 
    AND cs.company_id = u.company_id
  )
);

-- Intent recognitions: access via transcript
CREATE POLICY intents_company_isolation ON intent_recognitions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM voice_transcripts vt
    JOIN conversation_sessions cs ON cs.id = vt.session_id
    JOIN users u ON u.id = auth.uid()
    WHERE vt.id = intent_recognitions.transcript_id 
    AND cs.company_id = u.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM voice_transcripts vt
    JOIN conversation_sessions cs ON cs.id = vt.session_id
    JOIN users u ON u.id = auth.uid()
    WHERE vt.id = intent_recognitions.transcript_id 
    AND cs.company_id = u.company_id
  )
);

-- Vision verifications: access via job
CREATE POLICY vision_company_isolation ON vision_verifications
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN users u ON u.id = auth.uid()
    WHERE j.id = vision_verifications.job_id 
    AND j.company_id = u.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN users u ON u.id = auth.uid()
    WHERE j.id = vision_verifications.job_id 
    AND j.company_id = u.company_id
  )
);

-- Request deduplication: company isolation
CREATE POLICY dedup_company_isolation ON request_deduplication
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- AI cost ledger: company isolation
CREATE POLICY cost_ledger_company_isolation ON ai_cost_ledger
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- 12. Helper functions for entity resolution
CREATE OR REPLACE FUNCTION search_customers_fuzzy(
  p_company_id uuid,
  p_search_term text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  similarity numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as customer_id,
    c.name as customer_name,
    similarity(c.name, p_search_term) as similarity
  FROM customers c
  WHERE c.company_id = p_company_id
    AND c.name % p_search_term  -- trigram similarity operator
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION search_users_by_name_or_email(
  p_company_id uuid,
  p_search_term text
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.full_name,
    u.email
  FROM users u
  WHERE u.company_id = p_company_id
    AND (
      u.email ILIKE p_search_term || '%'
      OR u.full_name ILIKE '%' || p_search_term || '%'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Materialized views for metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS voice_job_metrics AS
SELECT 
  company_id,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE confidence > 0.85) as high_confidence,
  AVG(confidence) as avg_confidence,
  SUM(cost_usd) as total_cost
FROM voice_transcripts vt
JOIN conversation_sessions cs ON cs.id = vt.session_id
GROUP BY company_id, DATE_TRUNC('hour', created_at);

CREATE MATERIALIZED VIEW IF NOT EXISTS checklist_verification_metrics AS
SELECT 
  j.company_id,
  DATE_TRUNC('hour', vv.created_at) as hour,
  COUNT(*) as total_verifications,
  COUNT(*) FILTER (WHERE vv.meets_criteria) as auto_approved,
  AVG(vv.confidence) as avg_confidence,
  SUM(vv.cost_usd) as total_cost
FROM vision_verifications vv
JOIN jobs j ON j.id = vv.job_id
GROUP BY j.company_id, DATE_TRUNC('hour', vv.created_at);

-- Create indexes on materialized views
CREATE INDEX idx_voice_metrics_company_hour ON voice_job_metrics(company_id, hour);
CREATE INDEX idx_checklist_metrics_company_hour ON checklist_verification_metrics(company_id, hour);

-- Grant necessary permissions
GRANT SELECT ON voice_job_metrics TO authenticated;
GRANT SELECT ON checklist_verification_metrics TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Voice-Vision migration completed successfully';
  RAISE NOTICE 'Created tables: job_templates, jobs, media_assets, conversation_sessions, voice_transcripts, intent_recognitions, vision_verifications, request_deduplication, ai_cost_ledger';
  RAISE NOTICE 'All RLS policies applied for company isolation';
END $$;