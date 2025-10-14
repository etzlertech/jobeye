# Database Issues and Required Migrations

**Date**: 2025-10-14
**Context**: Fixed authentication (401 errors) and API endpoints (500 errors) in supervisor dashboard

## Summary

After fixing authentication issues, discovered that several API endpoints were failing due to missing database tables and Row Level Security (RLS) policy errors.

## Issues Found

### 1. Missing Database Tables

The following tables are referenced in the codebase but do not exist in the database:

- **`crews`** - Required for crew status and assignment tracking
- **`job_assignments`** - Required for linking jobs to crew members
- **`inventory`** - Required for inventory tracking and alerts
- **`activity_logs`** - Required for recent activity feed
- **`job_templates`** - Required for job template information
- **`customers`** - Required for customer information
- **`properties`** - Required for property/location information

### 2. Schema Mismatches

The `jobs` table exists but has different column names than expected:

**Expected columns** (in API code):
- `scheduled_date` (date)
- `scheduled_time` (time)

**Actual columns** (in database):
- `scheduled_start` (timestamp)
- `scheduled_end` (timestamp)

### 3. RLS Policy Infinite Recursion

**Error**: `infinite recursion detected in policy for relation 'users_extended'`

**Impact**: Calling `createServerClient()` in API routes triggers this RLS policy error, preventing any database queries from executing.

**Root Cause**: The `users_extended` view has a recursive RLS policy that causes infinite loop when accessed by server-side code using the anon key.

**Workaround**: Temporarily disabled database queries in affected endpoints and returned empty data arrays.

## Affected API Endpoints

### `/api/supervisor/dashboard/status`
- **Status**: ✅ Working (returns stub data)
- **Fix**: Removed calls to `SupervisorWorkflowService.getDashboardStatus()` which queries non-existent tables
- **Returns**: Empty arrays for `crewStatus`, `inventoryAlerts`, and `recentActivity`

### `/api/supervisor/jobs/today`
- **Status**: ✅ Working (returns empty array)
- **Fix**: Commented out `createServerClient()` call to avoid RLS recursion error
- **Returns**: Empty jobs array

## Recommended Fixes

### Priority 1: Fix RLS Policy Recursion

**Option A**: Update `users_extended` view RLS policy to remove recursion
```sql
-- Inspect current policy
SELECT * FROM pg_policies WHERE tablename = 'users_extended';

-- Remove recursive reference or simplify policy logic
```

**Option B**: Use service role key in `createServerClient()` for API routes to bypass RLS
```typescript
// In src/lib/supabase/server.ts
export async function createServerClient(bypassRLS = false): Promise<SupabaseClient<Database>> {
  const key = bypassRLS
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // ...
}
```

### Priority 2: Create Missing Tables

Run migrations to create the missing tables with proper schemas:

```sql
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  -- Add other crew fields
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  crew_id UUID NOT NULL REFERENCES crews(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id)
);

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  -- Add other inventory fields
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Priority 3: Restore Full API Functionality

Once RLS and missing tables are fixed:

1. Uncomment database queries in `/api/supervisor/jobs/today`
2. Restore `SupervisorWorkflowService.getDashboardStatus()` call in `/api/supervisor/dashboard/status`
3. Add proper joins to fetch customer, property, and template data for jobs
4. Implement full crew assignment tracking

## Testing Checklist

- [ ] Fix users_extended RLS policy
- [ ] Create missing database tables
- [ ] Test `/api/supervisor/dashboard/status` with real data
- [ ] Test `/api/supervisor/jobs/today` with real jobs
- [ ] Verify crew assignments work correctly
- [ ] Verify inventory alerts appear when stock is low
- [ ] Verify activity logs are recorded and displayed

## Related Files

- `/src/app/api/supervisor/dashboard/status/route.ts` - Dashboard status endpoint
- `/src/app/api/supervisor/jobs/today/route.ts` - Today's jobs endpoint
- `/src/domains/supervisor/services/supervisor-workflow.service.ts` - Service that queries missing tables
- `/src/lib/supabase/server.ts` - Server client creation (triggers RLS error)
- `/src/lib/auth/with-auth.ts` - Auth wrapper used by API routes

## Notes

- All changes made to fix immediate issues are marked with `TODO` comments
- Stub data is currently being returned to unblock development
- Authentication is now working correctly (401 errors resolved)
- No data loss occurred - just returning empty arrays until tables exist
