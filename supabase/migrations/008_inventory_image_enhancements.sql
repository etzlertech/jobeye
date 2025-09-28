-- Migration: 008_inventory_image_enhancements.sql
-- Purpose: Add metadata needed for inventory reference imagery (cropping, capture context)

ALTER TABLE inventory_images
  ADD COLUMN IF NOT EXISTS aspect_ratio NUMERIC(5,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS original_width INT,
  ADD COLUMN IF NOT EXISTS original_height INT,
  ADD COLUMN IF NOT EXISTS crop_box JSONB,
  ADD COLUMN IF NOT EXISTS captured_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure crop_box stays normalized between 0 and 1 if provided
ALTER TABLE inventory_images
  ADD CONSTRAINT inventory_images_crop_box_valid
  CHECK (
    crop_box IS NULL
    OR (
      (crop_box ? 'x') AND (crop_box ? 'y') AND (crop_box ? 'width') AND (crop_box ? 'height')
      AND (crop_box->>'x')::NUMERIC >= 0
      AND (crop_box->>'y')::NUMERIC >= 0
      AND (crop_box->>'width')::NUMERIC > 0
      AND (crop_box->>'height')::NUMERIC > 0
      AND (crop_box->>'x')::NUMERIC <= 1
      AND (crop_box->>'y')::NUMERIC <= 1
      AND (crop_box->>'width')::NUMERIC <= 1
      AND (crop_box->>'height')::NUMERIC <= 1
    )
  );

-- Index for faster lookups when listing gallery items per inventory object
CREATE INDEX IF NOT EXISTS idx_inventory_images_item_lookup
  ON inventory_images (item_type, item_id, is_primary DESC, created_at DESC);
