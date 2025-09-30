-- Migration: 043_vision_extend_existing
-- Purpose: Add missing columns to existing vision_verifications table
-- Date: 2025-09-29
-- Feature: Vision-Based Kit Verification (001)
-- Reference: DB_PRECHECK_FINDINGS.md - Option A (extend existing schema)
--
-- IMPORTANT: This migration extends the EXISTING vision_verifications table
-- that uses tenant_id, verified_by, media_asset_id (not company_id, technician_id, photo_storage_path).
-- We're adding columns needed for kit verification without breaking existing functionality.

-- Add kit_id column (link to kits table for kit verification)
ALTER TABLE vision_verifications
  ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES kits(id);

-- Add container_id column (track which container items are in)
-- Note: containers table may not exist yet - using TEXT as fallback
ALTER TABLE vision_verifications
  ADD COLUMN IF NOT EXISTS container_id TEXT;

-- Add detection counts (summary stats)
ALTER TABLE vision_verifications
  ADD COLUMN IF NOT EXISTS detected_items_count INTEGER DEFAULT 0;

ALTER TABLE vision_verifications
  ADD COLUMN IF NOT EXISTS missing_items_count INTEGER DEFAULT 0;

-- Add processing duration (performance tracking)
ALTER TABLE vision_verifications
  ADD COLUMN IF NOT EXISTS processing_duration_ms INTEGER;

-- Add updated_at timestamp (audit trail)
ALTER TABLE vision_verifications
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_vision_verifications_kit ON vision_verifications(kit_id)
  WHERE kit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vision_verifications_container ON vision_verifications(container_id)
  WHERE container_id IS NOT NULL;

-- Add index to job_kits.verification_method (from plan.md)
CREATE INDEX IF NOT EXISTS idx_job_kits_verification ON job_kits(verification_method, verified_at);

-- Add helpful comments for new columns
COMMENT ON COLUMN vision_verifications.kit_id IS 'Reference to kit being verified (for kit verification workflow)';
COMMENT ON COLUMN vision_verifications.container_id IS 'Container where items were detected (truck, trailer, bin)';
COMMENT ON COLUMN vision_verifications.detected_items_count IS 'Total number of items detected by YOLO/VLM';
COMMENT ON COLUMN vision_verifications.missing_items_count IS 'Number of required kit items NOT detected';
COMMENT ON COLUMN vision_verifications.processing_duration_ms IS 'Total processing time from photo capture to result';

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_vision_verifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vision_verifications_updated ON vision_verifications;
CREATE TRIGGER vision_verifications_updated
  BEFORE UPDATE ON vision_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_vision_verifications_timestamp();

-- Create view to map existing fields to plan.md naming convention
-- This allows repository layer to use consistent naming (company_id, technician_id, etc.)
CREATE OR REPLACE VIEW vision_verification_records AS
SELECT
  id,
  tenant_id as company_id,  -- Map tenant_id → company_id
  verified_by as technician_id,  -- Map verified_by → technician_id
  kit_id,
  job_id,
  container_id,
  media_asset_id,  -- Keep for FK to media_assets.file_path
  verification_type,
  ai_verified,
  ai_confidence as confidence_score,
  ai_findings,
  ai_provider,
  ai_cost,
  manual_verified,
  manual_notes,
  voice_annotation_id,
  detected_items_count,
  missing_items_count,
  processing_duration_ms,
  created_at,
  updated_at
FROM vision_verifications;

COMMENT ON VIEW vision_verification_records IS 'Compatibility view mapping vision_verifications to plan.md naming conventions';