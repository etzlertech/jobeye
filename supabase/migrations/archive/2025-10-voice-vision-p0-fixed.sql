-- Migration: Voice-Vision MVP for JobEye
-- Purpose: Add tables for voice job creation and vision-based checklist verification
-- Phase: 3-4 (Voice Pipeline & Job Execution)
-- Dependencies: Requires existing companies, users, customers, properties tables

-- Note: Removed auth.uid() function as it already exists in Supabase

-- 1. Create job-related tables (Phase 4)
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

-- 2. Media storage for voice and images
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
  created_by uuid REFERENCES users(id),
  CONSTRAINT valid_type CHECK (type IN ('audio', 'image', 'video', 'document'))
);

-- 3. Voice processing tables
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
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

-- 4. Vision verification tables
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
  verified_by uuid REFERENCES users(id),
  CONSTRAINT valid_status CHECK (verification_status IN ('completed', 'not_visible', 'unclear', 'failed'))
);

-- 5. Request deduplication
CREATE TABLE IF NOT EXISTS request_deduplication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  response_data jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(company_id, request_hash)
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_assignee ON jobs(assignee_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_company ON media_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON voice_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_intents_transcript ON intent_recognitions(transcript_id);
CREATE INDEX IF NOT EXISTS idx_verifications_job ON vision_verifications(job_id);
CREATE INDEX IF NOT EXISTS idx_dedup_hash ON request_deduplication(company_id, request_hash);

-- 7. Enable RLS
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_deduplication ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies (company isolation)

-- Job templates: same company
CREATE POLICY job_templates_company_isolation ON job_templates
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Jobs: same company
CREATE POLICY jobs_company_isolation ON jobs
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Media assets: same company
CREATE POLICY media_company_isolation ON media_assets
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Conversation sessions: same company
CREATE POLICY sessions_company_isolation ON conversation_sessions
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Voice transcripts: access via media asset
CREATE POLICY transcripts_company_isolation ON voice_transcripts
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM media_assets ma
    JOIN users u ON u.id = auth.uid()
    WHERE ma.id = voice_transcripts.media_asset_id 
    AND ma.company_id = u.company_id
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
);

-- Request deduplication: company isolation
CREATE POLICY dedup_company_isolation ON request_deduplication
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- 9. Add helpful comments
COMMENT ON TABLE jobs IS 'Main jobs table for scheduling and tracking field service work';
COMMENT ON TABLE media_assets IS 'Storage references for voice recordings and verification images';
COMMENT ON TABLE voice_transcripts IS 'ASR results from voice recordings';
COMMENT ON TABLE intent_recognitions IS 'Parsed intents from voice commands for job creation';
COMMENT ON TABLE vision_verifications IS 'Image-based verification of completed checklist items';
COMMENT ON COLUMN jobs.voice_source_media_id IS 'References the original voice recording that created this job';
COMMENT ON COLUMN voice_transcripts.cost_cents IS 'Cost in cents (e.g., 15.5 = $0.155)';

-- Migration complete!
-- Next steps: Set up storage buckets for media files