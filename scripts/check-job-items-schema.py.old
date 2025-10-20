#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

print("🔍 Checking job-items related tables...\n")

# Check for job_checklist_items table
query1 = """
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'job_checklist_items'
ORDER BY ordinal_position;
"""

response1 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query1}
)

print(f"Response status: {response1.status_code}")
if response1.status_code == 200:
    data = response1.json()
    if data and len(data) > 0:
        print("✅ job_checklist_items table EXISTS")
        print("\nColumns:")
        for row in data:
            nullable = "NULL" if row['is_nullable'] == 'YES' else "NOT NULL"
            default = f"DEFAULT {row['column_default']}" if row['column_default'] else ""
            print(f"  - {row['column_name']} ({row['data_type']}) {nullable} {default}")
    else:
        print("❌ job_checklist_items table NOT FOUND in schema")
elif response1.status_code == 204:
    print("⚠️  Got 204 No Content - query returned no results")
    print("❌ job_checklist_items table likely does NOT exist")
else:
    print(f"❌ Error checking table: {response1.status_code}")
    try:
        print(f"Response: {response1.json()}")
    except:
        print(f"Response text: {response1.text}")

# Check for any job-item relationship tables
query2 = """
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (
    table_name LIKE '%job%item%' 
    OR table_name LIKE '%job%material%'
    OR table_name LIKE '%job%equipment%'
    OR table_name LIKE '%load%list%'
)
ORDER BY table_name;
"""

response2 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query2}
)

if response2.status_code == 200:
    print("\n📊 Job-Item related tables:")
    for row in response2.json():
        print(f"  - {row['table_name']}")

# Check jobs table for relevant columns
query3 = """
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND (
    column_name LIKE '%item%' 
    OR column_name LIKE '%material%'
    OR column_name LIKE '%equipment%'
    OR column_name LIKE '%checklist%'
)
ORDER BY ordinal_position;
"""

response3 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query3}
)

if response3.status_code == 200:
    print("\n📋 Jobs table item-related columns:")
    for row in response3.json():
        print(f"  - {row['column_name']} ({row['data_type']})")

# Check for load_list or checklist views
query4 = """
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%checklist%' OR table_name LIKE '%load%')
ORDER BY table_name;
"""

response4 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query4}
)

if response4.status_code == 200:
    print("\n👀 Checklist/Load related tables/views:")
    for row in response4.json():
        print(f"  - {row['table_name']} ({row['table_type']})")