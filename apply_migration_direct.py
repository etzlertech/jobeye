#!/usr/bin/env python3
"""
Apply migration 010_job_assignments.sql directly via psycopg2
Task: T005 - Apply migration to production database
"""
import sys

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("❌ psycopg2 not installed. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2
    from psycopg2 import sql

# Database connection string from .env.local
# Format: postgresql://postgres:[PASSWORD]@db.rtwigjwqufozqfwozpvo.supabase.co:5432/postgres
DB_PASSWORD = "Duke-neepo-oliver-ttq5"
DB_CONNECTION = f"postgresql://postgres:{DB_PASSWORD}@db.rtwigjwqufozqfwozpvo.supabase.co:5432/postgres"

print("Reading migration file...")
with open('supabase/migrations/010_job_assignments.sql', 'r') as f:
    migration_sql = f.read()

print(f"Migration SQL length: {len(migration_sql)} characters\n")

try:
    print("Connecting to Supabase database...")
    conn = psycopg2.connect(DB_CONNECTION)
    conn.autocommit = False  # Use transaction
    cursor = conn.cursor()

    print("Executing migration SQL...\n")
    cursor.execute(migration_sql)

    print("✅ Migration SQL executed successfully!")
    print("Committing transaction...")
    conn.commit()

    # Verify table was created
    print("\nVerifying table creation...")
    cursor.execute("""
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_name = 'job_assignments'
          AND table_schema = 'public';
    """)

    result = cursor.fetchone()
    if result:
        print(f"✅ Table 'job_assignments' exists: {result}")
    else:
        print("⚠️  Warning: Could not verify table creation")

    # Verify indexes
    print("\nVerifying indexes...")
    cursor.execute("""
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'job_assignments'
          AND schemaname = 'public';
    """)

    indexes = cursor.fetchall()
    print(f"✅ Found {len(indexes)} indexes:")
    for idx in indexes:
        print(f"   - {idx[0]}")

    # Verify RLS policies
    print("\nVerifying RLS policies...")
    cursor.execute("""
        SELECT policyname, cmd
        FROM pg_policies
        WHERE tablename = 'job_assignments';
    """)

    policies = cursor.fetchall()
    print(f"✅ Found {len(policies)} RLS policies:")
    for policy in policies:
        print(f"   - {policy[0]} ({policy[1]})")

    # Verify trigger
    print("\nVerifying trigger...")
    cursor.execute("""
        SELECT trigger_name, event_manipulation
        FROM information_schema.triggers
        WHERE event_object_table = 'job_assignments';
    """)

    triggers = cursor.fetchall()
    print(f"✅ Found {len(triggers)} triggers:")
    for trigger in triggers:
        print(f"   - {trigger[0]} ({trigger[1]})")

    cursor.close()
    conn.close()

    print("\n" + "="*60)
    print("✅ Migration 010_job_assignments.sql applied successfully!")
    print("="*60)
    print("\nNext steps:")
    print("1. Run: npm run generate:types (T006a)")
    print("2. Backfill existing assignments (T006)")
    print("3. Write tests (T007-T015)")

except psycopg2.Error as e:
    print(f"❌ Database error: {e}")
    if conn:
        conn.rollback()
        print("Transaction rolled back")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
