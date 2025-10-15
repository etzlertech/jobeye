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

# Check which tables exist by trying to query them
tables_to_check = ['jobs', 'crews', 'job_assignments', 'inventory', 'activity_logs', 'tenants', 'tenant_members']

print("=== Checking database tables ===\n")
for table in tables_to_check:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        params={"limit": 1}
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✅ {table}: EXISTS (found {len(data)} records in first page)")
    elif response.status_code == 404:
        print(f"❌ {table}: DOES NOT EXIST")
    else:
        print(f"⚠️  {table}: Status {response.status_code} - {response.text[:100]}")

print("\n=== Checking tenant_id in tenant 550e8400-e29b-41d4-a716-446655440000 ===\n")
tenant_id = "550e8400-e29b-41d4-a716-446655440000"

for table in ['jobs', 'crews', 'inventory']:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        params={"tenant_id": f"eq.{tenant_id}", "limit": 5}
    )

    if response.status_code == 200:
        data = response.json()
        print(f"{table}: {len(data)} records for tenant")
    else:
        print(f"{table}: Error - {response.status_code}")
