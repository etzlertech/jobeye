#!/usr/bin/env python3
"""
Test properties API endpoint to diagnose 500 errors
"""
import requests
import json
import uuid

# Database credentials
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

print("📋 PROPERTIES API ENDPOINT DIAGNOSIS")
print("=" * 50)

# Test 1: Direct Supabase REST API (baseline)
print("\n1. Testing Direct Supabase REST API:")
headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/properties",
        headers=headers,
        params={"select": "*", "limit": 2}
    )
    
    print(f"   Status: {response.status_code}")
    if response.status_code in [200, 206]:
        print("   ✅ Direct Supabase API works perfectly!")
        data = response.json()
        if data:
            print(f"   Sample tenant_id: {data[0]['tenant_id']}")
            print(f"   Sample customer_id: {data[0]['customer_id']}")
    else:
        print(f"   ❌ Error: {response.text}")
        
except Exception as e:
    print(f"   ❌ Exception: {e}")

# Test 2: Check if Next.js API is running
print("\n2. Testing Local Next.js API Endpoint:")
NEXTJS_URL = "http://localhost:3000"  # Adjust if different

# First, let's try without headers
print("\n   a) Without headers:")
try:
    response = requests.get(f"{NEXTJS_URL}/api/supervisor/properties")
    print(f"      Status: {response.status_code}")
    if response.status_code == 500:
        print("      ❌ 500 Error (as expected - missing headers)")
        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        if error_data:
            print(f"      Error: {json.dumps(error_data, indent=2)}")
    else:
        print(f"      Response: {response.text[:200]}")
except Exception as e:
    print(f"      ❌ Cannot connect to Next.js: {e}")
    print("      Make sure 'npm run dev' is running!")

# Now with tenant header
print("\n   b) With x-tenant-id header:")
test_headers = {
    "x-tenant-id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e"  # From existing data
}

try:
    response = requests.get(
        f"{NEXTJS_URL}/api/supervisor/properties",
        headers=test_headers
    )
    print(f"      Status: {response.status_code}")
    if response.status_code == 200:
        print("      ✅ API works with tenant header!")
        data = response.json()
        print(f"      Properties count: {data.get('total_count', 'unknown')}")
    else:
        print(f"      ❌ Error with status {response.status_code}")
        try:
            error_data = response.json()
            print(f"      Error: {json.dumps(error_data, indent=2)}")
        except:
            print(f"      Response: {response.text[:500]}")
except Exception as e:
    print(f"      ❌ Exception: {e}")

# Test 3: Test with authentication
print("\n3. Testing with Authentication Headers:")
auth_headers = {
    "x-tenant-id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e",
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
}

try:
    response = requests.get(
        f"{NEXTJS_URL}/api/supervisor/properties",
        headers=auth_headers
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ API works with auth headers!")
    else:
        print(f"   Response: {response.text[:500]}")
except Exception as e:
    print(f"   ❌ Exception: {e}")

# Test 4: Test search functionality
print("\n4. Testing Search Functionality:")
search_headers = {
    "x-tenant-id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e"
}

try:
    response = requests.get(
        f"{NEXTJS_URL}/api/supervisor/properties?search=Main",
        headers=search_headers
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ Search works!")
        data = response.json()
        print(f"   Results: {data.get('total_count', 0)} properties found")
    else:
        print(f"   ❌ Search failed with status {response.status_code}")
except Exception as e:
    print(f"   ❌ Exception: {e}")

# Summary
print("\n📊 DIAGNOSIS SUMMARY:")
print("-" * 50)
print("\nLikely causes of 500 errors:")
print("1. ❌ Missing x-tenant-id header in requests")
print("2. ❌ Authentication/session issues")
print("3. ❌ JSONB search syntax error (now fixed)")
print("4. ❌ RLS policies blocking access")
print("\nTo fix in your app:")
print("1. Ensure x-tenant-id header is sent with all requests")
print("2. Check user authentication state")
print("3. Verify user has proper tenant assignment")
print("4. Check browser console/network tab for exact error")