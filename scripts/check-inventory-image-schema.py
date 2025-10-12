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

# Check if the inventory_images table matches what the code expects
check_sql = """
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public' 
    AND c.table_name = 'inventory_images'
ORDER BY c.ordinal_position;
"""

print("Current inventory_images table structure:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": check_sql}
)

if response.status_code == 200:
    columns = response.json()
    if columns:
        for col in columns:
            print(f"  {col['column_name']} - {col['data_type']} ({'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'})")
    else:
        print("  Table not found or no columns")

# Check what the migration expects
expected_columns = [
    'id', 'item_type', 'item_id', 'image_url', 'thumbnail_url', 
    'is_primary', 'aspect_ratio', 'original_width', 'original_height',
    'crop_box', 'metadata', 'captured_by', 'captured_at', 'created_at'
]

print("\nExpected columns based on the code:")
for col in expected_columns:
    print(f"  - {col}")

# Look for the correct migration that creates the proper inventory_images table
print("\nChecking if we need to apply the proper inventory_images schema...")

# First, let's see if the table is actually for OCR (wrong table)
check_ocr_sql = """
SELECT COUNT(*) as count 
FROM inventory_images 
WHERE file_path IS NOT NULL AND file_path LIKE '%pdf%';
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": check_ocr_sql}
)

if response.status_code == 200:
    result = response.json()
    if result and result[0]['count'] > 0:
        print("\n⚠️  The current inventory_images table appears to be for OCR/documents, not item images!")
        print("We need to create or use a different table for item images.")