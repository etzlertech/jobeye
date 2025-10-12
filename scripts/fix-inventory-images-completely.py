#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    exit(1)

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# First, check what inventory_images table exists (if any)
check_sql = """
SELECT 
    t.table_name,
    array_agg(c.column_name ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public' 
  AND t.table_name = 'inventory_images'
GROUP BY t.table_name;
"""

print("Checking existing inventory_images table...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": check_sql}
)

existing_table = None
if response.status_code == 200:
    result = response.json()
    if result:
        existing_table = result[0]
        print(f"Found existing table with columns: {', '.join(existing_table['columns'])}")
    else:
        print("No inventory_images table found")

# Check if this is the OCR table (has file_path column)
if existing_table and 'file_path' in existing_table['columns']:
    print("\n⚠️  The existing inventory_images table is for OCR/documents!")
    print("We need to rename it and create a new one for item images.")
    
    # Rename the OCR table
    rename_sql = """
    -- Rename the OCR inventory_images table to avoid confusion
    ALTER TABLE IF EXISTS inventory_images RENAME TO ocr_document_images;
    
    -- Update any indexes
    ALTER INDEX IF EXISTS idx_inventory_images_item RENAME TO idx_ocr_document_images_item;
    """
    
    print("\nRenaming OCR table to ocr_document_images...")
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": rename_sql}
    )
    
    if response.status_code in [200, 204]:
        print("✅ Renamed OCR table successfully")
    else:
        print(f"❌ Error renaming table: {response.text}")

# Now create the proper inventory_images table for item images
create_sql = """
-- Drop the table if it exists (clean slate)
DROP TABLE IF EXISTS inventory_images CASCADE;

-- Create the proper inventory_images table for item images
CREATE TABLE inventory_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material')),
  item_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  angle TEXT,
  aspect_ratio NUMERIC(5,2) DEFAULT 1.0,
  original_width INT,
  original_height INT,
  crop_box JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  captured_by UUID,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add foreign key to items table
  CONSTRAINT fk_inventory_images_item
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Add crop box validation
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

-- Create indexes
CREATE INDEX idx_inventory_images_item ON inventory_images(item_type, item_id);
CREATE INDEX idx_inventory_images_item_lookup
  ON inventory_images (item_type, item_id, is_primary DESC, created_at DESC);
CREATE INDEX idx_inventory_images_tenant ON inventory_images(tenant_id);

-- Enable RLS
ALTER TABLE inventory_images ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
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

-- Add comments
COMMENT ON TABLE inventory_images IS 'Stores reference images for inventory items (equipment and materials)';
COMMENT ON COLUMN inventory_images.is_primary IS 'Whether this is the primary image for the item';
COMMENT ON COLUMN inventory_images.thumbnail_url IS 'URL for thumbnail version of the image';
"""

print("\nCreating proper inventory_images table...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": create_sql}
)

if response.status_code in [200, 204]:
    print("✅ Created inventory_images table successfully")
else:
    print(f"❌ Error creating table: {response.status_code}")
    print(response.text)

# Now apply the sync triggers
print("\nApplying sync triggers...")
with open('/Users/travisetzler/Documents/GitHub/jobeye/supabase/migrations/20251012_add_inventory_image_sync_trigger.sql', 'r') as f:
    trigger_sql = f.read()

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": trigger_sql}
)

if response.status_code in [200, 204]:
    print("✅ Applied sync triggers successfully")
else:
    print(f"❌ Error applying triggers: {response.status_code}")
    print(response.text)

# Verify the final setup
print("\nVerifying final setup...")

verify_sql = """
SELECT 
    'Table Structure' as check_type,
    COUNT(*) as result
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'inventory_images'
  AND column_name IN ('id', 'tenant_id', 'item_type', 'item_id', 'image_url', 'is_primary')
  
UNION ALL

SELECT 
    'Triggers' as check_type,
    COUNT(*) as result
FROM pg_trigger
WHERE tgrelid = 'inventory_images'::regclass
  AND tgname LIKE 'sync_inventory_image%';
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": verify_sql}
)

if response.status_code == 200:
    results = response.json()
    print("\nVerification results:")
    for result in results:
        print(f"  - {result['check_type']}: {result['result']} {'✅' if result['result'] > 0 else '❌'}")

print("\n✅ Setup complete! The inventory_images table is now properly configured.")
print("\nNext steps:")
print("1. When images are uploaded, they should be stored in inventory_images table")
print("2. Primary images will automatically sync to items.primary_image_url")
print("3. Use the service client (not regular client) to bypass RLS when needed")