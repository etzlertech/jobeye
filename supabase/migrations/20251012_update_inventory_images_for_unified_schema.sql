-- Migration: Update inventory_images table for unified schema compatibility
-- Purpose: Align inventory_images with the new unified inventory schema using tenant_id
-- Date: 2025-10-12

-- First, check if the table exists with the old schema
DO $$
BEGIN
    -- Check if inventory_images exists with company_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_images' 
        AND column_name = 'company_id'
    ) THEN
        -- Rename company_id to tenant_id to match new schema
        ALTER TABLE inventory_images RENAME COLUMN company_id TO tenant_id;
        
        -- Update the foreign key constraint
        ALTER TABLE inventory_images 
        DROP CONSTRAINT IF EXISTS inventory_images_company_id_fkey;
        
        -- Note: We're not adding a foreign key to tenants table as it might not exist
        -- The application will handle tenant validation
    END IF;
    
    -- Add missing columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_images' 
        AND column_name = 'thumbnail_url'
    ) THEN
        ALTER TABLE inventory_images ADD COLUMN thumbnail_url TEXT;
    END IF;
    
    -- Ensure all columns from migration 008 are present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_images' 
        AND column_name = 'aspect_ratio'
    ) THEN
        ALTER TABLE inventory_images
          ADD COLUMN aspect_ratio NUMERIC(5,2) DEFAULT 1.0,
          ADD COLUMN original_width INT,
          ADD COLUMN original_height INT,
          ADD COLUMN crop_box JSONB,
          ADD COLUMN captured_by UUID,
          ADD COLUMN captured_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Ensure crop_box constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_images_crop_box_valid'
    ) THEN
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
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_inventory_images_item ON inventory_images(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_images_item_lookup
  ON inventory_images (item_type, item_id, is_primary DESC, created_at DESC);

-- Update RLS policies to use tenant_id instead of company_id
ALTER TABLE inventory_images ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS inventory_images_company_isolation ON inventory_images;

-- Create new tenant-based RLS policy
CREATE POLICY inventory_images_tenant_isolation ON inventory_images
FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_assignments 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM tenant_assignments 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- Grant permissions
GRANT ALL ON inventory_images TO authenticated;

-- Add helpful comments
COMMENT ON TABLE inventory_images IS 'Stores reference images for inventory items (equipment and materials)';
COMMENT ON COLUMN inventory_images.tenant_id IS 'Tenant ID for multi-tenancy';
COMMENT ON COLUMN inventory_images.item_type IS 'Type of inventory item (equipment or material)';
COMMENT ON COLUMN inventory_images.item_id IS 'UUID of the item in the items table';
COMMENT ON COLUMN inventory_images.is_primary IS 'Whether this is the primary image for the item';
COMMENT ON COLUMN inventory_images.thumbnail_url IS 'URL for thumbnail version of the image';
COMMENT ON COLUMN inventory_images.crop_box IS 'Normalized crop box coordinates (0-1 range)';