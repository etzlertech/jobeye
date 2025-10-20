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

print("🔍 Checking how to link items to jobs...\n")

# Check items table structure
query1 = """
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'items'
AND column_name LIKE '%job%'
ORDER BY ordinal_position;
"""

response1 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query1}
)

print(f"Query 1 status: {response1.status_code}")
if response1.status_code == 200:
    data = response1.json()
    print("📊 Items table job-related columns:")
    if data:
        for row in data:
            print(f"  - {row['column_name']} ({row['data_type']})")
    else:
        print("  - No job-related columns found")
else:
    print(f"Error: {response1.text}")

# Check for assignment tables
query2 = """
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (
    table_name LIKE '%assignment%' 
    OR table_name LIKE '%allocation%'
    OR table_name = 'job_items'
    OR table_name = 'job_materials'
    OR table_name = 'job_equipment'
)
ORDER BY table_name;
"""

response2 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query2}
)

if response2.status_code == 200:
    data = response2.json()
    print("\n📋 Assignment/allocation tables:")
    if data:
        for row in data:
            print(f"  - {row['table_name']}")
    else:
        print("  - No assignment tables found")

# Check item_transactions for job references
query3 = """
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'item_transactions'
AND (column_name LIKE '%job%' OR column_name LIKE '%location%')
ORDER BY ordinal_position;
"""

response3 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query3}
)

if response3.status_code == 200:
    data = response3.json()
    print("\n🔄 Item_transactions job/location columns:")
    if data:
        for row in data:
            print(f"  - {row['column_name']} ({row['data_type']})")
    else:
        print("  - No job/location columns found")

# Check kit tables
query4 = """
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%kit%'
ORDER BY table_name;
"""

response4 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query4}
)

if response4.status_code == 200:
    data = response4.json()
    print("\n🧰 Kit-related tables:")
    if data:
        for row in data:
            print(f"  - {row['table_name']}")
            
# Get ALL columns from items table
query5 = """
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'items'
ORDER BY ordinal_position
LIMIT 20;
"""

response5 = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query5}
)

if response5.status_code == 200:
    data = response5.json()
    print("\n📦 ALL Items table columns:")
    if data:
        for row in data:
            default = f" DEFAULT {row['column_default']}" if row['column_default'] else ""
            print(f"  - {row['column_name']} ({row['data_type']}){default}")