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

print("Querying 'items' table...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items",
    headers=headers,
    params={
        "tenant_id": "eq.550e8400-e29b-41d4-a716-446655440000",
        "limit": "3"
    }
)

print(f"Status: {response.status_code}\n")

if response.status_code == 200:
    items = response.json()
    print(f"Found {len(items)} items\n")
    if items:
        print("Sample item structure:")
        print(json.dumps(items[0], indent=2))
        print("\nAll columns:")
        print(", ".join(items[0].keys()))
    else:
        print("No items in database - table is empty")
else:
    print(f"Error: {response.text}")
