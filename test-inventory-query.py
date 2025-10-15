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

# Test 1: Query inventory_items table
print("Test 1: Querying inventory_items table...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/inventory_items",
    headers=headers,
    params={
        "select": "id,name,category,current_quantity,reorder_level,status,type,tracking_mode,tenant_id",
        "tenant_id": "eq.550e8400-e29b-41d4-a716-446655440000",
        "limit": "5"
    }
)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    items = response.json()
    print(f"Found {len(items)} items:")
    for item in items:
        print(f"  - {item.get('name')} ({item.get('category')})")
else:
    print(f"Error: {response.text}")

print("\n" + "="*50 + "\n")

# Test 2: Check table schema
print("Test 2: Getting table schema...")
schema_response = requests.get(
    f"{SUPABASE_URL}/rest/v1/",
    headers={
        **headers,
        "Accept": "application/json"
    }
)
print(f"Status: {schema_response.status_code}")
if schema_response.status_code == 200:
    print("API is accessible")
else:
    print(f"Error: {schema_response.text}")
