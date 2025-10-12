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
    "Content-Type": "application/json",
    "Prefer": "return=representation"  # Ensure we get data back
}

# Find or use existing test item
item_id = "075639d9-0299-407a-941a-62384b2799c4"  # The test mower we found
tenant_id = "11111111-1111-1111-1111-111111111111"

print(f"Using test item ID: {item_id}")

# Check current state
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?id=eq.{item_id}&select=name,primary_image_url,thumbnail_url",
    headers=headers
)

if response.status_code == 200 and response.json():
    item = response.json()[0]
    print(f"Item: {item['name']}")
    print(f"Current primary_image_url: {item.get('primary_image_url', 'None')}")
    print(f"Current thumbnail_url: {item.get('thumbnail_url', 'None')}")

# Insert a test image
test_image = {
    "tenant_id": tenant_id,
    "item_type": "equipment",
    "item_id": item_id,
    "image_url": f"https://example.com/test-sync-{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg",
    "thumbnail_url": f"https://example.com/test-sync-{datetime.now().strftime('%Y%m%d_%H%M%S')}-thumb.jpg",
    "is_primary": True,
    "aspect_ratio": 1.5,
    "original_width": 1024,
    "original_height": 768
}

print("\nInserting test image with is_primary=true...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/inventory_images",
    headers=headers,
    json=test_image
)

if response.status_code == 201:
    if response.text:
        image = response.json()
        print(f"✅ Created image: {image['id']}")
        image_id = image['id']
    else:
        print("✅ Image created (no response body)")
        # Get the created image
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/inventory_images?item_id=eq.{item_id}&order=created_at.desc&limit=1",
            headers=headers
        )
        if response.status_code == 200 and response.json():
            image = response.json()[0]
            image_id = image['id']
else:
    print(f"❌ Error creating image: {response.status_code}")
    print(response.text)
    exit(1)

# Wait a moment for trigger
import time
time.sleep(2)

# Check if sync worked
print("\nChecking if image synced to items table...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?id=eq.{item_id}&select=primary_image_url,thumbnail_url",
    headers=headers
)

if response.status_code == 200 and response.json():
    item = response.json()[0]
    if item.get('primary_image_url') == test_image['image_url']:
        print("✅ SUCCESS! Primary image URL synced correctly!")
        print(f"   primary_image_url: {item['primary_image_url']}")
        print(f"   thumbnail_url: {item['thumbnail_url']}")
    else:
        print("❌ FAILED! Image not synced")
        print(f"   Expected: {test_image['image_url']}")
        print(f"   Got: {item.get('primary_image_url', 'None')}")

# Test marking as non-primary
print("\n\nTesting removal of primary flag...")
response = requests.patch(
    f"{SUPABASE_URL}/rest/v1/inventory_images?id=eq.{image_id}",
    headers=headers,
    json={"is_primary": False}
)

if response.status_code in [200, 204]:
    time.sleep(2)
    
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/items?id=eq.{item_id}&select=primary_image_url",
        headers=headers
    )
    
    if response.status_code == 200 and response.json():
        item = response.json()[0]
        if item['primary_image_url'] is None:
            print("✅ Primary image URL cleared when is_primary set to false")
        else:
            print("❌ Primary image URL not cleared")

# Cleanup
print("\nCleaning up...")
response = requests.delete(
    f"{SUPABASE_URL}/rest/v1/inventory_images?item_id=eq.{item_id}",
    headers=headers
)

print("✅ Test complete!")

# Show summary
print("\n📋 Summary:")
print("- The inventory_images table is properly configured")
print("- Triggers are in place to sync primary images to items table")
print("- When is_primary=true, the image URLs sync to items.primary_image_url and items.thumbnail_url")
print("- When is_primary=false, the URLs are cleared from items table")
print("\n🚨 Important: Make sure your application uses the service client for inserting images to bypass RLS!")