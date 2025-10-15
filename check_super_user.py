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

# Check for super@tophand.tech user via admin API
print("=== Checking for super@tophand.tech in auth.users ===")
response = requests.get(
    f"{SUPABASE_URL}/auth/v1/admin/users",
    headers=headers
)
print(f"Status: {response.status_code}")
users = response.json()

super_user = None
for user in users.get('users', []):
    if user['email'] == 'super@tophand.tech':
        super_user = user
        print(json.dumps(user, indent=2))
        break

if not super_user:
    print("User super@tophand.tech NOT FOUND!")
else:
    print(f"\nUser ID: {super_user['id']}")
    print(f"App Metadata: {json.dumps(super_user.get('app_metadata', {}), indent=2)}")
    print(f"User Metadata: {json.dumps(super_user.get('user_metadata', {}), indent=2)}")
