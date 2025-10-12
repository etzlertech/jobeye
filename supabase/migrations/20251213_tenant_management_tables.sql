-- Tenant Management Tables
-- This migration creates the core tables for multi-tenant management

-- Create tenants table if it doesn't exist
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Create tenant_members table
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
  
  -- Ensure user can only have one membership per tenant
  UNIQUE(tenant_id, user_id)
);

-- Create indexes for tenant_members
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_status ON tenant_members(status);

-- Create tenant_invitations table
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

-- Create indexes for tenant_invitations
CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON tenant_invitations(status);

-- Add updated_at trigger for tenants
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

-- Create RLS policies for tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- System admins can do everything
CREATE POLICY "System admins full access" ON tenants
  FOR ALL USING (auth.is_system_admin());

-- Tenant admins can view and update their own tenant
CREATE POLICY "Tenant admins can view own tenant" ON tenants
  FOR SELECT USING (
    id = auth.tenant_id() OR
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.status = 'active'
    )
  );

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

-- Create RLS policies for tenant_members
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- System admins can do everything
CREATE POLICY "System admins full access" ON tenant_members
  FOR ALL USING (auth.is_system_admin());

-- Users can view members of their tenants
CREATE POLICY "Users can view tenant members" ON tenant_members
  FOR SELECT USING (
    tenant_id = auth.tenant_id() OR
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

-- Create RLS policies for tenant_invitations
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- System admins can do everything
CREATE POLICY "System admins full access" ON tenant_invitations
  FOR ALL USING (auth.is_system_admin());

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

-- Grant necessary permissions
GRANT ALL ON tenants TO authenticated;
GRANT ALL ON tenant_members TO authenticated;
GRANT ALL ON tenant_invitations TO authenticated;

-- Add partial unique index to prevent duplicate pending invitations
CREATE UNIQUE INDEX idx_unique_pending_invitations 
  ON tenant_invitations(tenant_id, email) 
  WHERE status = 'pending';

-- Add comment for documentation
COMMENT ON TABLE tenants IS 'Core tenant/organization table for multi-tenancy';
COMMENT ON TABLE tenant_members IS 'Links users to tenants with specific roles';
COMMENT ON TABLE tenant_invitations IS 'Pending invitations to join tenants';
COMMENT ON FUNCTION auth.tenant_id() IS 'Returns current user tenant_id from JWT metadata';
COMMENT ON FUNCTION auth.has_role(TEXT) IS 'Check if current user has specific role';
COMMENT ON FUNCTION auth.is_system_admin() IS 'Check if current user is system admin';