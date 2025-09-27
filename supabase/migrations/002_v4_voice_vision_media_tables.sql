-- Migration: 002_v4_voice_vision_media_tables.sql
-- Purpose: Create voice, vision, and media handling tables for v4 Blueprint
-- Dependencies: 001_v4_core_business_tables.sql

-- Create enum types for voice/vision (with checks for existing types)
DO $$ 
BEGIN
  -- Create transcription_status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transcription_status') THEN
    CREATE TYPE transcription_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');
  END IF;
  
  -- Create intent_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intent_type') THEN
    CREATE TYPE intent_type AS ENUM (
      'create_job',
      'update_job',
      'job_query',
      'navigation',
      'equipment_check',
      'material_request',
      'time_entry',
      'photo_capture',
      'note_taking',
      'help_request',
      'confirmation',
      'cancellation',
      'unknown'
    );
  END IF;
  
  -- Create media_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document', 'signature');
  END IF;
  
  -- Create vision_verification_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vision_verification_type') THEN
    CREATE TYPE vision_verification_type AS ENUM ('before_photo', 'after_photo', 'issue_photo', 'equipment_scan', 'material_scan', 'document_scan');
  END IF;
END $$;

-- Voice transcripts table
CREATE TABLE voice_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID REFERENCES user_sessions(id),
  job_id UUID REFERENCES jobs(id),
  audio_url TEXT,
  audio_duration NUMERIC(10,2), -- seconds
  transcript TEXT,
  confidence_score NUMERIC(5,4),
  status transcription_status DEFAULT 'pending',
  language_code VARCHAR(10) DEFAULT 'en-US',
  provider VARCHAR(50), -- 'openai', 'google', 'aws', etc.
  provider_transcript_id VARCHAR(255),
  cost NUMERIC(10,4),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Intent recognitions table
CREATE TABLE intent_recognitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transcript_id UUID NOT NULL REFERENCES voice_transcripts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  intent_type intent_type,
  confidence_score NUMERIC(5,4),
  entities JSONB, -- extracted entities like job_number, customer_name, etc.
  context JSONB, -- conversation context
  action_taken JSONB, -- what action was performed
  success BOOLEAN,
  error_message TEXT,
  feedback_given BOOLEAN DEFAULT false,
  feedback_score INTEGER,
  provider VARCHAR(50),
  cost NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media assets table
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  media_type media_type NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER, -- bytes
  mime_type VARCHAR(100),
  storage_path TEXT NOT NULL,
  public_url TEXT,
  thumbnail_url TEXT,
  
  -- Associations
  job_id UUID REFERENCES jobs(id),
  customer_id UUID REFERENCES customers(id),
  property_id UUID REFERENCES properties(id),
  equipment_id UUID REFERENCES equipment(id),
  
  -- Voice metadata
  voice_transcript_id UUID REFERENCES voice_transcripts(id),
  voice_description TEXT, -- AI-generated description for accessibility
  
  -- Vision metadata
  vision_analysis JSONB, -- AI vision analysis results
  ocr_text TEXT, -- extracted text from images
  
  -- General metadata
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vision verifications table (for before/after photos, equipment checks)
CREATE TABLE vision_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),
  media_asset_id UUID NOT NULL REFERENCES media_assets(id),
  verification_type vision_verification_type NOT NULL,
  verified_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- AI verification results
  ai_verified BOOLEAN,
  ai_confidence NUMERIC(5,4),
  ai_findings JSONB,
  ai_provider VARCHAR(50),
  ai_cost NUMERIC(10,4),
  
  -- Manual verification
  manual_verified BOOLEAN,
  manual_notes TEXT,
  
  -- Voice annotation
  voice_annotation_id UUID REFERENCES voice_transcripts(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation sessions table (for tracking voice conversations)
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  
  -- Context
  job_id UUID REFERENCES jobs(id),
  customer_id UUID REFERENCES customers(id),
  property_id UUID REFERENCES properties(id),
  
  -- Session data
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  wake_word_count INTEGER DEFAULT 0,
  turn_count INTEGER DEFAULT 0,
  
  -- Conversation state
  current_context JSONB DEFAULT '{}'::jsonb,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  pending_confirmations JSONB DEFAULT '[]'::jsonb,
  
  -- Analytics
  total_duration INTEGER, -- seconds
  active_duration INTEGER, -- seconds of actual talking
  intent_success_rate NUMERIC(5,4),
  user_satisfaction_score INTEGER,
  
  -- Cost tracking
  total_stt_cost NUMERIC(10,4) DEFAULT 0,
  total_llm_cost NUMERIC(10,4) DEFAULT 0,
  total_tts_cost NUMERIC(10,4) DEFAULT 0,
  
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Request deduplication table (prevent duplicate voice commands)
CREATE TABLE request_deduplication (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  request_hash VARCHAR(64) NOT NULL, -- SHA256 of normalized request
  request_type VARCHAR(50) NOT NULL,
  request_data JSONB NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  was_executed BOOLEAN DEFAULT false,
  execution_result JSONB,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  UNIQUE(tenant_id, user_id, request_hash)
);

-- AI cost tracking table
CREATE TABLE ai_cost_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  service_type VARCHAR(50) NOT NULL, -- 'stt', 'llm', 'tts', 'vision'
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100),
  
  -- Usage metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  audio_seconds NUMERIC(10,2),
  image_count INTEGER,
  
  -- Cost
  unit_cost NUMERIC(10,6),
  total_cost NUMERIC(10,4),
  
  -- References
  voice_transcript_id UUID REFERENCES voice_transcripts(id),
  intent_recognition_id UUID REFERENCES intent_recognitions(id),
  vision_verification_id UUID REFERENCES vision_verifications(id),
  media_asset_id UUID REFERENCES media_assets(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_voice_transcripts_tenant_user ON voice_transcripts(tenant_id, user_id);
CREATE INDEX idx_voice_transcripts_job ON voice_transcripts(job_id);
CREATE INDEX idx_voice_transcripts_status ON voice_transcripts(status);
CREATE INDEX idx_voice_transcripts_created ON voice_transcripts(created_at);

CREATE INDEX idx_intent_recognitions_transcript ON intent_recognitions(transcript_id);
CREATE INDEX idx_intent_recognitions_type ON intent_recognitions(intent_type);
CREATE INDEX idx_intent_recognitions_user ON intent_recognitions(user_id);

CREATE INDEX idx_media_assets_tenant ON media_assets(tenant_id);
CREATE INDEX idx_media_assets_job ON media_assets(job_id);
CREATE INDEX idx_media_assets_type ON media_assets(media_type);

CREATE INDEX idx_vision_verifications_job ON vision_verifications(job_id);
CREATE INDEX idx_vision_verifications_type ON vision_verifications(verification_type);

CREATE INDEX idx_conversation_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_conversation_sessions_active ON conversation_sessions(is_active);
CREATE INDEX idx_conversation_sessions_job ON conversation_sessions(job_id);

CREATE INDEX idx_request_dedup_hash ON request_deduplication(request_hash);
CREATE INDEX idx_request_dedup_expires ON request_deduplication(expires_at);

CREATE INDEX idx_ai_cost_tenant_date ON ai_cost_tracking(tenant_id, created_at);
CREATE INDEX idx_ai_cost_user_service ON ai_cost_tracking(user_id, service_type);

-- Add updated_at trigger for media_assets
CREATE TRIGGER update_media_assets_updated_at BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_deduplication ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's voice transcripts" ON voice_transcripts
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can create voice transcripts for their tenant" ON voice_transcripts
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can view their tenant's intent recognitions" ON intent_recognitions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their tenant's media assets" ON media_assets
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can upload media for their tenant" ON media_assets
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can view their tenant's vision verifications" ON vision_verifications
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their own conversation sessions" ON conversation_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own conversation sessions" ON conversation_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own request deduplication" ON request_deduplication
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own request deduplication" ON request_deduplication
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their tenant's AI costs" ON ai_cost_tracking
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Function to clean up expired deduplication entries
CREATE OR REPLACE FUNCTION cleanup_expired_deduplication()
RETURNS void AS $$
BEGIN
  DELETE FROM request_deduplication WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension or external scheduler)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-dedup', '*/15 * * * *', 'SELECT cleanup_expired_deduplication();');