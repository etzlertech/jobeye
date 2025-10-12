#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv
from datetime import datetime
import uuid

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

# Use the REST API directly for better error handling
print("Finding a test item...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?select=id,name,tenant_id,primary_image_url&name=ilike.*test*&limit=1",
    headers=headers
)

if response.status_code == 200 and response.json():
    item = response.json()[0]
    print(f"Found existing item: {item['name']} (ID: {item['id']})")
    print(f"Current primary_image_url: {item.get('primary_image_url', 'None')}")
else:
    print("No test item found. Creating one...")
    
    # Create a test item using REST API
    test_item = {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "item_type": "equipment",
        "category": "test",
        "tracking_mode": "individual",
        "name": f"Test Item for Image Sync {datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "description": "This item is for testing image sync functionality",
        "status": "active"
    }
    
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/items",
        headers=headers,
        json=test_item
    )
    
    if response.status_code == 201:
        item = response.json()
        print(f"✅ Created test item: {item['name']} (ID: {item['id']})")
    else:
        print(f"❌ Error creating test item: {response.status_code}")
        print(response.text)
        exit(1)

# Now insert a test image for this item
test_image = {
    "tenant_id": item['tenant_id'],
    "item_type": "equipment",
    "item_id": item['id'],
    "image_url": f"https://example.com/test-image-{datetime.now().timestamp()}.jpg",
    "thumbnail_url": f"https://example.com/test-image-{datetime.now().timestamp()}-thumb.jpg",
    "is_primary": True,
    "aspect_ratio": 1.5,
    "original_width": 1024,
    "original_height": 768,
    "metadata": {"test": True, "timestamp": datetime.now().isoformat()}
}

print("\nInserting test image...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/inventory_images",
    headers=headers,
    json=test_image
)

if response.status_code == 201:
    image = response.json()
    print(f"✅ Created test image: {image['image_url']} (Primary: {image['is_primary']})")
    image_id = image['id']
else:
    print(f"❌ Error creating test image: {response.status_code}")
    print(response.text)
    exit(1)

# Wait a moment for the trigger to execute
import time
time.sleep(1)

# Check if the sync worked
print("\nChecking if sync worked...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?id=eq.{item['id']}&select=id,name,primary_image_url,thumbnail_url",
    headers=headers
)

if response.status_code == 200 and response.json():
    synced_item = response.json()[0]
    print(f"\nItem: {synced_item['name']}")
    print(f"  primary_image_url: {synced_item.get('primary_image_url', 'None')}")
    print(f"  thumbnail_url: {synced_item.get('thumbnail_url', 'None')}")
    print(f"  Expected image_url: {test_image['image_url']}")
    
    if synced_item.get('primary_image_url') == test_image['image_url']:
        print("\n✅ SUCCESS! The trigger is working - images are synced!")
    else:
        print("\n❌ FAILED! The images are not synced.")
        print("The trigger might not be working correctly.")
        
        # Check if the trigger exists
        print("\nChecking triggers...")
        check_sql = "SELECT tgname FROM pg_trigger WHERE tgrelid = 'inventory_images'::regclass;"
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"sql": check_sql}
        )
        if response.status_code == 200:
            triggers = response.json()
            if triggers:
                print("Triggers found:", [t['tgname'] for t in triggers])
            else:
                print("No triggers found on inventory_images table!")

# Test updating is_primary to false
print("\n\nTesting removal of primary flag...")
response = requests.patch(
    f"{SUPABASE_URL}/rest/v1/inventory_images?id=eq.{image_id}",
    headers=headers,
    json={"is_primary": False}
)

if response.status_code in [200, 204]:
    time.sleep(1)
    
    # Check if primary_image_url was cleared
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/items?id=eq.{item['id']}&select=primary_image_url",
        headers=headers
    )
    
    if response.status_code == 200 and response.json():
        result = response.json()[0]
        if result['primary_image_url'] is None:
            print("✅ Removing primary flag correctly cleared the item's primary_image_url")
        else:
            print("❌ primary_image_url was not cleared when primary flag was removed")

# Clean up - delete test image
print("\nCleaning up test data...")
response = requests.delete(
    f"{SUPABASE_URL}/rest/v1/inventory_images?id=eq.{image_id}",
    headers=headers
)

if response.status_code in [200, 204]:
    print("✅ Test image deleted")

print("\n✅ Test complete!")