#!/usr/bin/env python3
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

def execute_sql(sql, description):
    print(f"\n{description}...")
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"sql": sql}
    )
    
    if response.status_code == 204:
        print(f"✅ {description} - Success!")
        return True
    else:
        print(f"❌ {description} - Failed: {response.status_code}")
        print(response.text)
        return False

# Step 1: Create helper functions in public schema
sql_helper_functions = """
-- Helper function to get user's app metadata
CREATE OR REPLACE FUNCTION get_app_metadata()
RETURNS JSONB AS $$
  SELECT 
    COALESCE(
      auth.jwt() -> 'app_metadata',
      '{}'::jsonb
    )
$$ LANGUAGE SQL STABLE;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
  SELECT (get_app_metadata() ->> 'tenant_id')::UUID
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT 
    CASE 
      WHEN get_app_metadata() -> 'roles' ? role_name THEN true
      ELSE false
    END
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user is system admin
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN AS $$
  SELECT has_role('system_admin')
$$ LANGUAGE SQL STABLE;
"""

# Step 2: Enable RLS on tables
sql_enable_rls = """
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
"""

# Step 3: Create RLS policies for tenants
sql_tenant_policies = """
-- System admins can do everything
CREATE POLICY "System admins full access on tenants" ON tenants
  FOR ALL USING (is_system_admin());

-- Users can view tenants they belong to
CREATE POLICY "Users can view their tenants" ON tenants
  FOR SELECT USING (
    id = get_tenant_id() OR
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.status = 'active'
    )
  );

-- Tenant admins can update their own tenant
CREATE POLICY "Tenant admins can update own tenant" ON tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'tenant_admin'
        AND tenant_members.status = 'active'
    )
  );
"""

# Step 4: Create RLS policies for tenant_members
sql_member_policies = """
-- System admins can do everything
CREATE POLICY "System admins full access on members" ON tenant_members
  FOR ALL USING (is_system_admin());

-- Users can view members of their tenants
CREATE POLICY "Users can view tenant members" ON tenant_members
  FOR SELECT USING (
    tenant_id = get_tenant_id() OR
    user_id = auth.uid()
  );

-- Tenant admins can manage members
CREATE POLICY "Tenant admins can insert members" ON tenant_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'tenant_admin'
        AND tm.status = 'active'
    )
  );

CREATE POLICY "Tenant admins can update members" ON tenant_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'tenant_admin'
        AND tm.status = 'active'
    )
  );

CREATE POLICY "Tenant admins can delete members" ON tenant_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.tenant_id = tenant_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'tenant_admin'
        AND tm.status = 'active'
    )
  );
"""

# Step 5: Create RLS policies for tenant_invitations
sql_invitation_policies = """
-- System admins can do everything
CREATE POLICY "System admins full access on invitations" ON tenant_invitations
  FOR ALL USING (is_system_admin());

-- Tenant admins can manage invitations
CREATE POLICY "Tenant admins can view invitations" ON tenant_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenant_invitations.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'tenant_admin'
        AND tenant_members.status = 'active'
    )
  );

CREATE POLICY "Tenant admins can create invitations" ON tenant_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenant_invitations.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'tenant_admin'
        AND tenant_members.status = 'active'
    )
  );

CREATE POLICY "Tenant admins can update invitations" ON tenant_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenant_invitations.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'tenant_admin'
        AND tenant_members.status = 'active'
    )
  );

-- Users can view invitations for their email
CREATE POLICY "Users can view own invitations" ON tenant_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
"""

# Step 6: Grant permissions
sql_grant_permissions = """
GRANT ALL ON tenants TO authenticated;
GRANT ALL ON tenant_members TO authenticated;
GRANT ALL ON tenant_invitations TO authenticated;
"""

# Execute all steps
print("🚀 Starting RLS setup...\n")

success = True
success = execute_sql(sql_helper_functions, "Creating helper functions") and success
success = execute_sql(sql_enable_rls, "Enabling RLS") and success
success = execute_sql(sql_tenant_policies, "Creating tenant policies") and success
success = execute_sql(sql_member_policies, "Creating member policies") and success
success = execute_sql(sql_invitation_policies, "Creating invitation policies") and success
success = execute_sql(sql_grant_permissions, "Granting permissions") and success

if success:
    print("\n✅ All RLS policies created successfully!")
    print("\nEnabled RLS on:")
    print("  - tenants")
    print("  - tenant_members")
    print("  - tenant_invitations")
    print("\nCreated helper functions:")
    print("  - get_app_metadata()")
    print("  - get_tenant_id()")
    print("  - has_role()")
    print("  - is_system_admin()")
else:
    print("\n❌ Some operations failed. Check the errors above.")