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

# Check properties table schema
print("1. Checking properties table structure...")
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/properties",
    headers=headers,
    params={"limit": "1"}
)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    properties = response.json()
    if properties:
        print(f"\nSample property structure:")
        print(json.dumps(properties[0], indent=2))
        print(f"\nColumns: {', '.join(properties[0].keys())}")
    else:
        print("No properties in database - table is empty")
else:
    print(f"Error: {response.text}")

print("\n" + "="*60 + "\n")

# Try to create a property with minimal data
print("2. Testing property creation with minimal data...")
test_data = {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "9f777d00-c721-4803-800b-b52f248ba4a1",  # Existing customer
    "address": "123 Test Street"
}

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/properties",
    headers={**headers, "Prefer": "return=representation"},
    json=test_data
)

print(f"Status: {response.status_code}")
if response.status_code in [200, 201]:
    print(f"Success! Created property:")
    print(json.dumps(response.json(), indent=2))
else:
    print(f"Error: {response.text}")
