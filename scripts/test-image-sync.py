#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv
from datetime import datetime

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

# Find a test item to work with
find_item_sql = """
SELECT id, name, tenant_id, primary_image_url
FROM items 
WHERE name LIKE '%test%' OR name LIKE '%stest%'
LIMIT 1;
"""

print("Finding a test item...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": find_item_sql}
)

if response.status_code != 200 or not response.json():
    print("No test item found. Creating one...")
    
    # Create a test item
    create_item_sql = """
    INSERT INTO items (
        tenant_id, 
        item_type, 
        category, 
        tracking_mode,
        name,
        description,
        status
    ) VALUES (
        '11111111-1111-1111-1111-111111111111'::uuid, -- demo tenant
        'equipment',
        'test',
        'individual',
        'Test Item for Image Sync',
        'This item is for testing image sync functionality',
        'active'
    )
    RETURNING id, name, tenant_id;
    """
    
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": create_item_sql}
    )
    
    if response.status_code == 200:
        item = response.json()[0]
        print(f"✅ Created test item: {item['name']} (ID: {item['id']})")
    else:
        print(f"❌ Error creating test item: {response.text}")
        exit(1)
else:
    item = response.json()[0]
    print(f"Found existing item: {item['name']} (ID: {item['id']})")
    print(f"Current primary_image_url: {item.get('primary_image_url', 'None')}")

# Now insert a test image for this item
test_image_sql = f"""
INSERT INTO inventory_images (
    tenant_id,
    item_type,
    item_id,
    image_url,
    thumbnail_url,
    is_primary,
    aspect_ratio,
    original_width,
    original_height,
    metadata
) VALUES (
    '{item['tenant_id']}'::uuid,
    'equipment',
    '{item['id']}'::uuid,
    'https://example.com/test-image-{datetime.now().timestamp()}.jpg',
    'https://example.com/test-image-{datetime.now().timestamp()}-thumb.jpg',
    true,
    1.5,
    1024,
    768,
    '{{"test": true, "timestamp": "{datetime.now().isoformat()}"}}'::jsonb
)
RETURNING id, image_url, is_primary;
"""

print("\nInserting test image...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": test_image_sql}
)

if response.status_code == 200:
    image = response.json()[0]
    print(f"✅ Created test image: {image['image_url']} (Primary: {image['is_primary']})")
else:
    print(f"❌ Error creating test image: {response.text}")
    exit(1)

# Check if the sync worked
check_sync_sql = f"""
SELECT 
    i.id,
    i.name,
    i.primary_image_url,
    i.thumbnail_url,
    ii.image_url as inventory_image_url,
    ii.thumbnail_url as inventory_thumbnail_url,
    ii.is_primary
FROM items i
LEFT JOIN inventory_images ii ON i.id = ii.item_id
WHERE i.id = '{item['id']}'::uuid;
"""

print("\nChecking if sync worked...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": check_sync_sql}
)

if response.status_code == 200:
    results = response.json()
    if results:
        result = results[0]
        print(f"\nItem: {result['name']}")
        print(f"  primary_image_url: {result['primary_image_url']}")
        print(f"  thumbnail_url: {result['thumbnail_url']}")
        print(f"  inventory_image_url: {result['inventory_image_url']}")
        print(f"  inventory_thumbnail_url: {result['inventory_thumbnail_url']}")
        
        if result['primary_image_url'] == result['inventory_image_url']:
            print("\n✅ SUCCESS! The trigger is working - images are synced!")
        else:
            print("\n❌ FAILED! The images are not synced.")
            print("The trigger might not be working correctly.")

# Test updating is_primary to false
print("\n\nTesting removal of primary flag...")
update_sql = f"""
UPDATE inventory_images 
SET is_primary = false 
WHERE item_id = '{item['id']}'::uuid;
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": update_sql}
)

if response.status_code in [200, 204]:
    # Check if primary_image_url was cleared
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": f"SELECT primary_image_url FROM items WHERE id = '{item['id']}'::uuid;"}
    )
    
    if response.status_code == 200:
        result = response.json()[0]
        if result['primary_image_url'] is None:
            print("✅ Removing primary flag correctly cleared the item's primary_image_url")
        else:
            print("❌ primary_image_url was not cleared when primary flag was removed")

print("\n✅ Test complete!")