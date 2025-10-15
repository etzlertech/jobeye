# Fix RLS Infinite Recursion - Manual Instructions

## Problem
The `users_extended` table has an RLS policy that creates infinite recursion:
```
infinite recursion detected in policy for relation "users_extended"
```

This happens because the policy "Admins can view all users in tenant" queries `users_extended` while being evaluated ON `users_extended`, creating a circular dependency.

## Solution
Apply the migration `100_fix_users_extended_rls_recursion.sql` to fix this issue.

## Manual Steps (Since CLI tools aren't working)

### Option 1: Via Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/rtwigjwqufozqfwozpvo/sql/new
2. Copy and paste the contents of `supabase/migrations/100_fix_users_extended_rls_recursion.sql`
3. Click "Run" to execute the SQL

### Option 2: Apply Just the Critical Fix
If you want to apply only the most critical fix first, run this SQL in the Supabase dashboard:

```sql
-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all users in tenant" ON users_extended;

-- Recreate using JWT claims instead of recursive query
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
```

## What This Fix Does
- **Before**: Policy queries `users_extended` table to check if user is admin → infinite recursion
- **After**: Policy uses JWT `app_metadata` claims to check role → no recursion
- Uses `auth.jwt() -> 'app_metadata'` to read role and tenant_id directly from the JWT token
- This avoids querying the `users_extended` table during policy evaluation

## After Applying
1. Test the jobs API: https://jobeye-production.up.railway.app/api/supervisor/jobs?simple=true
2. Verify the job status page works: https://jobeye-production.up.railway.app/supervisor/job-status
3. Check that load counts and item cards display correctly

## Files
- Full migration: `supabase/migrations/100_fix_users_extended_rls_recursion.sql`
- This instruction file: `FIX_RLS_INSTRUCTIONS.md`
