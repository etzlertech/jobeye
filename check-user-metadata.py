#!/usr/bin/env python3
import requests
import json

SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Query auth.users to check metadata
print("Checking user metadata for super@tophand.tech...")
response = requests.get(
    f"{SUPABASE_URL}/auth/v1/admin/users",
    headers=headers
)

if response.status_code == 200:
    users = response.json()

    # Find the supervisor user
    supervisor = None
    for user in users.get('users', []):
        if user.get('email') == 'super@tophand.tech':
            supervisor = user
            break

    if supervisor:
        print(f"\n✅ Found user: {supervisor['email']}")
        print(f"   User ID: {supervisor['id']}")
        print(f"   App Metadata: {json.dumps(supervisor.get('app_metadata', {}), indent=4)}")
        print(f"   User Metadata: {json.dumps(supervisor.get('user_metadata', {}), indent=4)}")

        # Check if tenant_id exists
        app_meta = supervisor.get('app_metadata', {})
        if 'tenant_id' in app_meta:
            print(f"\n✅ tenant_id found: {app_meta['tenant_id']}")
            print(f"   roles: {app_meta.get('roles', [])}")
        else:
            print("\n❌ tenant_id NOT found in app_metadata!")
    else:
        print("❌ User not found")
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)
