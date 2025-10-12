#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

# Get credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing Supabase credentials")
    exit(1)

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

print("🔍 Checking database schema...\n")

# Check if exec_sql function exists
try:
    # First, let's list all tables
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """}
    )
    
    if response.status_code == 404:
        print("❌ exec_sql function not found, trying direct query...")
        
        # Try direct table query
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/jobs",
            headers=headers,
            params={"select": "count", "limit": 1}
        )
        
        if response.status_code == 200:
            print("✅ Jobs table exists!")
        elif response.status_code == 404:
            print("❌ Jobs table does NOT exist!")
        else:
            print(f"❌ Error checking jobs table: {response.status_code}")
            print(f"Response: {response.text}")
    
    elif response.status_code == 200:
        tables = response.json()
        print(f"✅ Found {len(tables)} tables in public schema:")
        for table in tables:
            print(f"  - {table['table_name']}")
            
        # Check if jobs table exists
        has_jobs = any(t['table_name'] == 'jobs' for t in tables)
        print(f"\n{'✅' if has_jobs else '❌'} Jobs table {'exists' if has_jobs else 'does NOT exist'}!")
    
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ Error: {e}")