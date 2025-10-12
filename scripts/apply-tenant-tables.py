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

# Step 1: Create tenant_members table
sql_tenant_members = """
CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'tenant_admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'deactivated')),
  joined_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_status ON tenant_members(status);
"""

# Step 2: Create tenant_invitations table
sql_tenant_invitations = """
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'tenant_admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON tenant_invitations(status);
"""

# Step 3: Add unique constraint for pending invitations
sql_unique_constraint = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitations 
  ON tenant_invitations(tenant_id, email) 
  WHERE status = 'pending';
"""

# Step 4: Create helper functions
sql_helper_functions = """
-- Helper function to get user's app metadata
CREATE OR REPLACE FUNCTION auth.app_metadata()
RETURNS JSONB AS $$
  SELECT 
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata',
      '{}'::jsonb
    )
$$ LANGUAGE SQL STABLE;

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT (auth.app_metadata() ->> 'tenant_id')::UUID
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION auth.has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT 
    CASE 
      WHEN auth.app_metadata() -> 'roles' ? role_name THEN true
      ELSE false
    END
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user is system admin
CREATE OR REPLACE FUNCTION auth.is_system_admin()
RETURNS BOOLEAN AS $$
  SELECT auth.has_role('system_admin')
$$ LANGUAGE SQL STABLE;
"""

# Step 5: Create update trigger
sql_update_trigger = """
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_members_updated_at BEFORE UPDATE ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
"""

# Execute all steps
print("🚀 Starting tenant table creation...\n")

success = True
success = execute_sql(sql_tenant_members, "Creating tenant_members table") and success
success = execute_sql(sql_tenant_invitations, "Creating tenant_invitations table") and success
success = execute_sql(sql_unique_constraint, "Adding unique constraint") and success
success = execute_sql(sql_helper_functions, "Creating helper functions") and success
success = execute_sql(sql_update_trigger, "Creating update triggers") and success

if success:
    print("\n✅ All tenant tables and functions created successfully!")
    print("\nCreated:")
    print("  - tenant_members table")
    print("  - tenant_invitations table")
    print("  - auth.app_metadata() function")
    print("  - auth.tenant_id() function")
    print("  - auth.has_role() function")
    print("  - auth.is_system_admin() function")
    print("\nNote: RLS policies will be added in the next step.")
else:
    print("\n❌ Some operations failed. Check the errors above.")