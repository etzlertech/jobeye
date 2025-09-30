-- Migration: 040_vision_detected_items
-- Purpose: Create table for individual YOLO detection results
-- Date: 2025-09-29
-- Feature: Vision-Based Kit Verification (001)
-- Reference: DB_PRECHECK_FINDINGS.md - Option A (extend existing schema)
--
-- IMPORTANT: This migration extends the existing vision_verifications table
-- by creating a complementary table for detailed detection results.
-- The existing vision_verifications table (with tenant_id, media_asset_id, etc.)
-- is preserved and will be used as the primary verification record.

-- Create vision_detected_items table
CREATE TABLE IF NOT EXISTS vision_detected_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_id UUID NOT NULL REFERENCES vision_verifications(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,  -- e.g., 'mower', 'trimmer', 'blower'
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 1.00),
  bounding_box JSONB,  -- {x: number, y: number, width: number, height: number}
  matched_kit_item_id UUID REFERENCES kit_items(id),
  match_status TEXT NOT NULL CHECK (match_status IN ('matched', 'unmatched', 'uncertain')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vision_detected_items_verification ON vision_detected_items(verification_id);
CREATE INDEX IF NOT EXISTS idx_vision_detected_items_type ON vision_detected_items(item_type);
CREATE INDEX IF NOT EXISTS idx_vision_detected_items_kit_item ON vision_detected_items(matched_kit_item_id) WHERE matched_kit_item_id IS NOT NULL;

-- Add helpful comment
COMMENT ON TABLE vision_detected_items IS 'Individual object detections from YOLO inference, linked to vision_verifications';
COMMENT ON COLUMN vision_detected_items.bounding_box IS 'YOLO bounding box coordinates: {x, y, width, height}';
COMMENT ON COLUMN vision_detected_items.match_status IS 'Whether detected item matches a required kit item';