-- Migration: 007_job_checklist_auto_override.sql
-- Purpose: Add auto verification tracking and manual override metadata to job checklist items

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS auto_status TEXT CHECK (auto_status IN (
    'pending',
    'loaded',
    'verified',
    'missing',
    'wrong_container',
    'low_confidence'
  )) DEFAULT 'pending';

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS auto_confidence NUMERIC(5,4);

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS auto_verified_at TIMESTAMPTZ;

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS last_verification_id UUID REFERENCES load_verifications(id);

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS manual_override_status TEXT CHECK (manual_override_status IN (
    'pending',
    'loaded',
    'verified',
    'missing'
  ));

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS manual_override_reason TEXT;

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS manual_override_by UUID REFERENCES auth.users(id);

ALTER TABLE job_checklist_items
  ADD COLUMN IF NOT EXISTS manual_override_at TIMESTAMPTZ;
