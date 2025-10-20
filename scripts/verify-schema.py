#!/usr/bin/env python3
import requests
import json

# From .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

def run_query(query, description):
    print(f"\n{'='*60}")
    print(f"🔍 {description}")
    print(f"{'='*60}")

    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": query}
    )

    if response.status_code == 204:
        print("✅ Query executed (no results)")
    else:
        try:
            data = response.json()
            print(json.dumps(data, indent=2))
        except:
            print(f"Status: {response.status_code}")
            print(response.text)

# 1. Check jobs table columns
run_query("""
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
  AND column_name IN ('load_verified', 'load_verified_at', 'load_verification_method')
ORDER BY column_name;
""", "Check jobs table load verification columns")

# 2. Check locations table
run_query("""
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'locations'
ORDER BY ordinal_position;
""", "Check locations table structure")

# 3. Check if default locations were created
run_query("""
SELECT
  t.name as tenant_name,
  l.id,
  l.name as location_name,
  l.location_type,
  l.is_default
FROM tenants t
LEFT JOIN locations l ON l.tenant_id = t.id AND l.is_default = true
ORDER BY t.name;
""", "Check default locations per tenant")

# 4. Check if get_default_location_id function exists
run_query("""
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name IN ('get_default_location_id', 'instantiate_task_items_from_template', 'trigger_instantiate_task_items')
ORDER BY routine_name;
""", "Check helper functions")

# 5. Check if trigger exists
run_query("""
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'auto_instantiate_task_items';
""", "Check auto_instantiate_task_items trigger")

print(f"\n{'='*60}")
print("✅ Schema verification complete!")
print(f"{'='*60}\n")
