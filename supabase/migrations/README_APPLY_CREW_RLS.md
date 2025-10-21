# Applying the Crew RLS Migration

## Issue
Crew members cannot see jobs assigned to them due to missing RLS (Row Level Security) policies.

## Migration File
`20251020230000_add_crew_rls_policies.sql`

## How to Apply

✅ **Already Applied via Supabase MCP** on 2025-10-20

If you need to reapply or apply to another environment:

### Option 1: Supabase MCP (Programmatic)
```bash
npm run mcp:apply-migration
```

### Option 2: Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/rtwigjwqufozqfwozpvo/sql
2. Click "New query"
3. Copy the contents of `20251020230000_add_crew_rls_policies.sql`
4. Paste into the SQL Editor
5. Click "Run"

### Option 3: Supabase CLI
```bash
supabase db push
```

## What This Does
Creates 4 RLS policies:
1. **Crew can read own assignments** - Allows crew to query `job_assignments` table for their own assignments
2. **Crew can read assigned jobs** - Allows crew to read jobs they're assigned to
3. **Crew can read customers for assigned jobs** - Allows crew to see customer info for their jobs
4. **Crew can read properties for assigned jobs** - Allows crew to see property info for their jobs

## Status
✅ **APPLIED** - These policies have been successfully applied to the database on 2025-10-20

## Testing
After applying the migration:
1. Log in as crew@tophand.tech / demo123
2. Navigate to http://localhost:3000/crew
3. You should see 6 jobs assigned to this crew member

## Rollback
To remove these policies if needed:
```sql
DROP POLICY IF EXISTS "Crew can read own assignments" ON job_assignments;
DROP POLICY IF EXISTS "Crew can read assigned jobs" ON jobs;
DROP POLICY IF EXISTS "Crew can read customers for assigned jobs" ON customers;
DROP POLICY IF EXISTS "Crew can read properties for assigned jobs" ON properties;
```
