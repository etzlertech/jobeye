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

# Check if there's a trigger for syncing images
trigger_check_sql = """
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgrelid::regclass::text IN ('inventory_images', 'items')
ORDER BY tgrelid::regclass::text, tgname;
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": trigger_check_sql}
)

print("Checking for triggers on inventory_images and items tables:")
if response.status_code == 204:
    print("No triggers found")
elif response.status_code == 200:
    result = response.json()
    if result:
        for row in result:
            print(f"- {row['trigger_name']} on {row['table_name']} -> {row['function_name']}")
    else:
        print("No triggers found")
else:
    print(f"Error: {response.status_code}")
    print(response.text)

# Check if there's a function that updates items table
function_check_sql = """
SELECT 
    proname AS function_name,
    pg_get_functiondef(oid) AS definition
FROM pg_proc 
WHERE proname LIKE '%image%' 
   OR proname LIKE '%item%image%'
   OR pg_get_functiondef(oid) LIKE '%primary_image_url%'
ORDER BY proname;
"""

print("\nChecking for functions that might update item images:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": function_check_sql}
)

if response.status_code == 200:
    result = response.json()
    if result:
        for row in result:
            if 'primary_image' in row['definition'].lower():
                print(f"\n- Function: {row['function_name']}")
                print("  (Contains reference to primary_image)")
    else:
        print("No relevant functions found")

# Check RLS policies on items table
rls_check_sql = """
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'items' 
ORDER BY policyname;
"""

print("\n\nChecking RLS policies on items table:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": rls_check_sql}
)

if response.status_code == 200:
    result = response.json()
    if result:
        for row in result:
            print(f"\n- Policy: {row['policyname']}")
            print(f"  Command: {row['cmd']}")
            print(f"  Permissive: {row['permissive']}")
            if row['qual']:
                print(f"  USING: {row['qual'][:100]}...")
            if row['with_check']:
                print(f"  WITH CHECK: {row['with_check'][:100]}...")
    else:
        print("No RLS policies found on items table")

# Check for any image-related columns in both tables
schema_check_sql = """
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public' 
    AND c.table_name IN ('items', 'inventory_images')
    AND (c.column_name LIKE '%image%' OR c.column_name LIKE '%url%')
ORDER BY c.table_name, c.ordinal_position;
"""

print("\n\nChecking image-related columns in items and inventory_images tables:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": schema_check_sql}
)

if response.status_code == 200:
    result = response.json()
    current_table = None
    for row in result:
        if row['table_name'] != current_table:
            current_table = row['table_name']
            print(f"\n{current_table}:")
        print(f"  - {row['column_name']} ({row['data_type']}, {'NULL' if row['is_nullable'] == 'YES' else 'NOT NULL'})")

# Check if items are being updated with image URLs
recent_items_check = """
SELECT 
    id,
    name,
    primary_image_url,
    thumbnail_url,
    medium_url,
    image_urls,
    updated_at
FROM items
WHERE primary_image_url IS NOT NULL 
   OR thumbnail_url IS NOT NULL
   OR medium_url IS NOT NULL
   OR image_urls IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;
"""

print("\n\nChecking recent items with image URLs:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": recent_items_check}
)

if response.status_code == 200:
    result = response.json()
    if result:
        for row in result:
            print(f"\n- Item: {row['name']} (ID: {row['id']})")
            if row['primary_image_url']:
                print(f"  Primary: {row['primary_image_url'][:50]}...")
            if row['thumbnail_url']:
                print(f"  Thumbnail: {row['thumbnail_url'][:50]}...")
            if row['image_urls']:
                print(f"  Images array: {len(row['image_urls'])} images")
    else:
        print("No items found with image URLs")

# Check inventory_images entries
inventory_images_check = """
SELECT 
    ii.id,
    ii.item_type,
    ii.item_id,
    ii.image_url,
    ii.is_primary,
    ii.created_at,
    i.name as item_name,
    i.primary_image_url as item_primary_url
FROM inventory_images ii
LEFT JOIN items i ON i.id = ii.item_id::uuid
ORDER BY ii.created_at DESC
LIMIT 10;
"""

print("\n\nChecking recent inventory_images entries and their corresponding items:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": inventory_images_check}
)

if response.status_code == 200:
    result = response.json()
    if result:
        for row in result:
            print(f"\n- Inventory Image: {row['id']}")
            print(f"  Item: {row['item_name']} ({row['item_id']})")
            print(f"  Type: {row['item_type']}, Primary: {row['is_primary']}")
            print(f"  Image URL: {row['image_url'][:50] if row['image_url'] else 'None'}...")
            print(f"  Item's primary_image_url: {'Set' if row['item_primary_url'] else 'NOT SET'}")
    else:
        print("No inventory_images found")