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

print("📊 Listing all tables in database...\n")

# Simple query to list all tables
query = """
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": query}
)

print(f"Response status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"\nFound {len(data)} tables:")
    for row in data:
        print(f"  - {row['table_name']}")
elif response.status_code == 204:
    print("No tables found (204 No Content)")
else:
    print(f"Error: {response.text}")