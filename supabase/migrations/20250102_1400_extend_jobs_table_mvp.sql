-- Migration: Extend jobs table for MVP Intent-Driven features
-- Feature: 007-mvp-intent-driven
-- Purpose: Add columns for intent-driven workflows and mobile app features

-- Add new columns to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS voice_instructions TEXT,
ADD COLUMN IF NOT EXISTS voice_instructions_audio_url TEXT,
ADD COLUMN IF NOT EXISTS load_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS load_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS load_verification_method TEXT CHECK (load_verification_method IN ('ai_vision', 'manual', 'voice')),
ADD COLUMN IF NOT EXISTS start_photo_url TEXT,
ADD COLUMN IF NOT EXISTS completion_photo_url TEXT,
ADD COLUMN IF NOT EXISTS assigned_by_intent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS intent_metadata JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_load_verified ON jobs(tenant_id, load_verified) WHERE load_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_voice_instructions ON jobs(tenant_id) WHERE voice_instructions IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_by_intent ON jobs(tenant_id, assigned_by_intent) WHERE assigned_by_intent = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN jobs.voice_instructions IS 'Text version of special instructions provided via voice';
COMMENT ON COLUMN jobs.voice_instructions_audio_url IS 'URL to audio file of voice instructions';
COMMENT ON COLUMN jobs.load_verified IS 'Whether equipment load has been verified';
COMMENT ON COLUMN jobs.load_verified_at IS 'Timestamp when load was verified';
COMMENT ON COLUMN jobs.load_verification_method IS 'Method used to verify load: ai_vision, manual, or voice';
COMMENT ON COLUMN jobs.start_photo_url IS 'Photo taken at job start for verification';
COMMENT ON COLUMN jobs.completion_photo_url IS 'Photo taken at job completion for verification';
COMMENT ON COLUMN jobs.assigned_by_intent IS 'Whether job was created/assigned via intent-driven UI';
COMMENT ON COLUMN jobs.intent_metadata IS 'Metadata from intent classification system';

-- Update RLS policies to include new columns
-- No changes needed to existing policies as they already cover all columns

-- Create trigger to auto-set load_verified_at when load_verified changes to true
CREATE OR REPLACE FUNCTION set_load_verified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.load_verified = TRUE AND OLD.load_verified = FALSE THEN
        NEW.load_verified_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_load_verified_timestamp ON jobs;
CREATE TRIGGER trigger_set_load_verified_timestamp
BEFORE UPDATE ON jobs
FOR EACH ROW
WHEN (NEW.load_verified IS DISTINCT FROM OLD.load_verified)
EXECUTE FUNCTION set_load_verified_timestamp();