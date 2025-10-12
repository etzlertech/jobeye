#!/usr/bin/env python3
import requests
import json

# From .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Query for all tables
query = """
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"""

print("🔍 Checking all tables in JobEye database...\n")

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query}
)

if response.status_code == 200:
    try:
        result = response.json()
        if result:
            print(f"📊 Found {len(result)} tables:")
            for row in result:
                table_type = f" ({row['table_type']})" if row['table_type'] != 'BASE TABLE' else ""
                print(f"  - {row['table_name']}{table_type}")
        else:
            print("❌ No tables found")
    except Exception as e:
        print(f"Error parsing response: {e}")
        print(f"Response: {response.text}")
elif response.status_code == 204:
    print("✅ Query executed (no results)")
else:
    print(f"❌ Error {response.status_code}: {response.text}")