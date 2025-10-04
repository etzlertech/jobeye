#!/usr/bin/env python3
import requests
import json

# Supabase credentials
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Test 1: Check if we can access customers table
print("Testing connection to Supabase...")
print("\n1. Trying to fetch customers:")
url = f"{SUPABASE_URL}/rest/v1/customers?select=*"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:200]}...")

# Test 2: Check RPC functions
print("\n2. Checking available RPC functions:")
url = f"{SUPABASE_URL}/rest/v1/rpc/"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}...")

# Test 3: Try to get policies using SQL
print("\n3. Trying direct SQL query on customers policies:")
url = f"{SUPABASE_URL}/rest/v1/"
sql_query = "SELECT policyname FROM pg_policies WHERE tablename = 'customers'"
# Try using PostgREST query
url = f"{SUPABASE_URL}/rest/v1/pg_policies?tablename=eq.customers&select=policyname"
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}...")

# Test 4: Check if exec_sql function exists
print("\n4. Testing exec_sql RPC function:")
url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
payload = {"sql": "SELECT 1"}
response = requests.post(url, headers=headers, json=payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Test 5: Try different approach - use the query endpoint
print("\n5. Testing query via SQL Editor API:")
url = f"{SUPABASE_URL}/rest/v1/query"
payload = {"query": "SELECT policyname FROM pg_policies WHERE tablename = 'customers'"}
response = requests.post(url, headers=headers, json=payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}...")