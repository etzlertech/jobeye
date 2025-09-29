-- Migration: 006_load_verification_media_nullable.sql
-- Purpose: Allow load_verifications.media_id to be nullable for synthesized frames

ALTER TABLE load_verifications
  ALTER COLUMN media_id DROP NOT NULL;
