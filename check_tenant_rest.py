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

# Check tenants
print("=== Checking Tenants ===")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/tenants?select=*",
    headers=headers
)
print(f"Status: {response.status_code}")
tenants = response.json()
print(json.dumps(tenants, indent=2))

# Check tenant_members joined with user emails
print("\n=== Checking Tenant Members ===")
response2 = requests.get(
    f"{SUPABASE_URL}/rest/v1/tenant_members?select=*",
    headers=headers
)
print(f"Status: {response2.status_code}")
members = response2.json()
print(json.dumps(members, indent=2))
