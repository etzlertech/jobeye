#!/usr/bin/env python3
"""
Apply RLS fix migration directly to Supabase database
Following CLAUDE.md guidance for database operations
"""
import requests
import sys

SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# SQL statements to execute (broken into individual statements)
statements = [
    # Drop the problematic policy
    "DROP POLICY IF EXISTS \"Admins can view all users in tenant\" ON users_extended",

    # Recreate using JWT claims
    """CREATE POLICY "Admins can view all users in tenant" ON users_extended
FOR SELECT
USING (
  auth.uid() = id
  OR
  (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    AND
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
  )
)""",

    # Fix user_sessions policy
    "DROP POLICY IF EXISTS \"Admins can view tenant sessions\" ON user_sessions",
    """CREATE POLICY "Admins can view tenant sessions" ON user_sessions
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    AND
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
  )
)""",

    # Fix tenant_assignments policy
    "DROP POLICY IF EXISTS \"Admins can manage tenant assignments\" ON tenant_assignments",
    """CREATE POLICY "Admins can manage tenant assignments" ON tenant_assignments
FOR ALL
USING (
  auth.uid() = user_id
  OR
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
)""",

    # Fix permissions policies
    "DROP POLICY IF EXISTS \"Admins can manage permissions\" ON permissions",
    "DROP POLICY IF EXISTS \"Users can view permissions\" ON permissions",
    """CREATE POLICY "Users can view permissions" ON permissions
FOR SELECT
USING (true)""",
    """CREATE POLICY "Admins can manage permissions" ON permissions
FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
)""",

    # Fix role_permissions policies
    "DROP POLICY IF EXISTS \"Admins can manage role permissions\" ON role_permissions",
    "DROP POLICY IF EXISTS \"Users can view role permissions\" ON role_permissions",
    """CREATE POLICY "Users can view role permissions" ON role_permissions
FOR SELECT
USING (true)""",
    """CREATE POLICY "Admins can manage role permissions" ON role_permissions
FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
)""",

    # Fix user_permissions policies
    "DROP POLICY IF EXISTS \"Admins can manage user permissions\" ON user_permissions",
    "DROP POLICY IF EXISTS \"Users can view own permission overrides\" ON user_permissions",
    """CREATE POLICY "Users can view own permission overrides" ON user_permissions
FOR SELECT
USING (auth.uid() = user_id)""",
    """CREATE POLICY "Admins can manage user permissions" ON user_permissions
FOR ALL
USING (
  auth.uid() = user_id
  OR
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
)""",

    # Fix auth_audit_log policy
    "DROP POLICY IF EXISTS \"Admins can view tenant audit logs\" ON auth_audit_log",
    """CREATE POLICY "Admins can view tenant audit logs" ON auth_audit_log
FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  AND
  (
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
    OR tenant_id IS NULL
  )
)""",

    # Fix user_invitations policy
    "DROP POLICY IF EXISTS \"Admins can manage invitations\" ON user_invitations",
    """CREATE POLICY "Admins can manage invitations" ON user_invitations
FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text IN ('admin', 'manager')
)"""
]

print("=" * 80)
print("Applying RLS Fix Migration to Supabase Database")
print("=" * 80)
print(f"Database: {SUPABASE_URL}")
print(f"Statements to execute: {len(statements)}")
print("=" * 80)

success_count = 0
error_count = 0

for i, sql in enumerate(statements, 1):
    statement_preview = sql[:100].replace('\n', ' ') + "..." if len(sql) > 100 else sql.replace('\n', ' ')
    print(f"\n[{i}/{len(statements)}] Executing: {statement_preview}")

    try:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"sql": sql}
        )

        if response.status_code in [200, 201, 204]:
            print(f"  ✓ Success (HTTP {response.status_code})")
            success_count += 1
        else:
            print(f"  ✗ Failed (HTTP {response.status_code})")
            print(f"  Response: {response.text}")
            error_count += 1

    except Exception as e:
        print(f"  ✗ Exception: {e}")
        error_count += 1

print("\n" + "=" * 80)
print(f"Migration Complete: {success_count} succeeded, {error_count} failed")
print("=" * 80)

if error_count > 0:
    print("\n⚠️  Some statements failed. Check the errors above.")
    sys.exit(1)
else:
    print("\n✓ All RLS policies successfully updated!")
    print("\nNext: Test the jobs API to verify the fix:")
    print("  https://jobeye-production.up.railway.app/api/supervisor/jobs?simple=true")
    sys.exit(0)
