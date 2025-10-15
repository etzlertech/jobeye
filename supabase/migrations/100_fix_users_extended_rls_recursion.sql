-- Migration: 100_fix_users_extended_rls_recursion.sql
-- Purpose: Fix infinite recursion in users_extended RLS policies
-- Issue: The "Admins can view all users in tenant" policy creates circular dependency

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins can view all users in tenant" ON users_extended;

-- Recreate the policy using auth.jwt() to avoid recursive lookups
-- This uses JWT claims instead of querying users_extended table again
CREATE POLICY "Admins can view all users in tenant" ON users_extended
FOR SELECT
USING (
  -- Allow users to see themselves
  auth.uid() = id
  OR
  -- Allow admins to see users in their tenant using JWT metadata
  (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    AND
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
  )
);

-- Also fix similar patterns in other user-related policies if they exist
DROP POLICY IF EXISTS "Admins can view tenant sessions" ON user_sessions;
CREATE POLICY "Admins can view tenant sessions" ON user_sessions
FOR SELECT
USING (
  -- Users can see their own sessions
  auth.uid() = user_id
  OR
  -- Admins can see sessions in their tenant using JWT metadata
  (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    AND
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
  )
);

DROP POLICY IF EXISTS "Admins can manage tenant assignments" ON tenant_assignments;
CREATE POLICY "Admins can manage tenant assignments" ON tenant_assignments
FOR ALL
USING (
  -- Users can see their own assignments
  auth.uid() = user_id
  OR
  -- Admins can manage assignments using JWT metadata
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
);

DROP POLICY IF EXISTS "Admins can manage permissions" ON permissions;
CREATE POLICY "Admins can view permissions" ON permissions
FOR SELECT
USING (true); -- All users can view available permissions

CREATE POLICY "Admins can manage permissions" ON permissions
FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
);

DROP POLICY IF EXISTS "Admins can manage role permissions" ON role_permissions;
CREATE POLICY "Users can view role permissions" ON role_permissions
FOR SELECT
USING (true); -- All users can view role permissions

CREATE POLICY "Admins can manage role permissions" ON role_permissions
FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
);

DROP POLICY IF EXISTS "Admins can manage user permissions" ON user_permissions;
CREATE POLICY "Users can view own permission overrides" ON user_permissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user permissions" ON user_permissions
FOR ALL
USING (
  auth.uid() = user_id
  OR
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
);

DROP POLICY IF EXISTS "Admins can view tenant audit logs" ON auth_audit_log;
CREATE POLICY "Admins can view tenant audit logs" ON auth_audit_log
FOR SELECT
USING (
  -- Admins can view logs for their tenant using JWT metadata
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  AND
  (
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id
    OR tenant_id IS NULL
  )
);

DROP POLICY IF EXISTS "Admins can manage invitations" ON user_invitations;
CREATE POLICY "Admins can manage invitations" ON user_invitations
FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text IN ('admin', 'manager')
);

-- Add comment
COMMENT ON POLICY "Admins can view all users in tenant" ON users_extended IS
'Fixed infinite recursion by using JWT app_metadata instead of querying users_extended table';
