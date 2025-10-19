#!/usr/bin/env python3
"""
Check workflow_tasks table schema before migration
"""
import requests
import os
import json
from dotenv import load_dotenv

load_dotenv('.env.local')

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

print("🔍 Checking workflow_tasks table schema...\n")

# Check columns
try:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'workflow_tasks'
            ORDER BY ordinal_position;
        """}
    )

    if response.status_code == 200:
        columns = response.json()
        print(f"✅ workflow_tasks has {len(columns)} columns:")
        for col in columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  - {col['column_name']}: {col['data_type']} {nullable}{default}")

        # Check for new columns we need to add
        column_names = [c['column_name'] for c in columns]
        needs_migration = []

        if 'is_required' not in column_names:
            needs_migration.append('is_required')
        if 'is_deleted' not in column_names:
            needs_migration.append('is_deleted')
        if 'template_id' not in column_names:
            needs_migration.append('template_id')

        if needs_migration:
            print(f"\n⚠️  Missing columns (migration needed): {', '.join(needs_migration)}")
        else:
            print(f"\n✅ All required columns present")

    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"❌ Error: {e}")

# Check RLS policies
print("\n🔍 Checking RLS policies...\n")
try:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": """
            SELECT
                polname as policy_name,
                polcmd as command,
                pg_get_expr(polqual, polrelid) as policy_expression
            FROM pg_policy p
            JOIN pg_class c ON p.polrelid = c.oid
            WHERE c.relname = 'workflow_tasks';
        """}
    )

    if response.status_code == 200:
        policies = response.json()
        print(f"✅ Found {len(policies)} RLS policies:")
        for policy in policies:
            print(f"\n  Policy: {policy['policy_name']}")
            print(f"  Command: {policy['command']}")
            print(f"  Expression: {policy['policy_expression']}")

            # Check if using incorrect JWT path
            if 'app.current_tenant_id' in policy['policy_expression']:
                print(f"  ⚠️  WARNING: Using incorrect JWT path (app.current_tenant_id)")
                print(f"  🔧 Should use: request.jwt.claims -> 'app_metadata' ->> 'tenant_id'")
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"❌ Error: {e}")

# Check if task_templates and task_template_items tables exist
print("\n🔍 Checking for task template tables...\n")
try:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('task_templates', 'task_template_items')
            ORDER BY table_name;
        """}
    )

    if response.status_code == 200:
        tables = response.json()
        if len(tables) == 0:
            print("⚠️  task_templates and task_template_items tables do NOT exist (migration needed)")
        else:
            print(f"✅ Found {len(tables)} template tables:")
            for table in tables:
                print(f"  - {table['table_name']}")
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "="*60)
print("SUMMARY")
print("="*60)
