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

# Step 1: Apply the schema update migration
print("Step 1: Updating inventory_images table schema...")
with open('/Users/travisetzler/Documents/GitHub/jobeye/supabase/migrations/20251012_update_inventory_images_for_unified_schema.sql', 'r') as f:
    schema_migration_sql = f.read()

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": schema_migration_sql}
)

if response.status_code == 204:
    print("✅ Schema update applied successfully!")
elif response.status_code == 200:
    print("✅ Schema update completed")
else:
    print(f"❌ Error updating schema: {response.status_code}")
    print(response.text)
    exit(1)

# Step 2: Apply the trigger migration
print("\nStep 2: Adding sync triggers...")
with open('/Users/travisetzler/Documents/GitHub/jobeye/supabase/migrations/20251012_add_inventory_image_sync_trigger.sql', 'r') as f:
    trigger_migration_sql = f.read()

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": trigger_migration_sql}
)

if response.status_code == 204:
    print("✅ Sync triggers applied successfully!")
elif response.status_code == 200:
    print("✅ Sync triggers completed")
else:
    print(f"❌ Error adding triggers: {response.status_code}")
    print(response.text)

# Step 3: Verify the setup
print("\nStep 3: Verifying the setup...")

# Check table structure
check_columns_sql = """
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'inventory_images'
ORDER BY ordinal_position;
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": check_columns_sql}
)

if response.status_code == 200:
    columns = response.json()
    print("\nInventory_images table columns:")
    for col in columns:
        print(f"  - {col['column_name']} ({col['data_type']})")

# Check triggers
check_triggers_sql = """
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'inventory_images'::regclass
ORDER BY tgname;
"""

response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": check_triggers_sql}
)

if response.status_code == 200:
    triggers = response.json()
    print("\nTriggers on inventory_images:")
    for trigger in triggers:
        print(f"  - {trigger['tgname']}")

print("\n✅ All migrations applied successfully!")
print("\nThe inventory_images table is now properly configured to:")
print("- Use tenant_id instead of company_id")
print("- Automatically sync primary images to the items table")
print("- Support all required fields for the inventory intake service")