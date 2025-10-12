#!/usr/bin/env python3
"""
Direct check for properties table using Supabase REST API
"""
import requests
import json

# Database credentials
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

# Setup headers
headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "count=exact"
}

print("🔍 Checking properties table directly via REST API...\n")

# 1. Try to query properties table
print("1. Attempting to query properties table:")
try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/properties",
        headers=headers,
        params={"select": "*", "limit": 1}
    )
    
    print(f"   Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("   ✅ Properties table EXISTS and is accessible!")
        data = response.json()
        print(f"   Number of records: {len(data)}")
        
        # Get count
        count_header = response.headers.get('content-range')
        if count_header:
            print(f"   Total count info: {count_header}")
            
    elif response.status_code == 404:
        print("   ❌ Properties table NOT FOUND (404)")
        print(f"   Response: {response.text}")
    else:
        print(f"   ⚠️  Unexpected response: {response.status_code}")
        print(f"   Response: {response.text}")
        
except Exception as e:
    print(f"   ❌ Error: {e}")

# 2. Check if we need to run migrations
print("\n2. Checking for tenants table (required dependency):")
try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/tenants",
        headers=headers,
        params={"select": "id", "limit": 1}
    )
    
    if response.status_code == 200:
        print("   ✅ Tenants table exists")
    else:
        print(f"   ❌ Tenants table not found (status: {response.status_code})")
        print("   This is a required dependency for properties table!")
        
except Exception as e:
    print(f"   ❌ Error checking tenants: {e}")

# 3. Check for customers table (another dependency)
print("\n3. Checking for customers table (required dependency):")
try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/customers",
        headers=headers,
        params={"select": "id", "limit": 1}
    )
    
    if response.status_code == 200:
        print("   ✅ Customers table exists")
    else:
        print(f"   ❌ Customers table not found (status: {response.status_code})")
        print("   This is a required dependency for properties table!")
        
except Exception as e:
    print(f"   ❌ Error checking customers: {e}")

# 4. List all accessible tables via a known endpoint
print("\n4. Checking what tables ARE accessible:")
accessible_tables = []

# Common table names to check
tables_to_check = [
    "tenants", "users_extended", "tenant_assignments", "roles", 
    "customers", "properties", "jobs", "equipment", "materials",
    "job_templates", "voice_sessions", "voice_transcripts",
    "vision_verification_records", "media_assets"
]

for table in tables_to_check:
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=headers,
            params={"select": "*", "limit": 0}  # Just check existence
        )
        
        if response.status_code == 200:
            accessible_tables.append(table)
            
    except:
        pass

if accessible_tables:
    print(f"   Found {len(accessible_tables)} accessible tables:")
    for table in accessible_tables:
        print(f"   - {table}")
else:
    print("   ❌ No tables found! Database might not be initialized.")

# 5. Summary and recommendations
print("\n📋 SUMMARY:")
print("-" * 50)

if 'properties' in accessible_tables:
    print("✅ Properties table is properly created and accessible")
else:
    print("❌ Properties table is NOT accessible")
    print("\n🔧 RECOMMENDATIONS:")
    print("1. The migration file exists at: supabase/migrations/001_v4_core_business_tables.sql")
    print("2. This migration creates the properties table with proper structure")
    print("3. It appears the migrations have NOT been run on this database")
    print("\n   Required migrations to run:")
    print("   - 001_v4_core_business_tables.sql (creates properties, customers, jobs, etc.)")
    
    if 'tenants' not in accessible_tables:
        print("   - Need to create tenants table first (dependency)")
    if 'customers' not in accessible_tables:
        print("   - Need to create customers table first (dependency)")
        
    print("\n   To fix this, you need to run the migrations on the database.")