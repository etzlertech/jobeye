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

# Query information_schema to list all tables
print("Querying information_schema.tables for all tables...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={
        "query": "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"
    }
)

if response.status_code in [200, 204]:
    # Try alternate method - query pg_tables
    response2 = requests.get(
        f"{SUPABASE_URL}/rest/v1/",
        headers=headers
    )

    # List common tables to check
    tables_to_check = ['inventory', 'inventory_items', 'items', 'equipment', 'materials', 'properties', 'customers', 'jobs', 'tenants']

    print("\nChecking for tables...")
    for table in tables_to_check:
        r = requests.head(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=headers
        )
        status = "✅ EXISTS" if r.status_code != 404 else "❌ NOT FOUND"
        print(f"  {table}: {status} (status: {r.status_code})")
else:
    print(f"Error: {response.status_code}")
    print(response.text)
