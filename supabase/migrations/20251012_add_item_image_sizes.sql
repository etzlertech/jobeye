-- Add thumbnail and medium image URL columns to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS medium_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN items.thumbnail_url IS 'URL for 32x32 thumbnail image (~5KB)';
COMMENT ON COLUMN items.medium_url IS 'URL for 256x256 medium image (~50KB)';
COMMENT ON COLUMN items.primary_image_url IS 'URL for 1024x1024 full image (~500KB max)';