#!/usr/bin/env python3
import requests

SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Read the migration SQL
with open('/Users/travisetzler/Documents/GitHub/jobeye/supabase/migrations/100_fix_users_extended_rls_recursion.sql', 'r') as f:
    sql = f.read()

print("Applying RLS fix migration...")
print("-" * 80)

# Split by semicolons and execute each statement
statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]

for i, statement in enumerate(statements, 1):
    if not statement or statement.startswith('COMMENT'):
        continue

    print(f"\nExecuting statement {i}/{len(statements)}:")
    print(statement[:100] + "..." if len(statement) > 100 else statement)

    try:
        # Using the admin API to execute SQL directly
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/__execute_sql",
            headers=headers,
            json={"sql": statement + ";"}
        )

        if response.status_code in [200, 201, 204]:
            print(f"✓ Success")
        else:
            print(f"✗ Failed: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"✗ Error: {e}")

print("\n" + "-" * 80)
print("Migration application complete!")
