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

# Query to get all RLS policies
sql_query = """
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
"""

# Execute SQL query using PostgREST
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"query": sql_query}
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")

# If the exec_sql function doesn't exist, try direct query
if response.status_code != 200:
    print("\n\nTrying direct query approach...")
    # Try querying pg_policies directly
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/pg_policies?schemaname=eq.public&select=*&order=tablename,policyname",
        headers=headers
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
