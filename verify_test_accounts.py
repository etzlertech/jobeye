#!/usr/bin/env python3
"""
Verify test accounts exist in production database
Task: T001 - Verify test accounts exist
"""
import requests
import sys
import json

# From .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

print("Step 1: Querying auth.users (email addresses)...")

try:
    # Query auth.users table for email addresses
    response = requests.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=headers,
        timeout=10
    )

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        users = data.get('users', [])

        required_emails = {'super@tophand.tech', 'crew@tophand.tech'}
        found_users = {}

        for user in users:
            email = user.get('email')
            if email in required_emails:
                found_users[email] = user

        print(f"\nFound {len(found_users)}/{len(required_emails)} required accounts in auth.users:")

        for email, user in found_users.items():
            print(f"\n  ✅ {email}:")
            print(f"     ID: {user['id']}")
            print(f"     Created: {user.get('created_at')}")
            app_metadata = user.get('app_metadata', {})
            print(f"     app_metadata: {json.dumps(app_metadata, indent=6)}")

        missing_emails = required_emails - set(found_users.keys())
        if missing_emails:
            print(f"\n⚠️  Missing emails in auth.users: {missing_emails}")

        # Step 2: Query users_extended for role info
        if found_users:
            print("\n\nStep 2: Querying users_extended for role information...")
            user_ids = [u['id'] for u in found_users.values()]

            # Build OR filter for user_ids
            or_filter = ",".join([f"user_id.eq.{uid}" for uid in user_ids])

            response2 = requests.get(
                f"{SUPABASE_URL}/rest/v1/users_extended",
                headers=headers,
                params={
                    "or": f"({or_filter})",
                    "select": "*"
                },
                timeout=10
            )

            if response2.status_code == 200:
                extended_data = response2.json()
                print(f"Found {len(extended_data)} users in users_extended:")

                for ext_user in extended_data:
                    print(f"\n  User ID: {ext_user.get('user_id')}")
                    print(f"    Role: {ext_user.get('role')}")
                    print(f"    Tenant ID: {ext_user.get('tenant_id')}")

                # Verify roles
                roles = {u.get('role') for u in extended_data}
                if 'manager' in roles or 'admin' in roles:
                    print("\n✅ Supervisor account found (manager/admin role)")
                if 'technician' in roles:
                    print("✅ Crew account found (technician role)")

                print("\n✅ Test accounts verification complete!")
            else:
                print(f"⚠️  users_extended query failed: {response2.status_code}")
                print(f"Response: {response2.text}")

    else:
        print(f"Response: {response.text}")
        print(f"❌ Auth query failed with status {response.status_code}")
        sys.exit(1)

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
