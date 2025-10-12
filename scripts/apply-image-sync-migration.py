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

# Read the migration file
with open('/Users/travisetzler/Documents/GitHub/jobeye/supabase/migrations/20251012_add_inventory_image_sync_trigger.sql', 'r') as f:
    migration_sql = f.read()

# Execute the migration
print("Applying inventory image sync trigger migration...")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": migration_sql}
)

if response.status_code == 204:
    print("✅ Migration applied successfully!")
elif response.status_code == 200:
    print("✅ Migration completed with response:")
    print(response.json())
else:
    print(f"❌ Error applying migration: {response.status_code}")
    print(response.text)

# Now check if the triggers were created
check_sql = """
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgrelid::regclass::text = 'inventory_images'
ORDER BY tgname;
"""

print("\nChecking created triggers:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": check_sql}
)

if response.status_code == 200:
    triggers = response.json()
    if triggers:
        for trigger in triggers:
            print(f"  - {trigger['trigger_name']} -> {trigger['function_name']}")
    else:
        print("  No triggers found (this might be an error)")
elif response.status_code == 204:
    print("  No triggers found")

# Test the sync by checking if any existing primary images got synced
test_sql = """
SELECT 
    i.id,
    i.name,
    i.primary_image_url,
    ii.image_url as inventory_image_url,
    ii.is_primary
FROM items i
JOIN inventory_images ii ON i.id = ii.item_id::uuid
WHERE ii.is_primary = true
LIMIT 5;
"""

print("\nChecking if primary images are now synced:")
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": test_sql}
)

if response.status_code == 200:
    results = response.json()
    if results:
        for item in results:
            print(f"  - {item['name']}: {'✅ SYNCED' if item['primary_image_url'] == item['inventory_image_url'] else '❌ NOT SYNCED'}")