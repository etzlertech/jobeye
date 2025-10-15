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

print("=== Inspecting jobs table schema ===\n")

# Get all jobs with all columns (limit 1 to see schema)
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/jobs",
    headers=headers,
    params={"limit": 1}
)

print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    if data:
        print("✅ Jobs table exists")
        print(f"\nColumns in jobs table:")
        for key in sorted(data[0].keys()):
            print(f"  - {key}: {type(data[0][key]).__name__}")
        print(f"\nSample record:")
        print(json.dumps(data[0], indent=2))
    else:
        print("✅ Jobs table exists but is empty")
        print("Cannot determine schema from empty table")
else:
    print(f"❌ Error: {response.text}")
