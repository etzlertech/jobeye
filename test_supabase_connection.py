#!/usr/bin/env python3
"""Test Supabase connection via REST API"""
import requests
import sys

SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

print("Testing Supabase connection...")
print(f"URL: {SUPABASE_URL}")

# Test 1: Query all tables
print("\n=== Test 1: List all tables ===")
sql = """
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"""

try:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"query": sql}
    )
    print(f"Status: {response.status_code}")
    if response.ok:
        print("Response:", response.json())
    else:
        print("Error:", response.text)
except Exception as e:
    print(f"Exception: {e}")

# Test 2: Simple SELECT on a known table
print("\n=== Test 2: Count users ===")
try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/users",
        headers=headers,
        params={"select": "count"}
    )
    print(f"Status: {response.status_code}")
    if response.ok:
        print("Response:", response.json())
    else:
        print("Error:", response.text)
except Exception as e:
    print(f"Exception: {e}")

print("\n✅ Connection test complete")
