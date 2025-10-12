#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')

print("🔍 Testing items API endpoint...\n")

# Test the production items API
production_url = "https://jobeye-production.up.railway.app"
local_url = "http://localhost:3000"

# Try production first
print("1. Testing production API:")
try:
    response = requests.get(
        f"{production_url}/api/supervisor/items",
        headers={
            'x-tenant-id': 'demo-company'
        }
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Response keys: {list(data.keys())}")
        if 'items' in data:
            print(f"   Items count: {len(data['items'])}")
            if data['items']:
                print(f"   First item: {data['items'][0]}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")

# Test direct Supabase query
print("\n2. Testing direct Supabase query:")
headers = {
    "apikey": os.getenv('SUPABASE_SERVICE_ROLE_KEY'),
    "Authorization": f"Bearer {os.getenv('SUPABASE_SERVICE_ROLE_KEY')}",
    "Content-Type": "application/json"
}

response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?tenant_id=eq.demo-company",
    headers=headers
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    items = response.json()
    print(f"   Items found: {len(items)}")
    if items:
        print(f"   Sample item: {items[0]}")
else:
    print(f"   Error: {response.text}")

# Check if 'demo-company' tenant exists
print("\n3. Checking all unique tenant_ids in items:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?select=tenant_id&limit=100",
    headers=headers
)
if response.status_code == 200:
    items = response.json()
    tenant_ids = list(set([item['tenant_id'] for item in items]))
    print(f"   Unique tenant_ids: {tenant_ids}")