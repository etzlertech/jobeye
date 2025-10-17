# Tasks: Job Assignment and Crew Hub Dashboard

**Feature**: Job Assignment and Crew Hub Dashboard
**Branch**: `main` (MAIN-ONLY WORKFLOW - all commits go directly to main)
**Input**: Design documents from `/Users/travisetzler/Documents/GitHub/jobeye/specs/010-job-assignment-and/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

---

## ⚠️ CRITICAL REMINDERS

1. **Main-Only Workflow**: All commits go directly to `main` branch. Never create or switch branches.
2. **getRequestContext() Mandatory**: Every API route and page component MUST call `getRequestContext()` first
3. **TenantBadge Required**: All UI pages MUST display TenantBadge for visual context verification
4. **TDD Approach**: Tests must be written and failing before implementation
5. **Pre-commit Hook**: Run `npm run pre-commit` before every commit (DO NOT skip)

---

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no shared dependencies)
- File paths are absolute for clarity
- Each task is independently executable

---

## Phase 3.1: Setup & Prerequisites

**Foundation tasks that must complete before development**

- [ ] **T001** [P] Verify test accounts exist in production database (`super@tophand.tech`, `crew@tophand.tech`)
  - Query: `SELECT email, role FROM users_extended WHERE email IN ('super@tophand.tech', 'crew@tophand.tech')`
  - If missing, create via Supabase Auth API or seed script
  - Verify both have correct `app_metadata.tenant_id` in JWT

- [ ] **T002** [P] Extend RequestContext interface in `/Users/travisetzler/Documents/GitHub/jobeye/src/lib/auth/context.ts`
  - Add `isCrew: boolean` (role === 'technician')
  - Add `isSupervisor: boolean` (role === 'manager' || role === 'admin')
  - Update `getRequestContext()` implementation to compute these fields
  - CRITICAL: This blocks all API route tasks

---

## Phase 3.2: Database Migration & Schema

**Database changes must be applied before any code implementation**

- [ ] **T003** Create migration file `/Users/travisetzler/Documents/GitHub/jobeye/supabase/migrations/010_job_assignments.sql`
  - Create `job_assignments` table with all columns from data-model.md
  - Add tenant_id, job_id, user_id, assigned_by, assigned_at, timestamps
  - Add UNIQUE constraint (tenant_id, job_id, user_id)
  - Add foreign keys with CASCADE rules
  - Add indexes: tenant, job, user, composite(tenant_id, user_id)
  - Enable RLS with `app_metadata.tenant_id` pattern
  - Create `tenant_isolation` RLS policy
  - Create `crew_view_own_assignments` RLS policy
  - Create `supervisor_manage_assignments` RLS policy
  - CRITICAL: Use constitutional RLS pattern from data-model.md

- [ ] **T004** Create sync trigger function in migration file (same as T003)
  - `CREATE FUNCTION sync_job_assigned_to()` for backward compatibility
  - Trigger updates `jobs.assigned_to` field when job_assignments change
  - ON INSERT: Set assigned_to to first crew member
  - ON DELETE: Update assigned_to to next crew member or NULL

- [ ] **T005** Apply migration to production database
  - Use Supabase MCP `apply_migration` tool OR
  - Use Python script method: `client.rpc('exec_sql', {sql})`
  - Verify table created: `SELECT * FROM information_schema.tables WHERE table_name = 'job_assignments'`
  - Verify RLS enabled: `SELECT * FROM pg_policies WHERE tablename = 'job_assignments'`
  - CRITICAL: Do NOT use `psql` or `npx supabase db push` (they don't work)

- [ ] **T006** [P] Backfill existing assignments from `jobs.assigned_to` to `job_assignments` table
  - Script: `scripts/backfill-job-assignments.ts`
  - Query existing jobs with assigned_to IS NOT NULL
  - INSERT INTO job_assignments for each assignment
  - Verify backfill count matches expected (17 assignments from research.md)

- [ ] **T006a** Regenerate Supabase TypeScript types
  - Run: `npm run generate:types` (or `supabase gen types typescript --linked`)
  - Verify: `src/types/database.ts` includes `job_assignments` table types
  - **DO NOT commit yet** - hold until T007-T015 tests validate schema
  - If migration needs tweaking, regenerate types again after fix
  - Commit types together with tests in T015 (avoid double-commit)
  - **CRITICAL**: This MUST complete before any TypeScript code is written (T007+)

---

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE IMPLEMENTATION

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation tasks in Phase 3.4**

### Contract Tests (API Contracts)

- [ ] **T007** [P] Contract test POST /api/jobs/[jobId]/assign
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/api/job-assignment.api.test.ts`
  - Test valid assignment request (supervisor assigns crew)
  - Test invalid user_id format (400)
  - Test non-crew member assignment (400)
  - Test duplicate assignment (400 or success with message)
  - Test unauthorized (non-supervisor) request (403)
  - Test job not found (404)
  - Test assignment to completed job (422)
  - Assert request/response schemas match OpenAPI spec

- [ ] **T008** [P] Contract test DELETE /api/jobs/[jobId]/unassign
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/api/job-unassignment.api.test.ts`
  - Test valid unassignment (supervisor removes crew)
  - Test missing user_id parameter (400)
  - Test unauthorized request (403)
  - Test assignment not found (404)
  - Assert response schema matches OpenAPI spec

- [ ] **T009** [P] Contract test GET /api/crew/jobs
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/api/crew-jobs.api.test.ts`
  - Test crew member gets their assigned jobs
  - Test jobs sorted by scheduled_start ASC
  - Test load status computed correctly (total_items, loaded_items)
  - Test pagination (limit, offset parameters)
  - Test unauthorized (non-crew) request (403)
  - Assert response schema matches OpenAPI spec

### Integration Tests (Business Logic)

- [ ] **T010** [P] Integration test: Supervisor assigns crew to job (Scenario 1)
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/integration/job-assignment-flow.test.ts`
  - Login as supervisor
  - Assign crew member to job
  - Verify assignment created in database
  - Verify sync trigger updated jobs.assigned_to field
  - Verify crew member can query their assignments

- [ ] **T011** [P] Integration test: Crew views assigned jobs (Scenario 2)
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/integration/crew-hub-flow.test.ts`
  - Login as crew member
  - Query assigned jobs via API
  - Verify jobs sorted by scheduled_start
  - Verify load status included
  - Verify only assigned jobs returned (not all jobs)

- [ ] **T012** [P] Integration test: Multiple crew assigned to same job (Scenario 5)
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/integration/multi-crew-assignment.test.ts`
  - Assign 2+ crew members to same job
  - Verify both see job in their dashboard
  - Verify concurrent item updates don't conflict
  - Verify job_assignments table has multiple rows for same job_id

### RLS Security Tests

- [ ] **T013** [P] RLS test: Tenant isolation on job_assignments table
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/integration/job-assignment-rls.test.ts`
  - Create test users in 2 different tenants
  - Assign job in tenant A to user A
  - Verify user B (tenant B) CANNOT query user A's assignments
  - Verify RLS policy filters by app_metadata.tenant_id

- [ ] **T014** [P] RLS test: Crew can only view own assignments
  - File: Same as T013 (add to job-assignment-rls.test.ts)
  - Create 2 crew members in same tenant
  - Assign job1 to crew A, job2 to crew B
  - Verify crew A cannot query crew B's assignments via SELECT
  - Verify supervisor can query all assignments in tenant

### E2E Tests (User Workflows)

- [ ] **T015** [P] E2E test: Complete assignment workflow (Scenarios 1-4)
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/__tests__/e2e/job-assignment-workflow.e2e.test.ts`
  - Use Playwright to test full user flow
  - Supervisor login → assign crew → verify UI update
  - Crew login → view dashboard → verify job appears
  - Crew opens job → mark items loaded → verify progress
  - Crew views fully loaded job → verify read-only mode
  - **AFTER all tests written and failing**: Commit migration + types + tests together
  - Commit message: "feat: add job_assignments schema and tests (TDD)"
  - This is the TDD checkpoint: schema validated, tests failing, ready for implementation

---

## Phase 3.4: Domain Layer (Repository & Service)

**Core business logic - depends on T002 (RequestContext extension)**

- [ ] **T016** [P] Create JobAssignment types in `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/job-assignment/types/job-assignment.types.ts`
  - Export `JobAssignment` interface (matches data-model.md)
  - Export `JobAssignmentWithDetails` interface
  - Export `AssignJobRequest` interface
  - Export `AssignJobResponse` interface
  - Add JSDoc comments from data-model.md

- [ ] **T017** Create JobAssignmentRepository in `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/job-assignment/repositories/job-assignment.repository.ts`
  - Extend BaseRepository with tenant_id scoping
  - `assignCrewToJob(context, jobId, userId, assignedBy)` - INSERT with conflict handling
  - `unassignCrewFromJob(context, jobId, userId)` - DELETE and return removed row
  - `getAssignmentsForJob(context, jobId)` - SELECT with user JOIN
  - `getAssignmentsForCrew(context, userId)` - SELECT with job JOIN
  - `getAssignmentHistory(context, jobId)` - SELECT with supervisor JOIN
  - ALL methods MUST accept RequestContext as first parameter
  - ALL queries MUST filter by context.tenantId
  - Use Supabase client with RLS enforcement (no service role)

- [ ] **T018** Create JobAssignmentService in `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/job-assignment/services/job-assignment.service.ts`
  - `validateAssignment(context, jobId, userId)` - Business rule validation
    - Check user role is 'technician'
    - Check job status is not 'completed' or 'cancelled'
    - Check supervisor permission (context.isSupervisor)
  - `assignCrewToJob(context, jobId, userIds[])` - Bulk assignment with validation
  - `unassignCrewFromJob(context, jobId, userId)` - Unassignment with validation
  - `getCrewJobs(context, userId, status, limit, offset)` - Query with load status
  - ALL methods MUST accept RequestContext as first parameter
  - ALL methods call repository with context

- [ ] **T019** [P] Extend Job types in `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/job/types/job-types.ts`
  - Remove `JobStatus.ASSIGNED` enum value (type mismatch from research.md)
  - Add optional fields: `assigned_crew`, `assigned_crew_ids`, `assignment_count`
  - Add optional fields: `total_items`, `loaded_items`, `load_percentage`
  - Mark `assigned_to` and `assigned_team` as @deprecated
  - Add `JobWithAssignment` interface for crew dashboard

---

## Phase 3.5: API Routes (Backend Endpoints)

**REST API implementation - depends on T017, T018 (Domain layer)**

- [ ] **T020** Create POST /api/jobs/[jobId]/assign route
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/jobs/[jobId]/assign/route.ts`
  - **CRITICAL**: Add Next.js export config at top: `export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';`
  - **CRITICAL**: First line MUST be `const context = await getRequestContext(request)`
  - Validate context.isSupervisor === true (403 if false)
  - Parse request body: `AssignJobRequest` schema
  - Call `jobAssignmentService.assignCrewToJob(context, jobId, userIds)`
  - Return `AssignJobResponse` with assignments array
  - Handle errors: 400 (validation), 403 (permission), 404 (not found), 422 (business rule)
  - Add error logging with context.tenantId
  - **Why dynamic export**: Prevents Next.js static export failure, ensures server-side execution

- [ ] **T021** Create DELETE /api/jobs/[jobId]/unassign route
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/jobs/[jobId]/unassign/route.ts`
  - **CRITICAL**: Add Next.js export config: `export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';`
  - **CRITICAL**: First line MUST be `const context = await getRequestContext(request)`
  - Validate context.isSupervisor === true (403 if false)
  - Parse query parameter: `user_id` (required)
  - Call `jobAssignmentService.unassignCrewFromJob(context, jobId, userId)`
  - Return success response with removed assignment
  - Handle errors: 400 (missing param), 403 (permission), 404 (not found)

- [ ] **T022** Create GET /api/crew/jobs route
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/crew/jobs/route.ts`
  - **CRITICAL**: Add Next.js export config: `export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';`
  - **CRITICAL**: First line MUST be `const context = await getRequestContext(request)`
  - Validate context.isCrew === true (403 if false)
  - Parse query parameters: `status`, `limit`, `offset`
  - Call `jobAssignmentService.getCrewJobs(context, context.userId, ...)`
  - Compute load status for each job (query job_checklist_items)
  - Sort by scheduled_start ASC
  - Return response with jobs array, total_count, has_more
  - Handle errors: 403 (not crew member), 500 (server error)

---

## Phase 3.6: UI Components (Frontend)

**React components - depends on T022 (API routes) for data fetching**

- [ ] **T023** [P] Create JobTile component
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/components/crew/JobTile.tsx`
  - Props: `job: JobWithAssignment`, `onClick: () => void`
  - Display: job_number, customer_name, property_address, scheduled_start
  - Display: LoadStatusBadge component (T024)
  - Display: Status badge (scheduled, in_progress, etc.)
  - Display: Priority indicator (high, urgent)
  - Style: Match supervisor dashboard design (2-column grid, same spacing/fonts)
  - CRITICAL: Extract and reuse existing job tile styles from supervisor dashboard

- [ ] **T024** [P] Create LoadStatusBadge component
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/components/crew/LoadStatusBadge.tsx`
  - Props: `total_items: number`, `loaded_items: number`
  - Display: "X/Y items loaded" with progress bar or percentage
  - Color coding: red (0%), yellow (<100%), green (100%)
  - Return null if total_items === 0

- [ ] **T025** Create Crew Hub dashboard page
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/crew-hub/page.tsx`
  - **CRITICAL**: First line MUST be `const context = await getRequestContext()`
  - **CRITICAL**: Display `<TenantBadge tenantName={context.tenantName} role={context.roles[0]} />`
  - Verify context.isCrew === true (redirect to home if false)
  - Fetch assigned jobs: `GET /api/crew/jobs?status=scheduled`
  - Display "My Jobs" section header
  - Render JobTile components in 2-column grid
  - Handle loading state, empty state ("No jobs assigned yet")
  - Handle errors with user-friendly messages

- [ ] **T026** Create Item Load List page
  - File: `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/jobs/[id]/load-list/page.tsx`
  - **CRITICAL**: First line MUST be `const context = await getRequestContext()`
  - **CRITICAL**: Display `<TenantBadge />`
  - Verify user is assigned to this job (query job_assignments)
  - Fetch job details and checklist items
  - Display job header: job_number, customer, property
  - Display checklist items with checkboxes/buttons to mark loaded
  - Update item status via API (existing endpoint or new one)
  - Show real-time progress: "3/5 items loaded"
  - Redirect to job details page if all items loaded (FR-013b)

- [ ] **T027** Add "Assign Crew" UI to supervisor job details page
  - File: Modify existing `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/jobs/[id]/page.tsx`
  - Add "Assign Crew" button (visible only if context.isSupervisor)
  - Add crew selection dropdown/modal (fetch users with role='technician')
  - On assign: POST /api/jobs/[jobId]/assign with selected user_ids
  - Display "Assigned Crew" section showing current assignments
  - Add "Remove" button next to each crew member (calls DELETE /api/jobs/[jobId]/unassign)
  - Update UI optimistically on assignment/unassignment

---

## Phase 3.7: Integration & Refinement

**Cross-cutting concerns and polish**

- [ ] **T028** Add navigation link to Crew Hub in main navigation
  - File: Modify existing navigation component (likely `/Users/travisetzler/Documents/GitHub/jobeye/src/components/layout/Navigation.tsx`)
  - Show "Crew Hub" link only if context.isCrew === true
  - Link to `/crew-hub`
  - Add icon (truck or clipboard icon)

- [ ] **T029** [P] Update job repository to include assignments in queries
  - File: Modify `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/job/repositories/job.repository.ts`
  - Add optional JOIN to job_assignments in `getJobById()` method
  - Add `assigned_crew_ids` to result
  - Add method `getJobsWithAssignments(context, filters)` for supervisor view

- [ ] **T030** Add logging for assignment operations
  - Files: T020, T021, T022 (API routes)
  - Log assignment created: `{ action: 'assign_crew', jobId, userId, assignedBy }`
  - Log unassignment: `{ action: 'unassign_crew', jobId, userId }`
  - Log failed authorization attempts
  - Include context.tenantId in all logs for tenant-scoped debugging

- [ ] **T031** [P] Clean up legacy assigned_to usage
  - Search codebase for references to `jobs.assigned_to` field
  - Update or remove code paths that rely on single assignment
  - Add deprecation warnings or migration notices where needed
  - Ensure supervisor UI queries use job_assignments JOIN instead
  - Document any intentional legacy usage (sync trigger maintenance)
  - **Why**: Prevent dead code paths and confusion during maintenance

- [ ] **T031a** [P] Verify TypeScript types are current
  - Verify: `src/types/database.ts` includes job_assignments (should be done in T006a)
  - If missing: Run `npm run generate:types` again
  - Verify types match JobAssignment interface from T016
  - Commit if types changed

---

## Phase 3.8: Testing & Validation

**Verify all tests pass and scenarios work end-to-end**

- [ ] **T032** Run all tests and verify they pass
  - Run: `npm run test` (unit + integration tests)
  - Verify: All contract tests pass (T007-T009)
  - Verify: All integration tests pass (T010-T014)
  - Verify: Coverage ≥80% for new code
  - Fix any failing tests before proceeding

- [ ] **T033** Run E2E tests and verify workflows
  - Run: `npm run test:e2e` (Playwright tests)
  - Verify: T015 E2E test passes
  - Manually test quickstart scenarios 1-10 in production
  - Record any failures or UX issues

- [ ] **T034** [P] Performance testing
  - Test: Crew Hub dashboard load time (<3 seconds from quickstart.md)
  - Test: Assignment API response time (<500ms from plan.md)
  - Use browser dev tools or `npm run test:performance`
  - Optimize if performance targets not met (add indexes, cache, etc.)

- [ ] **T035** [P] RLS isolation verification in production
  - Test: Scenario 7.1 - Crew can only see own assignments
  - Test: Scenario 7.2 - Tenant isolation (different tenants)
  - Test: Verify TenantBadge displays correctly on all pages
  - Test: No "x-tenant-id fallback" warnings in console (auth migration complete)

---

## Phase 3.9: Deployment & Documentation

**Final steps before marking feature complete**

- [ ] **T036** Run pre-commit checks
  - Run: `npm run pre-commit`
  - Fix: TypeScript errors, linting errors, complexity violations
  - Ensure: All directive blocks have correct headers
  - Ensure: All files under complexity budget (300 LoC)

- [ ] **T037** Commit and push to main
  - Stage: All new files and modifications
  - Commit: `git commit -m "feat: job assignment and crew hub dashboard\n\n- Create job_assignments table with RLS policies\n- Add assignment API routes (assign, unassign, crew jobs)\n- Build Crew Hub dashboard with job tiles\n- Add item load list page\n- Extend supervisor UI with crew assignment\n- Include comprehensive tests (contract, integration, RLS, E2E)\n\n🤖 Generated with [Claude Code](https://claude.ai/code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>"`
  - Push: `git push origin main` (Railway auto-deploys)
  - **CRITICAL**: Monitor Railway deployment (T038)

- [ ] **T038** Monitor Railway deployment
  - Wait: 2-3 minutes for deployment to complete
  - Run: `npm run railway:check` to get deployment ID
  - Run: `npm run railway:monitor <deployment-id>` to watch status
  - Verify: Deployment succeeds (status: SUCCESS)
  - If failed: Check logs, fix issues, push again

- [ ] **T039** [P] Test in production environment
  - URL: https://jobeye-production.up.railway.app/
  - Login: super@tophand.tech / demo123
  - Test: Assign crew to job
  - Login: crew@tophand.tech / demo123
  - Test: View assigned jobs in Crew Hub
  - Test: Mark items loaded
  - Verify: All quickstart scenarios work

- [ ] **T040** [P] Update documentation
  - Update: CHANGELOG.md with feature description
  - Update: README.md if crew hub changes user flow
  - Update: API documentation (OpenAPI specs already in contracts/)
  - Document: Any known limitations or Phase 2 items

---

## Dependencies Graph

**Critical path** (blocking tasks):
```
T001, T002 (prerequisites)
  ↓
T003, T004, T005 (database migration - applied but NOT committed)
  ↓
T006 (backfill - parallel with T006a)
  ↓
T006a (regenerate types - DO NOT commit yet)
  ↓
T007-T015 (tests first - TDD, validates schema)
  ↓
[COMMIT CHECKPOINT: migration + types + tests together]
  ↓
T016, T017, T018 (domain layer)
  ↓
T020, T021, T022 (API routes with Next.js export configs)
  ↓
T023-T027 (UI components)
  ↓
T028-T031a (integration + legacy cleanup)
  ↓
T032-T035 (testing & validation)
  ↓
T036-T040 (deployment & docs)
```

**Parallel groups** (can run simultaneously):

**Group 1** (Setup - after completion):
- T001 (verify accounts) [P]
- T002 (extend context) [P]

**Group 2** (Tests - after T005 migration):
- T007, T008, T009 (contract tests) [P]
- T010, T011, T012 (integration tests) [P]
- T013, T014 (RLS tests) [P]
- T015 (E2E test) [P]

**Group 3** (Types & Repository - after tests fail):
- T016 (types) [P]
- T019 (extend job types) [P]
- T017 blocks T018 (repository before service)

**Group 4** (UI Components - after T022 API):
- T023 (JobTile) [P]
- T024 (LoadStatusBadge) [P]
- Then T025, T026, T027 (pages that use components)

**Group 5** (Integration - after T027):
- T028 (navigation) [P]
- T029 (job repo) [P]
- T030 (logging) [P]
- T031 (legacy cleanup) [P]
- T031a (verify types) [P]

**Group 6** (Validation - after T031):
- T034 (performance) [P]
- T035 (RLS verification) [P]
- T032 blocks T033 (unit tests before E2E)

**Group 7** (Documentation - after T039):
- T040 (update docs) [P]

---

## Parallel Execution Example

Launch multiple independent tests simultaneously:

```bash
# Terminal 1: Contract tests
npm test src/__tests__/api/job-assignment.api.test.ts
npm test src/__tests__/api/job-unassignment.api.test.ts
npm test src/__tests__/api/crew-jobs.api.test.ts

# Terminal 2: Integration tests
npm test src/__tests__/integration/job-assignment-flow.test.ts
npm test src/__tests__/integration/crew-hub-flow.test.ts
npm test src/__tests__/integration/multi-crew-assignment.test.ts

# Terminal 3: RLS tests
npm test src/__tests__/integration/job-assignment-rls.test.ts
```

Or using Task agent parallelism (when appropriate):
```typescript
// Launch T007, T008, T009 together (different files, independent):
await Promise.all([
  agent.executeTask('T007: Contract test POST /api/jobs/[jobId]/assign'),
  agent.executeTask('T008: Contract test DELETE /api/jobs/[jobId]/unassign'),
  agent.executeTask('T009: Contract test GET /api/crew/jobs'),
]);
```

---

## Validation Checklist

**GATE: Verify before marking feature complete**

- [x] All contracts have corresponding tests (T007-T009 cover 3 contracts)
- [x] All entities have model tasks (T016 creates JobAssignment types)
- [x] All tests come before implementation (Phase 3.3 before 3.4)
- [x] Parallel tasks truly independent (checked file paths, no conflicts)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] getRequestContext() required in all API routes (T020-T022)
- [x] TenantBadge required on all UI pages (T025, T026, T027)
- [x] Main-only workflow enforced (no branch creation)
- [x] Pre-commit hook enforced (T036)

---

## Notes for Implementation

1. **TDD is Non-Negotiable**: Tests (T007-T015) MUST be written and failing before implementation (T016-T027). Commit migration + types + tests together after T015 as one TDD checkpoint.

2. **Context Resolution Pattern**: Every API route starts with:
   ```typescript
   const context = await getRequestContext(request);
   if (!context.isSupervisor) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   }
   ```

3. **Tenant Badge Pattern**: Every page includes:
   ```typescript
   <TenantBadge tenantName={context.tenantName} role={context.roles[0]} />
   ```

4. **Database Queries**: All repository methods accept `context: RequestContext` as first parameter and filter by `context.tenantId`

5. **Error Handling**: Use try/catch blocks with meaningful error messages and status codes from OpenAPI specs

6. **Commit Frequency**: Commit after each task completion, push to main immediately

7. **Railway Monitoring**: After every push, actively monitor deployment (don't wait blindly)

8. **Complexity Budget**: Keep files under 300 LoC (split if needed)

9. **No External Dependencies**: This feature uses existing stack (Next.js, React, Supabase, Tailwind)

10. **Migration Safety**: Use idempotent SQL (`IF NOT EXISTS`), single statements (no `DO $$ ... $$` blocks)

11. **Next.js Route Config**: All API routes MUST export `export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';` to prevent static export failures during Railway builds

12. **Type Generation**: Run `npm run generate:types` immediately after migrations to avoid TypeScript compilation errors

13. **Legacy Cleanup**: Actively search and update/remove `assigned_to` field usage to prevent dead code paths

---

## Estimated Timeline

**Total**: ~42 tasks (added T006a type regen, T031 legacy cleanup, T031a verify types), estimated 15-20 hours for experienced developer

- **Phase 3.1**: 1 hour (Setup)
- **Phase 3.2**: 2 hours (Database migration + backfill)
- **Phase 3.3**: 4 hours (Tests first - 9 test tasks)
- **Phase 3.4**: 3 hours (Domain layer - 4 tasks)
- **Phase 3.5**: 3 hours (API routes - 3 tasks)
- **Phase 3.6**: 4 hours (UI components - 5 tasks)
- **Phase 3.7**: 1 hour (Integration - 4 tasks)
- **Phase 3.8**: 2 hours (Testing & validation - 4 tasks)
- **Phase 3.9**: 1 hour (Deployment & docs - 5 tasks)

**Parallelization**: With 3 agents working in parallel on independent tasks, timeline could reduce to ~8-10 hours

---

**Document Version**: 1.0
**Last Updated**: 2025-10-16
**Ready for**: Implementation execution
**Next Command**: Start with T001 or launch parallel setup tasks (T001, T002)
