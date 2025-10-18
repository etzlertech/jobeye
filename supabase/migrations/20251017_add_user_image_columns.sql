-- Migration: Add user profile image columns
-- Date: 2025-10-17
-- Purpose: Add three image URL columns to users_extended table to match pattern used by items, properties, customers, and jobs
-- Related: User Management with Profile Images feature

-- Add image columns to users_extended
ALTER TABLE users_extended
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT;

-- Add indexes for better query performance when filtering/sorting by image presence
CREATE INDEX IF NOT EXISTS idx_users_extended_primary_image_url ON users_extended(primary_image_url) WHERE primary_image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_extended_thumbnail_url ON users_extended(thumbnail_url) WHERE thumbnail_url IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN users_extended.primary_image_url IS 'Full resolution profile image URL (800x800px square crop)';
COMMENT ON COLUMN users_extended.thumbnail_url IS 'Thumbnail profile image URL (150x150px square crop) - used in lists and dropdowns';
COMMENT ON COLUMN users_extended.medium_url IS 'Medium profile image URL (400x400px square crop) - used in detail views';
COMMENT ON COLUMN users_extended.avatar_url IS 'Legacy avatar URL - kept for backward compatibility, consider using primary_image_url instead';

-- Note: avatar_url already exists and is kept for backward compatibility
-- New code should use primary_image_url, thumbnail_url, and medium_url
