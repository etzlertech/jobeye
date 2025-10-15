#!/usr/bin/env python3
import requests
import json
import os

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

# Check auth.users table for super@tophand.tech
sql = """
SELECT
    id,
    email,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users
WHERE email = 'super@tophand.tech';
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": sql}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Also check tenants table
sql2 = "SELECT id, name FROM public.tenants LIMIT 5;"
response2 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": sql2}
)
print(f"\nTenants Status: {response2.status_code}")
print(f"Tenants Response: {response2.text}")

# Check tenant_members
sql3 = """
SELECT tm.*, u.email
FROM public.tenant_members tm
JOIN auth.users u ON u.id = tm.user_id
WHERE u.email = 'super@tophand.tech';
"""
response3 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": sql3}
)
print(f"\nTenant Members Status: {response3.status_code}")
print(f"Tenant Members Response: {response3.text}")
