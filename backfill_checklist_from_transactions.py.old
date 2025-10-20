#!/usr/bin/env python3
import requests
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

job_id = '5714f0f2-b43a-43bc-8e6b-a7202dd49c11'
tenant_id = '550e8400-e29b-41d4-a716-446655440000'  # Demo Company tenant

print(f"\n🔄 Backfilling job_checklist_items from item_transactions...\n")

# Get the transactions for this job
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/item_transactions",
    headers=headers,
    params={
        "job_id": f"eq.{job_id}",
        "transaction_type": "eq.check_out",
        "select": "item_id,quantity,items(name,item_type,category)",
        "order": "created_at.asc"
    }
)

if response.status_code != 200:
    print(f"❌ Error fetching transactions: {response.status_code}")
    print(response.text)
    exit(1)

transactions = response.json()
print(f"Found {len(transactions)} check_out transactions\n")

# Group by item_id to sum quantities
items_to_add = {}
for tx in transactions:
    item_id = tx['item_id']
    quantity = tx['quantity']
    item_info = tx['items']

    if item_id not in items_to_add:
        items_to_add[item_id] = {
            'item_id': item_id,
            'name': item_info['name'],
            'item_type': item_info['item_type'],
            'category': item_info['category'],
            'total_quantity': 0
        }

    items_to_add[item_id]['total_quantity'] += quantity

# Create checklist items
sequence = 1
for item_id, item_data in items_to_add.items():
    checklist_item = {
        'job_id': job_id,
        'sequence_number': sequence,
        'item_type': item_data['item_type'],
        'item_id': item_id,
        'item_name': item_data['name'],
        'quantity': int(item_data['total_quantity']),
        'status': 'pending'
    }

    print(f"Creating checklist item for: {item_data['name']} (qty: {item_data['total_quantity']})")

    insert_response = requests.post(
        f"{SUPABASE_URL}/rest/v1/job_checklist_items",
        headers=headers,
        json=checklist_item
    )

    if insert_response.status_code in [200, 201]:
        print(f"✅ Created checklist item")
    else:
        print(f"❌ Error: {insert_response.status_code}")
        print(insert_response.text)

    sequence += 1

print("\n✅ Backfill complete!")
