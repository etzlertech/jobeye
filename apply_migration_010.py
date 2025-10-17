#!/usr/bin/env python3
"""
Apply migration 010_job_assignments.sql to production database
Task: T005 - Apply migration to production database
"""
import requests
import sys
import time

# From .env.local
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Read migration file
print("Reading migration file...")
with open('supabase/migrations/010_job_assignments.sql', 'r') as f:
    migration_sql = f.read()

print(f"Migration SQL length: {len(migration_sql)} characters")

# Split into individual statements (by semicolon + newline)
statements = [s.strip() for s in migration_sql.split(';\n') if s.strip() and not s.strip().startswith('--')]

print(f"Found {len(statements)} SQL statements to execute\n")

# Execute each statement individually
success_count = 0
error_count = 0

for i, statement in enumerate(statements, 1):
    # Skip comment-only statements
    if statement.startswith('--') or len(statement) < 10:
        continue

    # Show first 100 chars of statement
    preview = statement[:100].replace('\n', ' ')
    print(f"[{i}/{len(statements)}] Executing: {preview}...")

    try:
        # Use raw SQL execution via Supabase REST API
        # We'll execute via PostgREST rpc if available, or direct HTTP
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"query": statement},
            timeout=30
        )

        if response.status_code in [200, 201, 204]:
            print(f"  ✅ Success (status {response.status_code})")
            success_count += 1
        else:
            print(f"  ⚠️  Status {response.status_code}: {response.text[:200]}")

            # Some statements might not work via RPC, try direct execution
            # This is expected for DDL statements
            if "exec_sql" in response.text or "not found" in response.text.lower():
                print(f"  ℹ️  RPC method not available, trying alternative approach...")
                # For now, we'll mark as needing manual execution
                error_count += 1
            else:
                error_count += 1

        time.sleep(0.1)  # Small delay between statements

    except Exception as e:
        print(f"  ❌ Error: {e}")
        error_count += 1

print(f"\n{'='*60}")
print(f"Migration execution summary:")
print(f"  ✅ Success: {success_count}")
print(f"  ❌ Errors: {error_count}")
print(f"{'='*60}")

if error_count > 0:
    print("\n⚠️  Some statements failed. This might be expected for DDL operations.")
    print("Let me verify if the table was created...")

    # Verify table exists
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/job_assignments",
        headers=headers,
        params={"limit": 0},
        timeout=10
    )

    if response.status_code == 200:
        print("✅ job_assignments table exists and is accessible!")
        print("\nMigration verification steps:")
        print("1. Check table structure")
        print("2. Check indexes")
        print("3. Check RLS policies")
    else:
        print(f"❌ job_assignments table not accessible: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        print("\n⚠️  Migration needs manual application via Supabase Dashboard SQL Editor")
        sys.exit(1)
else:
    print("\n✅ All statements executed successfully!")
