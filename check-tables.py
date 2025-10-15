#!/usr/bin/env python3
import requests

SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
}

# List of tables to check
tables_to_check = [
    'inventory',
    'inventory_items',
    'items',
    'equipment',
    'materials',
    'properties',
    'customers',
    'jobs',
    'tenants',
    'tenant_members',
    'users_extended'
]

print("Checking for tables in Supabase...")
print("=" * 60)

existing_tables = []
missing_tables = []

for table in tables_to_check:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={**headers, "Prefer": "count=exact"},
        params={"limit": "0"}
    )

    if r.status_code == 200:
        print(f"✅ {table:20} EXISTS")
        existing_tables.append(table)
    elif r.status_code == 404:
        print(f"❌ {table:20} NOT FOUND")
        missing_tables.append(table)
    else:
        print(f"⚠️  {table:20} ERROR (status: {r.status_code})")
        print(f"   Error: {r.text[:100]}")

print("\n" + "=" * 60)
print(f"\nSummary:")
print(f"  Existing: {len(existing_tables)} tables")
print(f"  Missing:  {len(missing_tables)} tables")

if missing_tables:
    print(f"\n  Missing tables: {', '.join(missing_tables)}")
