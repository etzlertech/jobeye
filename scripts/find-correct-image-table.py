#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    exit(1)

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# 1. Find all tables that might contain item images
find_tables_sql = """
SELECT 
    t.table_name,
    obj_description(c.oid, 'pg_class') as table_comment
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
WHERE t.table_schema = 'public'
    AND (
        t.table_name LIKE '%image%'
        OR t.table_name LIKE '%media%'
        OR t.table_name LIKE '%photo%'
        OR t.table_name = 'item_images'
        OR t.table_name = 'equipment_images'
        OR t.table_name = 'material_images'
    )
ORDER BY t.table_name;
"""

print("Looking for image-related tables:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": find_tables_sql}
)

if response.status_code == 200:
    tables = response.json()
    if tables:
        for table in tables:
            print(f"\n- {table['table_name']}")
            if table['table_comment']:
                print(f"  Comment: {table['table_comment']}")
            
            # Get columns for each table
            col_sql = f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '{table['table_name']}'
            ORDER BY ordinal_position
            LIMIT 10;
            """
            col_response = requests.post(
                f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
                headers=headers,
                json={"sql": col_sql}
            )
            if col_response.status_code == 200:
                columns = col_response.json()
                if columns:
                    print("  Columns:", ", ".join([f"{c['column_name']} ({c['data_type']})" for c in columns[:5]]))
                    if len(columns) > 5:
                        print("    ...", len(columns) - 5, "more columns")
    else:
        print("  No image-related tables found")

# 2. Check if we need to create the proper inventory_images table
print("\n\nChecking if we need to create the proper inventory_images table...")
print("The code expects a table with columns for item images (item_type, item_id, is_primary, etc.)")
print("But it seems this table might not exist or has a different structure.")

# 3. Look for migration files that might create the proper structure
import os
migrations_dir = "/Users/travisetzler/Documents/GitHub/jobeye/supabase/migrations"
print(f"\nLooking for relevant migration files in {migrations_dir}:")

relevant_files = []
for file in os.listdir(migrations_dir):
    if file.endswith('.sql'):
        file_path = os.path.join(migrations_dir, file)
        with open(file_path, 'r') as f:
            content = f.read()
            if 'inventory_images' in content and ('item_type' in content or 'is_primary' in content):
                relevant_files.append(file)

if relevant_files:
    print("Found migration files that reference the expected inventory_images structure:")
    for file in relevant_files:
        print(f"  - {file}")
else:
    print("No existing migrations found for the expected inventory_images structure.")