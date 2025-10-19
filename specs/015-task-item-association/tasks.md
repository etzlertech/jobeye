# Tasks: Task-Level Item Association

**Feature**: 015-task-item-association
**Input**: Design documents from `/Users/travisetzler/Documents/GitHub/jobeye/specs/015-task-item-association/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Overview

This tasks list implements task-level item/kit association functionality following TDD principles. Tasks are ordered by dependencies with parallel execution opportunities marked [P].

**Tech Stack**:
- TypeScript 5.3, Next.js 14 (App Router), React 18
- Supabase Client SDK, PostgreSQL 15 with RLS
- Zod validation, Lucide React icons
- Vitest (unit), Playwright (integration)

**Deliverables**:
- 2 new database tables with RLS policies
- 4 new repositories (2 domain repos x 2 association types)
- Service layer enhancements (2 services)
- 10 API routes across 2 endpoint groups
- 7 new UI components
- Integration and unit tests (≥80% coverage)

## Phase 3.1: Database Migration (BLOCKING)

⚠️ **CRITICAL**: T001-T007 must complete before any implementation tasks

- [ ] **T001** Create migration SQL file at `/Users/travisetzler/Documents/GitHub/jobeye/migrations/20251019_add_task_item_associations.sql`
  - Create `task_item_status` ENUM type (pending, loaded, verified, missing, returned)
  - Use idempotent `CREATE TYPE IF NOT EXISTS`
  - Include rollback: `DROP TYPE IF EXISTS task_item_status;`

- [ ] **T002** Add `task_template_item_associations` table to migration file
  - Columns: id (UUID PK), tenant_id (FK), template_item_id (FK), item_id (FK nullable), kit_id (FK nullable), quantity (DECIMAL), is_required (BOOLEAN), notes (TEXT), created_at, updated_at
  - Constraints: XOR check `(item_id IS NOT NULL AND kit_id IS NULL) OR (item_id IS NULL AND kit_id IS NOT NULL)`
  - Unique constraints: `UNIQUE (template_item_id, item_id) WHERE item_id IS NOT NULL` and `UNIQUE (template_item_id, kit_id) WHERE kit_id IS NOT NULL`
  - Foreign keys: CASCADE on template_item_id, RESTRICT on item_id/kit_id
  - Use `CREATE TABLE IF NOT EXISTS`

- [ ] **T003** Add `workflow_task_item_associations` table to migration file
  - Columns: id (UUID PK), tenant_id (FK), workflow_task_id (FK), item_id (FK nullable), kit_id (FK nullable), quantity (DECIMAL), is_required (BOOLEAN), status (task_item_status), loaded_at (TIMESTAMPTZ), loaded_by (UUID FK), notes (TEXT), source_template_association_id (UUID FK), created_at, updated_at
  - Constraints: Same XOR as T002, plus `CHECK ((loaded_at IS NULL AND loaded_by IS NULL) OR (loaded_at IS NOT NULL AND loaded_by IS NOT NULL))`
  - Unique constraints: Same pattern as T002 but for workflow_task_id
  - Foreign keys: CASCADE on workflow_task_id, RESTRICT on item_id/kit_id, nullable FK on source_template_association_id
  - Use `CREATE TABLE IF NOT EXISTS`

- [ ] **T004** Add indexes to migration file
  - Template associations: `idx_template_item_assoc_template_item`, `idx_template_item_assoc_item`, `idx_template_item_assoc_kit`, `idx_template_item_assoc_tenant`
  - Workflow associations: `idx_workflow_task_assoc_task`, `idx_workflow_task_assoc_item`, `idx_workflow_task_assoc_kit`, `idx_workflow_task_assoc_source`, `idx_workflow_task_assoc_status`, `idx_workflow_task_assoc_tenant`
  - Use `CREATE INDEX IF NOT EXISTS` for all
  - Use partial indexes with `WHERE item_id IS NOT NULL` / `WHERE kit_id IS NOT NULL`

- [ ] **T005** Add RLS policies and triggers to migration file
  - Enable RLS on both tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
  - Create tenant_isolation policies using `request.jwt.claims -> 'app_metadata' ->> 'tenant_id'`
  - Create `update_updated_at_column()` function if not exists
  - Add updated_at triggers for both tables
  - Add `set_loaded_timestamp()` function and trigger for workflow associations

- [ ] **T006** Verify migration against actual database schema (Constitution Rule 1)
  - Use Supabase MCP to query `information_schema.tables` for existing tables
  - Use Supabase MCP to query `information_schema.columns` for column definitions
  - Verify no conflicts with existing schema
  - Confirm `update_updated_at_column()` function exists or create it
  - Document findings in migration comments

- [ ] **T007** Apply migration to database via Supabase MCP
  - Execute migration SQL via `mcp__supabase__apply_migration` tool
  - Migration name: `add_task_item_associations`
  - Verify tables created: Query both new tables to confirm
  - Verify RLS enabled: Check `pg_policies` for both tables
  - Verify indexes created: Query `pg_indexes` for all 10 indexes
  - If errors: rollback and fix, do NOT proceed to T008+

## Phase 3.2: Type Definitions and Schemas

- [ ] **T008** [P] Create task-template association types at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/task-template/types/task-template-association-types.ts`
  - Export interfaces: `TaskTemplateItemAssociation`, `CreateTemplateItemAssociationInput`, `UpdateTemplateItemAssociationInput`
  - Export Result type helpers: `Ok`, `Err`, `isOk`, `isErr`
  - Export error types: `RepositoryError`, `ServiceError`
  - Include agent directive block with complexity_budget: 200
  - All fields typed according to data-model.md

- [ ] **T009** [P] Create task-template association schemas at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/task-template/schemas/task-template-association-schemas.ts`
  - Export Zod schemas: `CreateTemplateItemAssociationSchema`, `UpdateTemplateItemAssociationSchema`
  - Implement XOR validation: `.refine((data) => (data.item_id && !data.kit_id) || (!data.item_id && data.kit_id))`
  - Quantity validation: `z.number().positive()`
  - Max length validations: notes max 2000 chars
  - Include agent directive block

- [ ] **T010** [P] Create workflow-task association types at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/workflow-task/types/workflow-task-association-types.ts`
  - Export interfaces: `WorkflowTaskItemAssociation`, `CreateWorkflowTaskItemAssociationInput`, `UpdateWorkflowTaskItemAssociationInput`
  - Export type: `TaskItemStatus` = 'pending' | 'loaded' | 'verified' | 'missing' | 'returned'
  - Export Result type helpers (same as T008)
  - Export error types (same as T008)
  - Include agent directive block with complexity_budget: 200

- [ ] **T011** [P] Create workflow-task association schemas at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/workflow-task/schemas/workflow-task-association-schemas.ts`
  - Export Zod schemas: `CreateWorkflowTaskItemAssociationSchema`, `UpdateWorkflowTaskItemAssociationSchema`, `TaskItemStatusSchema`
  - Same XOR validation as T009
  - Status enum: `z.enum(['pending', 'loaded', 'verified', 'missing', 'returned'])`
  - Include agent directive block

## Phase 3.3: Repository Layer (TDD - Tests First)

⚠️ **CRITICAL**: Write tests BEFORE implementation. Tests MUST fail initially.

- [ ] **T012** [P] Create TaskTemplateItemAssociationRepository test at `/Users/travisetzler/Documents/GitHub/jobeye/tests/unit/task-template/TaskTemplateItemAssociationRepository.test.ts`
  - Test suite: "TaskTemplateItemAssociationRepository"
  - Tests: `create()`, `findById()`, `findByTemplateItemId()`, `update()`, `delete()`
  - Mock Supabase client responses
  - Test XOR constraint validation (item_id vs kit_id)
  - Test Result type returns (Ok/Err)
  - All tests should FAIL (no implementation yet)

- [ ] **T013** Implement TaskTemplateItemAssociationRepository at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/task-template/repositories/TaskTemplateItemAssociationRepository.ts`
  - Constructor accepts SupabaseClient<Database>
  - Implement `create(input)` → validates, inserts, returns Result
  - Implement `findById(id)` → selects single, handles PGRST116
  - Implement `findByTemplateItemId(templateItemId)` → selects array
  - Implement `update(id, input)` → updates, returns Result
  - Implement `delete(id)` → deletes, returns Result
  - Include agent directive block, complexity_budget: 250
  - Run tests from T012 - all should PASS now

- [ ] **T014** [P] Create WorkflowTaskItemAssociationRepository test at `/Users/travisetzler/Documents/GitHub/jobeye/tests/unit/workflow-task/WorkflowTaskItemAssociationRepository.test.ts`
  - Test suite: "WorkflowTaskItemAssociationRepository"
  - Tests: `create()`, `findById()`, `findByWorkflowTaskId()`, `findByStatus()`, `update()`, `updateStatus()`, `delete()`
  - Test status transitions (pending→loaded, loaded→verified, etc.)
  - Test loaded_at/loaded_by auto-population on status change to 'loaded'
  - Mock Supabase client responses
  - All tests should FAIL (no implementation yet)

- [ ] **T015** Implement WorkflowTaskItemAssociationRepository at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository.ts`
  - Constructor accepts SupabaseClient<Database>
  - Implement `create(input)` → validates, inserts with status='pending', returns Result
  - Implement `findById(id)` → selects single
  - Implement `findByWorkflowTaskId(taskId)` → selects array
  - Implement `findByStatus(taskId, status)` → filtered select
  - Implement `update(id, input)` → updates, returns Result
  - Implement `updateStatus(id, status, userId)` → updates status and loaded_by if status='loaded'
  - Implement `delete(id)` → deletes, returns Result
  - Include agent directive block, complexity_budget: 300
  - Run tests from T014 - all should PASS now

## Phase 3.4: Service Layer (Tests First)

- [ ] **T016** Add TaskTemplateService association tests at `/Users/travisetzler/Documents/GitHub/jobeye/tests/unit/task-template/TaskTemplateService.test.ts`
  - Add test suite: "TaskTemplateService - Item Associations"
  - Test: `addItemAssociation()` calls repository.create
  - Test: `getTemplateItemAssociations()` calls repository.findByTemplateItemId
  - Test: `updateItemAssociation()` calls repository.update
  - Test: `removeItemAssociation()` calls repository.delete
  - Mock TaskTemplateItemAssociationRepository
  - Tests should FAIL (methods don't exist yet)

- [ ] **T017** Add association methods to TaskTemplateService at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/task-template/services/TaskTemplateService.ts`
  - Constructor: Add `private assocRepo: TaskTemplateItemAssociationRepository` parameter
  - Add method: `async addItemAssociation(templateItemId, input, tenantId)` → Result
  - Add method: `async getTemplateItemAssociations(templateItemId)` → Result<array>
  - Add method: `async updateItemAssociation(id, input)` → Result
  - Add method: `async removeItemAssociation(id)` → Result
  - Update constructor calls in factory functions
  - Tests from T016 should PASS now

- [ ] **T018** Add WorkflowTaskService association tests at `/Users/travisetzler/Documents/GitHub/jobeye/tests/unit/workflow-task/WorkflowTaskService.test.ts`
  - Add test suite: "WorkflowTaskService - Item Associations"
  - Test: `addItemAssociation()` calls repository.create
  - Test: `getTaskItemAssociations()` calls repository.findByWorkflowTaskId
  - Test: `updateItemAssociation()` calls repository.update
  - Test: `markItemLoaded()` calls repository.updateStatus
  - Test: `canCompleteTask()` checks for missing required items (status='missing', is_required=true)
  - Mock WorkflowTaskItemAssociationRepository
  - Tests should FAIL initially

- [ ] **T019** Add association methods to WorkflowTaskService at `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/workflow-task/services/WorkflowTaskService.ts`
  - Constructor: Add `private assocRepo: WorkflowTaskItemAssociationRepository` parameter
  - Add method: `async addItemAssociation(workflowTaskId, input, tenantId)` → Result
  - Add method: `async getTaskItemAssociations(workflowTaskId)` → Result<array>
  - Add method: `async updateItemAssociation(id, input)` → Result
  - Add method: `async markItemLoaded(id, userId)` → Result (calls updateStatus with 'loaded')
  - Add method: `async canCompleteTask(workflowTaskId)` → Result<boolean> (checks for missing required items)
  - Update constructor calls in factory functions
  - Tests from T018 should PASS now

- [ ] **T020** Update TaskTemplateService.instantiateTemplate() to copy associations
  - In `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/task-template/services/TaskTemplateService.ts`
  - After creating workflow_tasks, for each task: fetch template item associations
  - For each association: create workflow_task_item_association with source_template_association_id set
  - Copy fields: item_id, kit_id, quantity, is_required, notes
  - Set status='pending', loaded_at=null, loaded_by=null
  - Add test in TaskTemplateService.test.ts to verify associations are copied

## Phase 3.5: API Routes

- [ ] **T021** [P] Create template item associations API routes at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/task-templates/[templateId]/items/[itemId]/associations/route.ts`
  - GET: List associations for template item
  - POST: Create new association
  - Validate templateId and itemId params
  - Use TaskTemplateService methods from T017
  - Include tenant context via getRequestContext
  - Check supervisor role
  - Return proper status codes (200, 201, 400, 401, 403, 404)

- [ ] **T022** [P] Create template item association detail API at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/task-templates/[templateId]/items/[itemId]/associations/[associationId]/route.ts`
  - GET: Get specific association
  - PATCH: Update association
  - DELETE: Delete association
  - Same auth/validation as T021
  - Return proper status codes

- [ ] **T023** [P] Create workflow task item associations API routes at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/jobs/[jobId]/tasks/[taskId]/associations/route.ts`
  - GET: List associations for workflow task (with optional ?status= filter)
  - POST: Create new association
  - Use WorkflowTaskService methods from T019
  - Include tenant context
  - Check worker or supervisor role
  - Return proper status codes

- [ ] **T024** [P] Create workflow task association detail API at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/route.ts`
  - GET: Get specific association
  - PATCH: Update association
  - DELETE: Delete association
  - Same auth as T023

- [ ] **T025** Create /load convenience endpoint at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/load/route.ts`
  - POST: Mark item as loaded (calls WorkflowTaskService.markItemLoaded)
  - Gets userId from context
  - Returns updated association with status='loaded', loaded_at, loaded_by
  - Check worker or supervisor role

## Phase 3.6: Integration Tests

- [ ] **T026** [P] Create template item association CRUD integration test at `/Users/travisetzler/Documents/GitHub/jobeye/tests/integration/task-template-item-associations/crud.int.test.ts`
  - Test suite: "Template Item Associations - CRUD"
  - beforeAll: Create test tenant, template, template_item
  - afterEach: Clean up test associations
  - Test: POST creates association with item_id
  - Test: POST creates association with kit_id
  - Test: POST rejects when both item_id and kit_id provided (XOR)
  - Test: POST rejects when neither item_id nor kit_id provided
  - Test: GET lists associations for template item
  - Test: PATCH updates quantity and is_required
  - Test: DELETE removes association
  - Test: Unique constraint prevents duplicate item_id for same template_item_id

- [ ] **T027** [P] Create workflow task association CRUD integration test at `/Users/travisetzler/Documents/GitHub/jobeye/tests/integration/workflow-task-item-associations/crud.int.test.ts`
  - Test suite: "Workflow Task Item Associations - CRUD"
  - beforeAll: Create test tenant, job, workflow_task
  - Test: POST creates association with status='pending'
  - Test: POST /load marks as loaded and sets loaded_at, loaded_by
  - Test: PATCH can update status
  - Test: GET with ?status= filter works
  - Test: DELETE removes association
  - Test: Status transitions work (pending→loaded→verified)
  - Test: Unique constraint prevents duplicate item_id for same workflow_task_id

- [ ] **T028** [P] Create template instantiation test at `/Users/travisetzler/Documents/GitHub/jobeye/tests/integration/task-template-item-associations/instantiation.int.test.ts`
  - Test suite: "Template Instantiation - Item Associations"
  - Create template with 3 tasks, each with 2 item associations
  - Call TaskTemplateService.instantiateTemplate()
  - Verify 6 workflow_task_item_associations created
  - Verify source_template_association_id is set correctly
  - Verify status='pending' for all
  - Verify loaded_at, loaded_by are null

- [ ] **T029** [P] Create equipment loading workflow test at `/Users/travisetzler/Documents/GitHub/jobeye/tests/integration/workflow-task-item-associations/loading.int.test.ts`
  - Test suite: "Equipment Loading Workflow"
  - Create workflow_task with 2 required items, 1 optional item
  - Mark 1 required item as 'missing'
  - Call WorkflowTaskService.canCompleteTask() → expect false
  - Mark missing item as 'loaded'
  - Call canCompleteTask() → expect true
  - Verify optional item doesn't block completion

- [ ] **T030** [P] Create RLS and tenant isolation test at `/Users/travisetzler/Documents/GitHub/jobeye/tests/integration/task-template-item-associations/rls.int.test.ts`
  - Test suite: "RLS and Tenant Isolation"
  - Create Tenant A user and template with associations
  - Create Tenant B user
  - Attempt to access Tenant A's associations as Tenant B → expect 404/403
  - Query database directly with Tenant B's JWT claims → expect 0 results
  - Verify RLS policies enforce tenant_id correctly

## Phase 3.7: UI Components

- [ ] **T031** Create ItemAssociationCard component at `/Users/travisetzler/Documents/GitHub/jobeye/src/components/task-items/ItemAssociationCard.tsx`
  - Props: association (TaskTemplateItemAssociation or WorkflowTaskItemAssociation), onEdit, onRemove
  - Display: item name, quantity, required/optional badge, notes
  - Actions: Edit button, Remove button
  - Handle both template and workflow contexts
  - Use Lucide React icons (Package, Edit, Trash)
  - Include agent directive block, complexity_budget: 150

- [ ] **T032** Create KitAssociationCard component at `/Users/travisetzler/Documents/GitHub/jobeye/src/components/task-items/KitAssociationCard.tsx`
  - Props: association (with kit reference), onEdit, onRemove, expandable (optional)
  - Display: kit name, quantity, required/optional badge, notes
  - Optional: Expand to show kit contents (items in kit)
  - Actions: Edit button, Remove button
  - Use Lucide React icons (Package2, Edit, Trash, ChevronDown)
  - Include agent directive block, complexity_budget: 150

- [ ] **T033** Create ItemKitBrowserModal component at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/templates/components/ItemKitBrowserModal.tsx`
  - Props: isOpen, onClose, onSelectItem, onSelectKit, mode ('item' | 'kit' | 'both')
  - Tabs: Items tab, Kits tab (if mode='both')
  - Search/filter functionality
  - Fetches from /api/items and /api/kits
  - Displays cards with click to select
  - Modal overlay with close button
  - Include agent directive block, complexity_budget: 250

- [ ] **T034** Create TaskItemAssociationManager component at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/templates/components/TaskItemAssociationManager.tsx`
  - Props: templateItemId, associations (array), onUpdate (callback)
  - Displays list of ItemAssociationCard and KitAssociationCard components
  - "Add Item" and "Add Kit" buttons
  - Opens ItemKitBrowserModal on button click
  - Handles create/update/delete via API calls
  - Updates local state and calls onUpdate callback
  - Include agent directive block, complexity_budget: 300

- [ ] **T035** Update template edit page at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/templates/[id]/edit/page.tsx`
  - Import TaskItemAssociationManager
  - For each task item accordion: add <TaskItemAssociationManager> below task description fields
  - Pass templateItemId from task item
  - Fetch associations when page loads (or lazy load per accordion)
  - Handle association updates (optimistic UI or refetch)
  - Include in form submission: associations don't need separate save (managed via manager)

- [ ] **T036** Create TaskEquipmentList component at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/jobs/[id]/components/TaskEquipmentList.tsx`
  - Props: jobId, workflowTasks (array with associations)
  - Display: Grouped by task, shows items/kits with quantities and status
  - Status indicators: pending (gray), loaded (blue), verified (green), missing (red), returned (gray)
  - Required badge for required items
  - Read-only for supervisor view (no edit actions)
  - Include agent directive block, complexity_budget: 200

- [ ] **T037** Update job detail page at `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/jobs/[id]/page.tsx`
  - Add "Equipment Needed" section with tabs: "Job-Level Items" and "Task-Level Items"
  - Job-Level tab: Existing functionality (items with assigned_to_job_id)
  - Task-Level tab: Render <TaskEquipmentList> component
  - Fetch workflow_tasks with associations via nested Supabase query
  - Performance: Use single query with joins to load all data

## Phase 3.8: Validation and Polish

- [ ] **T038** Execute quickstart.md scenario 1: Add items to template task
  - Follow steps in `/Users/travisetzler/Documents/GitHub/jobeye/specs/015-task-item-association/quickstart.md` Scenario 1
  - Navigate to template edit page
  - Add item to task
  - Edit item association (quantity, required/optional, notes)
  - Add kit to task
  - Remove item
  - Save template
  - Verify persistence (reload page)
  - Check database state matches expected

- [ ] **T039** Execute quickstart.md scenario 2: Instantiate template with items
  - Follow quickstart.md Scenario 2
  - Create job from template with item associations
  - Verify workflow_task_item_associations created
  - Verify source_template_association_id links
  - Check status='pending', loaded_at=null

- [ ] **T040** Execute quickstart.md scenario 3: Load equipment for task
  - Follow quickstart.md Scenario 3
  - Mark items as loaded
  - Attempt to complete task with missing required item (should fail)
  - Load all required items
  - Complete task successfully
  - Verify database state

- [ ] **T041** Execute quickstart.md scenario 4: Supervisor override
  - Follow quickstart.md Scenario 4
  - Add custom item to workflow task (not from template)
  - Remove template item from workflow task
  - Verify template unchanged
  - Check source_template_association_id is null for custom items

- [ ] **T042** Execute quickstart.md scenario 5: Performance validation
  - Follow quickstart.md Scenario 5
  - Create template with 10 tasks, 50 associations
  - Measure save time (target: <2 seconds)
  - Instantiate to job
  - Measure creation time (target: <1 second)
  - Load job equipment view
  - Measure load time (target: <1 second)
  - Check query performance via EXPLAIN ANALYZE

- [ ] **T043** Execute quickstart.md scenario 6: RLS and tenant isolation
  - Follow quickstart.md Scenario 6
  - Test cross-tenant access blocked
  - Verify RLS policies work correctly
  - Check direct database queries respect RLS

- [ ] **T044** Run full test suite and verify coverage
  - Run `npm run test` or equivalent
  - Verify all unit tests pass (T012-T015, T016-T019)
  - Verify all integration tests pass (T026-T030)
  - Check test coverage ≥80% for new files
  - Fix any failing tests before proceeding

- [ ] **T045** Update database types at `/Users/travisetzler/Documents/GitHub/jobeye/src/types/database.ts`
  - If Supabase type generation available: Run `npm run generate:types`
  - Otherwise: Manually add `task_template_item_associations` and `workflow_task_item_associations` table types
  - Add `task_item_status` to Enums section
  - Verify TypeScript compilation passes

- [ ] **T046** Performance optimization review
  - Review all Supabase queries for N+1 issues
  - Verify indexes are used (check query plans)
  - Add `.select('*, items(*), kits(*)')` nested queries where appropriate
  - Ensure lazy loading where needed (accordion expand vs. page load)
  - Profile large dataset scenarios (50+ tasks)

- [ ] **T047** Code cleanup and documentation
  - Remove any console.log statements
  - Add JSDoc comments to all public methods
  - Ensure all agent directive blocks are complete
  - Check complexity budgets not exceeded (max 300 LoC per file)
  - Update CHANGELOG.md with feature summary

## Dependencies

### Blocking Dependencies
- **T001-T007** (Migration) → ALL other tasks (must complete first)
- **T008-T011** (Types/Schemas) → T012-T015 (Repository tests need types)
- **T012-T015** (Repositories) → T016-T020 (Services need repos)
- **T016-T020** (Services) → T021-T025 (API routes need services)
- **T021-T025** (API routes) → T031-T037 (UI needs API)

### Test Dependencies
- **T012** (test) → T013 (implementation)
- **T014** (test) → T015 (implementation)
- **T016** (test) → T017 (implementation)
- **T018** (test) → T019 (implementation)

### UI Dependencies
- **T031-T032** (Cards) → T034 (Manager uses cards)
- **T034** (Manager) → T035 (Edit page uses manager)
- **T036** (Equipment list) → T037 (Job page uses list)

### Validation Dependencies
- **T021-T037** (Implementation) → T038-T043 (Quickstart validation)
- **T026-T030** (Integration tests) → T044 (Test suite)
- **T007** (Migration applied) → T045 (Type generation)

## Parallel Execution Opportunities

### Can Run in Parallel [P]

**Types and Schemas (after T007)**:
```bash
# T008-T011 can all run in parallel (different files)
```

**Repository Tests (after T008-T011)**:
```bash
# T012 and T014 can run in parallel (different files)
```

**API Routes (after T016-T020)**:
```bash
# T021-T024 can run in parallel (different directories)
```

**Integration Tests (after T021-T025)**:
```bash
# T026-T030 can all run in parallel (different test suites, isolated data)
```

**UI Cards (after T021-T025)**:
```bash
# T031 and T032 can run in parallel (different files)
```

**Quickstart Scenarios (after all implementation)**:
```bash
# T038-T043 can run in parallel IF using different test tenants/jobs
```

### Must Run Sequentially

- T001-T007: Migration steps must be sequential
- T013 after T012, T015 after T014 (implementation after tests)
- T017 after T016, T019 after T018 (implementation after tests)
- T034 after T031-T032, T035 after T034 (component dependencies)
- T044 after T026-T030 (test suite after tests written)

## Validation Checklist

Before marking feature complete:

- [ ] All 47 tasks completed
- [ ] Migration applied and verified (T001-T007)
- [ ] All tests passing (T012, T014, T016, T018, T026-T030, T044)
- [ ] Test coverage ≥80% (T044)
- [ ] All quickstart scenarios pass (T038-T043)
- [ ] Performance targets met (T042)
- [ ] RLS policies verified (T043)
- [ ] TypeScript compilation clean (T045)
- [ ] No console errors in browser
- [ ] Documentation updated (T047)

## Notes

- **TDD Approach**: Tests written before implementation (T012→T013, T014→T015, etc.)
- **Constitution Compliance**: All tables have RLS, tenant_id, proper constraints
- **Performance**: Single queries with nested selects, no N+1 queries
- **Type Safety**: Zod validation, TypeScript strict mode, generated database types
- **Tenant Isolation**: RLS policies use `app_metadata` path, all queries scoped to tenant
- **Error Handling**: Result<T, E> pattern throughout, proper error codes
- **Commit Strategy**: Commit after each task or logical group, push immediately (Rule 2)

## Estimated Timeline

- **Phase 3.1** (Migration): 2-3 hours
- **Phase 3.2** (Types): 1 hour
- **Phase 3.3** (Repositories): 4-5 hours
- **Phase 3.4** (Services): 3-4 hours
- **Phase 3.5** (API Routes): 3-4 hours
- **Phase 3.6** (Integration Tests): 4-5 hours
- **Phase 3.7** (UI Components): 6-8 hours
- **Phase 3.8** (Validation): 3-4 hours

**Total**: 26-36 hours (3-4.5 days)

## Success Criteria

✅ Feature is complete when:
1. All 47 tasks checked off
2. Test coverage ≥80%
3. All quickstart scenarios pass
4. Performance targets met (<1s job load, <2s template save)
5. Zero TypeScript errors
6. Zero test failures
7. RLS policies verified secure
8. Code reviewed and approved
9. Documentation updated
10. Committed and pushed to branch

Ready for implementation! 🚀
