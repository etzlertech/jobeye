#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

print("🔍 Testing Supabase connection...\n")

# Try to query items table directly
print("1. Testing direct REST API query to items table:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items?limit=1",
    headers=headers
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    if data:
        print(f"   ✅ Items table accessible, found {len(data)} records")
    else:
        print("   Items table exists but is empty")
else:
    print(f"   Error: {response.text}")

# Try to query jobs table
print("\n2. Testing direct REST API query to jobs table:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/jobs?limit=1",
    headers=headers
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    print(f"   ✅ Jobs table accessible")
else:
    print(f"   Error: {response.text}")

# Try job_checklist_items
print("\n3. Testing job_checklist_items table:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/job_checklist_items?limit=1",
    headers=headers
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    print("   ✅ Table EXISTS!")
    print(f"   Response: {response.json()}")
elif response.status_code == 404:
    print("   ❌ Table NOT FOUND (404)")
else:
    print(f"   Error: {response.text}")

# Check item_transactions for job linkage
print("\n4. Testing item_transactions table structure:")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/item_transactions?limit=0",
    headers=headers
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    # Get column info from OPTIONS request
    response_options = requests.options(
        f"{SUPABASE_URL}/rest/v1/item_transactions",
        headers=headers
    )
    print("   ✅ Table exists")
    
print("\n5. Checking if exec_sql RPC function exists:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": "SELECT 1 as test"}
)
print(f"   Status: {response.status_code}")
if response.status_code == 404:
    print("   ❌ exec_sql function NOT FOUND - need to create it")