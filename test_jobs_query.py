#!/usr/bin/env python3
import requests
import json
from datetime import date

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
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

tenant_id = "550e8400-e29b-41d4-a716-446655440000"
today = date.today().isoformat()

print(f"=== Querying jobs for tenant {tenant_id} on {today} ===\n")

# Try the query that the API is using
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/jobs",
    headers=headers,
    params={
        "select": "id,scheduled_date,scheduled_time,status,special_instructions",
        "tenant_id": f"eq.{tenant_id}",
        "scheduled_date": f"eq.{today}",
        "order": "scheduled_time.asc"
    }
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}\n")

if response.status_code != 200:
    print("❌ Query failed!")
    print(f"Error: {response.json()}")
else:
    data = response.json()
    print(f"✅ Found {len(data)} jobs for today")
    if data:
        print(f"Sample: {json.dumps(data[0], indent=2)}")
