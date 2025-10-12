#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Missing required environment variables")
    exit(1)

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Read the migration file
migration_path = Path('supabase/migrations/20251213_tenant_management_tables.sql')
with open(migration_path, 'r') as f:
    sql_content = f.read()

print("Applying tenant management migration...")

# Execute the migration
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": sql_content}
)

if response.status_code == 204:
    print("✅ Migration applied successfully!")
    print("\nCreated tables:")
    print("  - tenants")
    print("  - tenant_members") 
    print("  - tenant_invitations")
    print("\nCreated helper functions:")
    print("  - auth.app_metadata()")
    print("  - auth.tenant_id()")
    print("  - auth.has_role()")
    print("  - auth.is_system_admin()")
    print("\nRLS policies are now active on all tenant tables.")
else:
    print(f"❌ Migration failed: {response.status_code}")
    print(response.text)