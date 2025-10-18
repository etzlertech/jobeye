# Lessons Learned: Job Assignment Feature Implementation

**Date**: 2025-10-17
**Feature**: Job Assignment and Crew Hub (specs/010-job-assignment-and)
**Severity**: Critical - Multiple production blockers

## 🎯 Executive Summary

Implementing the job assignment feature revealed critical issues with **Row Level Security (RLS) permissions** and **database schema mismatches** that caused assignments to fail silently or return empty results despite data being present in the database.

**Key Learning**: Always use **service role clients** for internal API operations that need to bypass RLS, even when user permissions have already been verified at the API route level.

---

## 🔴 Critical Issues Encountered

### Issue 1: Column Name Mismatch (`assigned_user_id` vs `user_id`)

**Problem**:
- Code was querying `job_assignments.assigned_user_id`
- Actual database column was `job_assignments.user_id`
- PostgreSQL error: `column job_assignments.assigned_user_id does not exist` (code 42703)

**Root Cause**:
- Code was written based on assumed schema instead of querying actual database schema
- No type safety between database schema and TypeScript types

**Solution**:
- Used Supabase MCP to query actual database schema
- Changed all references from `assigned_user_id` to `user_id`
- File: `src/app/api/supervisor/jobs/[jobId]/route.ts:93`

**Lesson**:
> **Always verify actual database schema via MCP before writing queries. Never assume column names.**

---

### Issue 2: Non-existent `email` Column in `users_extended`

**Problem**:
- Code tried to query `users_extended.email`
- `email` column doesn't exist in `users_extended` table (it's in `auth.users`)
- Query silently failed, returning `null` for user data

**Root Cause**:
- Assumed `users_extended` contained all user data including email
- Actual schema: `users_extended` has `display_name`, `first_name`, `last_name` but NO `email`

**Solution**:
- Removed `email` from `users_extended` select query
- Added `supabase.auth.admin.getUserById()` to fetch email from `auth.users`
- File: `src/app/api/supervisor/jobs/[jobId]/route.ts:115-125`

**Lesson**:
> **User email is stored in `auth.users`, not `users_extended`. Always join with auth tables for email.**

---

### Issue 3: RLS Permission Denied (code 42501)

**Problem**:
- PostgreSQL error: `permission denied for table users` (code 42501)
- Occurred when using regular Supabase client for:
  - `job_assignments` queries
  - `users_extended` queries
  - `auth.admin.getUserById()` calls

**Root Cause**:
- Used **server client** (respects RLS) instead of **service client** (bypasses RLS)
- Even though supervisor permission was verified at API route level, RLS still blocked internal queries

**Solution**:
- Created service role client at top of query section:
```typescript
const {createClient: createServiceClient} = await import('@supabase/supabase-js');
const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```
- Changed ALL queries to use `serviceClient` instead of `supabase`

**Affected Files**:
- `src/app/api/supervisor/jobs/[jobId]/route.ts` (GET endpoint)
- `src/app/api/jobs/[jobId]/assign/route.ts` (POST endpoint)
- `src/app/api/jobs/[jobId]/unassign/route.ts` (DELETE endpoint)

**Lesson**:
> **API routes that perform internal operations must use service role clients to bypass RLS, even when user permissions are already verified. The pattern is:**
> 1. Verify user permission at route level using request context
> 2. Use service client for ALL internal database operations
> 3. Never mix server client and service client in the same operation

---

### Issue 4: Silent Query Failures

**Problem**:
- Queries were failing but API returned 200 OK with empty arrays
- No errors logged, making debugging extremely difficult
- Users saw "no crew assigned" even though assignments existed in database

**Root Cause**:
- Error handling swallowed failures
- Insufficient logging of query results and errors
- No validation that queries actually returned expected data

**Solution**:
- Added comprehensive logging with separators:
```typescript
console.log('============================================');
console.log('[GET /api/supervisor/jobs/[jobId]] COMMIT: 695992d');
console.log('[GET /api/supervisor/jobs/[jobId]] Assignments query result:', {
  assignmentsCount: assignmentsData?.length || 0,
  error: assignmentsError,
  data: assignmentsData
});
console.log('============================================');
```

**Lesson**:
> **Always log query results with counts and errors. Silent failures are the hardest to debug.**

---

## ✅ Best Practices Established

### 1. Database Schema Verification
- **Before writing any query**: Use Supabase MCP to query actual schema
- **Document queries**: Include MCP query output in planning docs
- **Never assume**: Column names, types, or relationships

### 2. Service Client Usage Pattern
```typescript
// ❌ WRONG - Will hit RLS errors
const supabase = await createServerClient();
const { data } = await supabase.from('job_assignments').select();

// ✅ CORRECT - Bypasses RLS for internal operations
const {createClient: createServiceClient} = await import('@supabase/supabase-js');
const serviceClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const { data } = await serviceClient.from('job_assignments').select();
```

### 3. Error Logging Pattern
```typescript
console.log('============================================');
console.log('[ENDPOINT] OPERATION - Commit identifier');
console.log('[ENDPOINT] Input:', { params });
console.log('[ENDPOINT] Query result:', {
  count: data?.length || 0,
  error,
  sample: data?.[0]
});
console.log('============================================');
```

### 4. Type Safety
- Generate TypeScript types from database: `npm run generate:types`
- Use generated types for all database operations
- Validate types match actual schema via MCP queries

---

## 🔍 Debugging Workflow

When assignments aren't showing in UI:

1. **Check Database First**
   ```typescript
   // Use Supabase MCP to query directly
   SELECT * FROM job_assignments WHERE job_id = 'xxx';
   ```

2. **Check API Logs**
   - Look for query result logs with counts
   - Check for RLS permission errors (code 42501)
   - Check for missing column errors (code 42703)

3. **Verify Client Type**
   - Is the query using service client or server client?
   - Service client needed for internal operations

4. **Check Schema Assumptions**
   - Query `information_schema.columns` for actual column names
   - Don't trust old documentation or assumptions

---

## 📊 Impact Metrics

- **Time to Resolution**: ~3 hours
- **Root Causes Identified**: 4 (column names, email location, RLS permissions, silent failures)
- **Files Modified**: 3 API routes + 1 component
- **Commits**: 8 progressive fixes
- **Final Result**: ✅ Full CRUD working (create, read, delete)

---

## 🎓 Key Takeaways

1. **Service Clients are Required**: Any API route that performs write operations or needs to bypass RLS MUST use service role clients.

2. **Verify Schema First**: Always query actual database schema via MCP before writing code. Types can be outdated.

3. **Log Everything**: Comprehensive logging saves hours of debugging. Include commit identifiers in logs.

4. **Auth Tables are Separate**: `email` lives in `auth.users`, not `users_extended`. Always join when needed.

5. **Test with Real Data**: Mock data doesn't reveal RLS or schema issues. Test with actual database queries.

---

## 📝 Checklist for Future Features

- [ ] Query actual database schema via Supabase MCP
- [ ] Document schema in planning docs (include MCP query output)
- [ ] Use service role client for all internal API operations
- [ ] Add comprehensive logging with commit identifiers
- [ ] Test with actual database (not just mocks)
- [ ] Verify RLS policies don't block internal operations
- [ ] Generate and use TypeScript types from database
- [ ] Check for email field location (auth.users vs users_extended)

---

## 🔗 Related Resources

- Supabase MCP Documentation: [link]
- RLS Policies Guide: `supabase/migrations/`
- Service Role Client Pattern: `/src/lib/supabase/server.ts`
- Database Types: `/src/types/database.ts`

---

**Document Owner**: Claude Code
**Last Updated**: 2025-10-17
**Status**: ✅ Resolved - All issues fixed and deployed
