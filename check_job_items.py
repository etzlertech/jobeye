#!/usr/bin/env python3
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Query job_checklist_items for this specific job
job_id = '5714f0f2-b43a-43bc-8e6b-a7202dd49c11'

print(f"\n🔍 Checking job_checklist_items for job {job_id}...\n")

response = requests.get(
    f"{SUPABASE_URL}/rest/v1/job_checklist_items",
    headers=headers,
    params={
        "job_id": f"eq.{job_id}",
        "select": "*"
    }
)

if response.status_code == 200:
    items = response.json()
    print(f"✅ Found {len(items)} items in job_checklist_items:\n")
    for item in items:
        print(f"  - ID: {item.get('id')}")
        print(f"    Item ID: {item.get('item_id')}")
        print(f"    Item Name: {item.get('item_name')}")
        print(f"    Item Type: {item.get('item_type')}")
        print(f"    Status: {item.get('status')}")
        print(f"    Quantity: {item.get('quantity')}")
        print()
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)

# Also check the items table to see what items exist
print("\n🔍 Checking items table for item details...\n")

if response.status_code == 200 and items:
    item_ids = [item['item_id'] for item in items if item.get('item_id')]

    if item_ids:
        # Convert list to PostgreSQL array format
        item_ids_str = ','.join([f'"{id}"' for id in item_ids])

        items_response = requests.get(
            f"{SUPABASE_URL}/rest/v1/items",
            headers=headers,
            params={
                "id": f"in.({item_ids_str})",
                "select": "id,name,category"
            }
        )

        if items_response.status_code == 200:
            item_details = items_response.json()
            print(f"✅ Found {len(item_details)} items in items table:\n")
            for detail in item_details:
                print(f"  - ID: {detail.get('id')}")
                print(f"    Name: {detail.get('name')}")
                print(f"    Category: {detail.get('category')}")
                print()
        else:
            print(f"❌ Error fetching items: {items_response.status_code}")
            print(items_response.text)
