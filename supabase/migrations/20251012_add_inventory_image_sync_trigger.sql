-- Migration: Add trigger to sync primary inventory images to items table
-- Purpose: Automatically update items.primary_image_url when inventory_images are marked as primary
-- Date: 2025-10-12

-- Create function to sync primary image to items table
CREATE OR REPLACE FUNCTION sync_primary_image_to_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if this is a primary image
  IF NEW.is_primary = true THEN
    -- Update the items table with the primary image URL
    UPDATE items
    SET 
      primary_image_url = NEW.image_url,
      -- Also update thumbnail if available
      thumbnail_url = NEW.thumbnail_url,
      updated_at = NOW()
    WHERE id = NEW.item_id::uuid
      AND (
        primary_image_url IS DISTINCT FROM NEW.image_url
        OR thumbnail_url IS DISTINCT FROM NEW.thumbnail_url
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
CREATE TRIGGER sync_inventory_image_insert
AFTER INSERT ON inventory_images
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION sync_primary_image_to_items();

-- Create trigger for UPDATE operations
CREATE TRIGGER sync_inventory_image_update
AFTER UPDATE ON inventory_images
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION sync_primary_image_to_items();

-- Function to handle when primary flag is removed
CREATE OR REPLACE FUNCTION clear_item_image_if_unprimary()
RETURNS TRIGGER AS $$
BEGIN
  -- If primary flag was removed (true -> false)
  IF OLD.is_primary = true AND NEW.is_primary = false THEN
    -- Check if there's another primary image
    IF NOT EXISTS (
      SELECT 1 FROM inventory_images 
      WHERE item_id = NEW.item_id 
        AND item_type = NEW.item_type
        AND is_primary = true
        AND id != NEW.id
    ) THEN
      -- No other primary image, clear the item's primary image
      UPDATE items
      SET 
        primary_image_url = NULL,
        thumbnail_url = NULL,
        updated_at = NOW()
      WHERE id = NEW.item_id::uuid;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for handling unprimary
CREATE TRIGGER sync_inventory_image_unprimary
AFTER UPDATE ON inventory_images
FOR EACH ROW
WHEN (OLD.is_primary = true AND NEW.is_primary = false)
EXECUTE FUNCTION clear_item_image_if_unprimary();

-- Function to handle deletion of primary images
CREATE OR REPLACE FUNCTION handle_primary_image_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- If deleting a primary image
  IF OLD.is_primary = true THEN
    -- Clear the item's primary image
    UPDATE items
    SET 
      primary_image_url = NULL,
      thumbnail_url = NULL,
      updated_at = NOW()
    WHERE id = OLD.item_id::uuid;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for DELETE operations
CREATE TRIGGER sync_inventory_image_delete
AFTER DELETE ON inventory_images
FOR EACH ROW
WHEN (OLD.is_primary = true)
EXECUTE FUNCTION handle_primary_image_deletion();

-- Run a one-time sync of existing primary images
UPDATE items i
SET 
  primary_image_url = ii.image_url,
  thumbnail_url = ii.thumbnail_url,
  updated_at = NOW()
FROM inventory_images ii
WHERE i.id = ii.item_id::uuid
  AND ii.is_primary = true
  AND (
    i.primary_image_url IS DISTINCT FROM ii.image_url
    OR i.thumbnail_url IS DISTINCT FROM ii.thumbnail_url
  );

-- Add comment for documentation
COMMENT ON FUNCTION sync_primary_image_to_items() IS 'Automatically syncs primary images from inventory_images to items table';
COMMENT ON FUNCTION clear_item_image_if_unprimary() IS 'Clears item primary image when no primary images remain';
COMMENT ON FUNCTION handle_primary_image_deletion() IS 'Clears item primary image when primary image is deleted';