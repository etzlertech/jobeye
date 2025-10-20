-- Migration: Add load verification tracking columns to jobs table
-- Created: 2025-10-20
-- Description: Adds columns to track load verification status, timestamp, and method
--              Backfills from existing tool_reload_verified column

-- Add load verification tracking columns
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS load_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS load_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS load_verification_method TEXT CHECK (load_verification_method IN ('ai_vision', 'manual', 'voice'));

-- Create index for quick filtering of unverified jobs
CREATE INDEX IF NOT EXISTS idx_jobs_load_verified
  ON jobs(load_verified)
  WHERE load_verified = false;

-- Backfill from existing tool_reload_verified column
UPDATE jobs
SET load_verified = tool_reload_verified,
    load_verification_method = 'manual'
WHERE tool_reload_verified = true
  AND load_verified IS NULL;

-- Add column comments for documentation
COMMENT ON COLUMN jobs.load_verified IS 'Indicates if required items have been verified before job start';
COMMENT ON COLUMN jobs.load_verified_at IS 'Timestamp when load verification was completed';
COMMENT ON COLUMN jobs.load_verification_method IS 'Method used: ai_vision (VLM), manual (checklist), or voice (command)';
