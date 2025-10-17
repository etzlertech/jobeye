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

job_id = '5714f0f2-b43a-43bc-8e6b-a7202dd49c11'

print(f"\n🔍 Checking item_transactions for job {job_id}...\n")

response = requests.get(
    f"{SUPABASE_URL}/rest/v1/item_transactions",
    headers=headers,
    params={
        "job_id": f"eq.{job_id}",
        "select": "id,item_id,transaction_type,quantity,created_at,items(id,name,item_type,category)",
        "order": "created_at.desc"
    }
)

if response.status_code == 200:
    transactions = response.json()
    print(f"✅ Found {len(transactions)} transactions:\n")
    for tx in transactions:
        print(f"  Transaction ID: {tx.get('id')}")
        print(f"  Type: {tx.get('transaction_type')}")
        print(f"  Quantity: {tx.get('quantity')}")
        print(f"  Item: {tx.get('items')}")
        print(f"  Created: {tx.get('created_at')}")
        print()
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)
