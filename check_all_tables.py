#!/usr/bin/env python3
import requests
import json

# Load from .env.local
with open('.env.local', 'r') as f:
    env_vars = {}
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, value = line.strip().split('=', 1)
            env_vars[key] = value.strip('"')

SUPABASE_URL = env_vars['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_SERVICE_KEY = env_vars['SUPABASE_SERVICE_ROLE_KEY']

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Check which tables exist
tables_to_check = [
    'customers',
    'properties',
    'items',
    'jobs',
    'job_items',
    'tenants',
    'tenant_members'
]

print("=== Checking database tables ===\n")
for table in tables_to_check:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        params={"limit": 1}
    )

    if response.status_code == 200:
        data = response.json()
        count_text = f"found {len(data)} records in first page" if data else "empty"
        print(f"✅ {table}: EXISTS ({count_text})")
    elif response.status_code == 404:
        print(f"❌ {table}: DOES NOT EXIST")
    else:
        print(f"⚠️  {table}: Status {response.status_code}")
