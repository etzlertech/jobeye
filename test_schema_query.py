#!/usr/bin/env python3
"""Query Supabase schema via PostgREST"""
import requests

SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print("Querying Supabase schema...")

# Query pg_tables to list all tables
print("\n=== Listing all public tables ===")
try:
    # Use the pg_catalog schema
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/get_schema_tables",
        headers=headers,
        json={}
    )

    if response.status_code == 404:
        print("No get_schema_tables function - trying direct introspection...")

        # Try to access auth schema tables
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/",
            headers=headers
        )
        print(f"Root endpoint status: {response.status_code}")
        print("Headers:", dict(response.headers))

except Exception as e:
    print(f"Exception: {e}")

# Try to query users_extended (from your codebase)
print("\n=== Testing users_extended table ===")
try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/users_extended",
        headers={**headers, "Range": "0-4"},  # Limit to 5 rows
        params={"select": "*"}
    )
    print(f"Status: {response.status_code}")
    if response.ok:
        data = response.json()
        print(f"Found {len(data)} rows")
        if data:
            print("Sample:", data[0])
    else:
        print("Error:", response.text)
except Exception as e:
    print(f"Exception: {e}")

print("\n✅ Schema query complete")
