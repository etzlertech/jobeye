# Known Technical Issues

This document tracks known technical debt and issues that require future attention.

**Last Updated**: 2025-10-20

---

## Lessons Learned: Task Creation RLS Refactor (2025-10-20)

**Context**: Fixed cascading errors in task creation endpoint after removing `job_checklist_items` system.

### Error Cascade Pattern
When fixing RLS violations, expect **layered errors** - each fix may expose the next validation layer:

1. **Layer 1: Missing Database Columns** (commit eed1ac5)
   - Error: 400 Bad Request - `requires_photo_verification` and `acceptance_criteria` not in DB
   - Root cause: Repository inserting fields that don't exist in `workflow_tasks` table
   - Fix: Removed non-existent fields from INSERT statements

2. **Layer 2: RLS Policy Violation** (commit d59a8cc)
   - Error: 500 Internal Server Error - "new row violates row-level security policy"
   - Root cause: `workflow_tasks_tenant_isolation` policy requires `tenant_id` match, but repository not inserting `tenant_id`
   - Fix: Updated entire call chain (route → service → repository) to propagate `tenant_id`

3. **Layer 3: Frontend Validation Mismatch** (commit 3c4f551) ← **This was pre-existing**
   - Error: 422 Unprocessable Entity - validation failed on `acceptance_criteria`
   - Root cause: Frontend sending `null`, Zod expecting `string | undefined`
   - **Why exposed now**: Previous RLS errors blocked requests before reaching validation layer
   - Fix: Conditionally omit field from payload instead of sending `null`

### Key Lessons

**1. Zod `.optional()` vs `null`**
```typescript
// ❌ WRONG - Zod .optional() does NOT accept null
z.string().optional()  // Type: string | undefined (NOT string | null)

// Frontend sending:
{ acceptance_criteria: null }  // ❌ Fails validation

// ✅ CORRECT - Omit field entirely when empty
const payload = { /* required fields */ };
if (value.trim()) {
  payload.acceptance_criteria = value.trim();  // ✅ Only include if present
}
```

**2. Nullable Fields in Zod**
If you need to accept `null`, use `.nullable()` or `.nullish()`:
```typescript
z.string().nullable()    // Type: string | null
z.string().nullish()     // Type: string | null | undefined
z.string().optional().nullable()  // Also works
```

**3. Layered Error Diagnosis**
- Fix errors **one layer at a time** (don't assume first error is the only issue)
- Each fix may reveal deeper validation issues
- Use Supabase MCP to verify schema before assuming bug location
- Check Railway logs for actual database error messages (more detailed than browser console)

**4. RLS Policy Integration Checklist**
When adding RLS to existing tables:
- [ ] Query `pg_policies` via MCP to understand policy requirements
- [ ] Trace data flow from route → service → repository
- [ ] Ensure `tenant_id` included in ALL insert/update operations
- [ ] Update ALL callers when changing repository method signatures
- [ ] Test with real data, not just build verification

**5. Frontend/Backend Contract Validation**
- Always match frontend payload structure to backend Zod schemas exactly
- Use TypeScript types generated from Zod schemas when possible (`z.infer<typeof Schema>`)
- Test API endpoints with actual frontend payloads, not just Postman/curl
- Consider adding integration tests for critical CRUD operations

### Files Modified in This Refactor
- `WorkflowTaskRepository.ts` - Added `tenant_id` parameter, removed non-existent columns
- `TaskTemplateService.ts` - Added `tenantId` parameter to `instantiateTemplate()`
- `TaskEditor.tsx` - Fixed `acceptance_criteria: null` → conditionally omit field
- 4 API routes - Updated to pass `tenantId` to service layer

### Prevention Strategy
- Use TypeScript strict mode to catch `null` vs `undefined` issues at compile time
- Add integration tests for multi-tenant CRUD operations
- Document RLS policy requirements in repository JSDocs
- Create shared type definitions for API request/response payloads

---

## TypeScript Type Generation Issues

### Issue: task_definitions Table Shows as `never` Type

**Status**: Known Issue (Pre-existing)
**Severity**: Low (Does not affect runtime)
**Affected Files**: `tests/integration/task-definitions/crud.int.test.ts`

**Description**:
The `task_definitions` table is properly defined in the database with correct RLS policies, but TypeScript infers it as `never` type when using the Supabase client. This causes type errors in integration tests but does not affect runtime behavior.

**Root Cause**:
- Automated type generation blocked by two constraints:
  1. **Supabase CLI not installed locally** (prevents running `npm run generate:types`)
  2. **Supabase MCP hits token limits** (response: 61,886 tokens > maximum: 25,000 tokens)
- Manual type definitions in `src/types/database.ts` are accurate but don't satisfy Supabase client's RLS verification
- Supabase client type system marks RLS-protected tables as `never` when type generation can't verify policies during compilation

**Verification**:
```sql
-- Table exists with 12 columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'task_definitions';
-- Returns: id, tenant_id, name, description, etc.

-- RLS is properly configured
SELECT rowsecurity FROM pg_tables WHERE tablename = 'task_definitions';
-- Returns: true

-- Constitutional RLS policy exists
SELECT policyname FROM pg_policies WHERE tablename = 'task_definitions';
-- Returns: tenant_isolation_task_definitions
```

**Workarounds**:
1. Use type assertions in test files: `as any` or `as Database['public']['Tables']['task_definitions']['Insert']`
2. Run tests with service role key (bypasses RLS for tests)
3. Skip type-check for test files temporarily

**Attempted Solutions**:
- ❌ **MCP generate_typescript_types**: Failed (response exceeds 25,000 token limit)
- ❌ **Manual type definitions**: Accurate but don't satisfy Supabase client RLS verification
- ❌ **Cache clearing**: Does not resolve RLS type inference issue
- ❌ **npx supabase gen types**: Requires Docker Desktop or interactive `supabase login`

**Proper Resolution (Requires User Action)**:

**Option 1: Using Supabase CLI (Recommended)**
```bash
# Install Homebrew version (or use Docker Desktop + npx)
brew install supabase/tap/supabase

# Login interactively
supabase login

# Generate types from remote project
supabase gen types typescript --project-id rtwigjwqufozqfwozpvo > src/types/supabase.ts
```

**Option 2: Using Database URL (Requires Docker Desktop)**
```bash
npx supabase gen types typescript \
  --db-url "postgresql://postgres:Duke-neepo-oliver-ttq5@db.rtwigjwqufozqfwozpvo.supabase.co:5432/postgres" \
  > src/types/supabase.ts
```

**After type generation:**
1. Update imports from `@/types/database` to `@/types/supabase` in codebase
2. Run `npm run type-check` to verify errors resolved
3. Consider upgrading `@supabase/supabase-js` to latest version

**Related Files**:
- `src/types/database.ts` - Manual type definitions
- `tests/integration/task-definitions/crud.int.test.ts` - Affected tests
- `package.json` - Type generation script

---

## Pre-existing RLS Permission Issues

### Issue: RLS Permission Denied on `users` Table

**Status**: Known Issue (Pre-existing)
**Severity**: Medium (Affects 18/37 integration tests)
**Affected Files**: `src/__tests__/integration/job-assignment-rls.test.ts`

**Description**:
Multiple integration tests fail with "permission denied for table users" error when querying the users table through job_assignments.

**Error Message**:
```
{"code": "42501", "details": null, "hint": null, "message": "permission denied for table users"}
```

**Root Cause**:
The `users` table (or `users_extended`) may be missing proper RLS policies for the test user context, or the policies are overly restrictive for certain query patterns.

**Test Failures** (18 total):
- T014: RLS - Crew can only view own assignments (multiple tests)
- T015: RLS - Tenant isolation for assignments
- T016: RLS - Supervisor permissions

**Workaround**:
Tests pass when using service role key directly.

**Proper Resolution**:
1. Review and update RLS policies on `users` / `users_extended` tables
2. Ensure policies allow authenticated users to query their own records
3. Update test setup to properly authenticate test users

---

## Historical Context

### job_checklist_items Table Retirement (2025-10-19)

The `job_checklist_items` table was successfully retired and replaced with the `item_transactions` pattern. See `RETIRED_CHECKLIST_SYSTEM.md` and `CLEANUP_COMPLETE_20251019.md` for full details.

**Status**: ✅ Complete
**No action required**

---

**Last Updated**: 2025-10-19
**Maintainer**: Development Team
