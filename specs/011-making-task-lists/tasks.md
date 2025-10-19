# Tasks: Task Lists for Jobs

**Feature**: 011-making-task-lists
**Branch**: `011-making-task-lists`
**Input**: Design documents from `/specs/011-making-task-lists/`

## Overview

This task list implements structured task lists for jobs with voice-first interface, offline capability, and template system. The implementation enhances the existing `workflow_tasks` table rather than creating a new system.

**Key Components**:
- Database enhancements (workflow_tasks + 2 new tables)
- Repository layer (WorkflowTaskRepository, TaskTemplateRepository)
- API routes (5 endpoints)
- Voice command handlers (6 commands)
- Offline sync (Dexie + IndexedDB)
- UI components (3 React components)

**Total Tasks**: 36
**Estimated Duration**: 3-5 days
**Test Coverage Target**: ≥80%

---

## Phase 3.1: Database Setup & Migration

**CRITICAL**: These tasks must be completed first and verified before proceeding to Phase 3.2.

- [ ] **T001** Create migration script `scripts/migrations/enhance-workflow-tasks.ts` to alter workflow_tasks table
  - Add column: `is_required BOOLEAN NOT NULL DEFAULT true`
  - Add column: `is_deleted BOOLEAN NOT NULL DEFAULT false`
  - Add column: `template_id UUID REFERENCES task_templates(id)`
  - Use `ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS` pattern for idempotency
  - Execute via Supabase MCP: `await client.rpc('exec_sql', { sql })`
  - **Dependencies**: None
  - **Validation**: Run `npm run db:check:actual` to verify columns added

- [ ] **T002** Fix workflow_tasks RLS policy in same migration script
  - Drop existing policy: `DROP POLICY IF EXISTS workflow_tasks_tenant_isolation ON workflow_tasks;`
  - Create corrected policy using JWT app_metadata path:
    ```sql
    CREATE POLICY workflow_tasks_tenant_isolation ON workflow_tasks
      FOR ALL USING (
        tenant_id::text = (
          current_setting('request.jwt.claims', true)::json
          -> 'app_metadata' ->> 'tenant_id'
        )
      );
    ```
  - **Dependencies**: T001
  - **Validation**: Query workflow_tasks with test tenant JWT, verify RLS enforces isolation

- [ ] **T003** Create task_templates table in migration script
  - CREATE TABLE IF NOT EXISTS with columns: id, tenant_id, name, description, job_type, is_active, created_by, created_at, updated_at
  - Add UNIQUE constraint: `(tenant_id, name)`
  - Create indexes: `idx_task_templates_tenant_active`, `idx_task_templates_job_type`
  - Enable RLS and create tenant isolation policy using JWT app_metadata path
  - **Dependencies**: T002
  - **Validation**: `SELECT * FROM task_templates LIMIT 1` should succeed

- [ ] **T004** Create task_template_items table in migration script
  - CREATE TABLE IF NOT EXISTS with columns: id, template_id, task_order, task_description, is_required, requires_photo_verification, requires_supervisor_approval, acceptance_criteria, created_at
  - Add FK: `template_id REFERENCES task_templates(id) ON DELETE CASCADE`
  - Add UNIQUE constraint: `(template_id, task_order)`
  - Create index: `idx_task_template_items_template_order`
  - Enable RLS with EXISTS subquery checking template tenant isolation
  - **Dependencies**: T003
  - **Validation**: Insert test template_item, verify cascade delete works

- [ ] **T005** Create performance indexes in migration script
  - `CREATE INDEX IF NOT EXISTS idx_workflow_tasks_job_order ON workflow_tasks(job_id, task_order);`
  - `CREATE INDEX IF NOT EXISTS idx_workflow_tasks_required ON workflow_tasks(job_id, is_required) WHERE is_deleted = false;`
  - `CREATE INDEX IF NOT EXISTS idx_workflow_tasks_template ON workflow_tasks(template_id) WHERE template_id IS NOT NULL;`
  - **Dependencies**: T002
  - **Validation**: Run EXPLAIN ANALYZE on task list query, verify index usage

- [ ] **T006** Execute migration and regenerate types
  - Run: `tsx scripts/migrations/enhance-workflow-tasks.ts`
  - Run: `npm run generate:types` to update `src/types/supabase.ts`
  - Run: `npm run test:rls` to verify RLS policies
  - Verify: workflow_tasks has 24 columns (was 21)
  - Verify: task_templates and task_template_items tables exist
  - **Dependencies**: T001-T005
  - **Validation**: `npm run db:check:actual` shows correct schema

---

## Phase 3.2: Zod Schemas & Type Definitions

**NOTE**: Can start after T006 completes and types are regenerated.

- [ ] **T007** [P] Create Zod schemas in `src/domains/workflow-task/schemas.ts`
  - Export `TaskStatusSchema` enum: pending, in-progress, complete, skipped, failed
  - Export `CreateTaskSchema` with validation: job_id (uuid), task_description (1-500 chars), task_order (>=0), is_required (boolean), requires_photo_verification, requires_supervisor_approval, acceptance_criteria (optional, max 1000 chars)
  - Export `UpdateTaskSchema` (partial of CreateTask + status, completed_at, verification fields)
  - Export inferred types: `CreateTaskInput`, `UpdateTaskInput`
  - **Dependencies**: T006 (types generated)
  - **Validation**: Import in test file, verify `.safeParse()` works correctly

- [ ] **T008** [P] Create Zod schemas in `src/domains/task-template/schemas.ts`
  - Export `CreateTemplateSchema`: name (1-255 chars), description (optional, max 1000), job_type (optional, max 100)
  - Export `CreateTemplateItemSchema`: template_id (uuid), task_order (>=0), task_description (1-500 chars), is_required (boolean), requires_photo_verification, requires_supervisor_approval, acceptance_criteria (optional, max 1000)
  - Export inferred types: `CreateTemplateInput`, `CreateTemplateItemInput`
  - **Dependencies**: T006 (types generated)
  - **Validation**: Import in test file, verify validation rules work

---

## Phase 3.3: Repository Layer

**NOTE**: Repositories can be built in parallel after schemas exist.

- [ ] **T009** [P] Enhance WorkflowTaskRepository in `src/domains/workflow-task/WorkflowTaskRepository.ts`
  - Add method: `async findIncompleteRequired(jobId: string): Promise<Result<WorkflowTask[], RepositoryError>>`
    - Query: `WHERE job_id = ? AND is_deleted = false AND is_required = true AND status NOT IN ('complete', 'skipped')`
  - Add method: `async softDelete(id: string): Promise<Result<void, RepositoryError>>`
    - Update: `SET is_deleted = true, updated_at = NOW() WHERE id = ?`
  - Add method: `async createFromTemplate(jobId: string, templateItems: TaskTemplateItem[]): Promise<Result<WorkflowTask[], RepositoryError>>`
    - Map template items to workflow_tasks, insert batch with job_id, status='pending'
  - **Dependencies**: T007 (schemas)
  - **Validation**: Unit test each method with mocked Supabase client

- [ ] **T010** [P] Create TaskTemplateRepository in `src/domains/task-template/TaskTemplateRepository.ts`
  - Add file header with @file, @phase 1, @domain task-template, @purpose, @complexity_budget 300, @test_coverage ≥80%
  - Implement: `constructor(private client: SupabaseClient<Database>) {}`
  - Add method: `async findAll(includeInactive = false): Promise<Result<TaskTemplate[], RepositoryError>>`
  - Add method: `async findByIdWithItems(id: string): Promise<Result<TemplateWithItems, RepositoryError>>`
    - Join template + items, return combined object
  - Add method: `async create(template: CreateTemplateInput, items: CreateTemplateItemInput[]): Promise<Result<TemplateWithItems, RepositoryError>>`
    - Insert template, then insert items with template_id
  - Add method: `async update(id: string, data: Partial<CreateTemplateInput>): Promise<Result<TaskTemplate, RepositoryError>>`
  - Add method: `async delete(id: string): Promise<Result<void, RepositoryError>>`
  - **Dependencies**: T008 (schemas)
  - **Validation**: Unit test each method

- [ ] **T011** [P] Write unit tests in `tests/unit/workflow-task/WorkflowTaskRepository.test.ts`
  - Test `findIncompleteRequired` returns only required, incomplete tasks
  - Test `softDelete` sets is_deleted=true, not hard delete
  - Test `createFromTemplate` maps template items correctly
  - Mock Supabase client responses
  - Target: ≥80% coverage
  - **Dependencies**: T009
  - **Validation**: `npm run test:unit -- WorkflowTaskRepository`

- [ ] **T012** [P] Write unit tests in `tests/unit/task-template/TaskTemplateRepository.test.ts`
  - Test `findAll` filters by is_active correctly
  - Test `findByIdWithItems` joins template + items
  - Test `create` inserts template and items transactionally
  - Test `delete` cascades to items
  - Mock Supabase client responses
  - Target: ≥80% coverage
  - **Dependencies**: T010
  - **Validation**: `npm run test:unit -- TaskTemplateRepository`

---

## Phase 3.4: Service Layer

**NOTE**: Services can be built after repositories exist.

- [ ] **T013** Create WorkflowTaskService in `src/domains/workflow-task/WorkflowTaskService.ts`
  - Add file header with @file, @phase 1, @domain workflow-task, @purpose, @complexity_budget 300, @test_coverage ≥80%
  - Implement: `constructor(private repo: WorkflowTaskRepository) {}`
  - Add method: `async validateJobCompletion(jobId: string): Promise<Result<boolean, ServiceError>>`
    - Call `repo.findIncompleteRequired(jobId)`
    - Return Err if any incomplete required tasks, Ok(true) otherwise
  - Add method: `async completeTask(taskId: string, userId: string, verificationData?: VerificationInput): Promise<Result<WorkflowTask, ServiceError>>`
    - Validate photo verification if requires_photo_verification=true
    - Update task: status='complete', completed_by=userId, completed_at=NOW()
  - **Dependencies**: T009 (repository)
  - **Validation**: Unit test business logic

- [ ] **T014** Create TaskTemplateService in `src/domains/task-template/TaskTemplateService.ts`
  - Add file header with @file, @phase 1, @domain task-template, @purpose, @complexity_budget 300, @test_coverage ≥80%
  - Implement: `constructor(private templateRepo: TaskTemplateRepository, private taskRepo: WorkflowTaskRepository) {}`
  - Add method: `async instantiateTemplate(templateId: string, jobId: string): Promise<Result<WorkflowTask[], ServiceError>>`
    - Load template items from templateRepo
    - Call taskRepo.createFromTemplate(jobId, items)
    - Return created tasks
  - **Dependencies**: T009, T010 (repositories)
  - **Validation**: Unit test template instantiation logic

- [ ] **T015** [P] Write unit tests in `tests/unit/workflow-task/WorkflowTaskService.test.ts`
  - Test `validateJobCompletion` blocks when required tasks incomplete
  - Test `validateJobCompletion` allows when only optional tasks incomplete
  - Test `completeTask` enforces photo verification requirement
  - Mock repository responses
  - Target: ≥80% coverage
  - **Dependencies**: T013
  - **Validation**: `npm run test:unit -- WorkflowTaskService`

- [ ] **T016** [P] Write unit tests in `tests/unit/task-template/TaskTemplateService.test.ts`
  - Test `instantiateTemplate` creates tasks with correct job_id
  - Test template items copied with proper field mapping
  - Mock repository responses
  - Target: ≥80% coverage
  - **Dependencies**: T014
  - **Validation**: `npm run test:unit -- TaskTemplateService`

---

## Phase 3.5: API Routes

**NOTE**: API routes can be built in parallel after services exist.

- [ ] **T017** [P] Implement GET/POST endpoints in `src/app/api/jobs/[id]/tasks/route.ts`
  - Add file header with @file, @phase 1, @domain api, @purpose, @complexity_budget 300, @test_coverage ≥80%
  - GET handler:
    - Create Supabase client: `createRouteHandlerClient({ cookies })`
    - Instantiate WorkflowTaskRepository with client
    - Call `repo.findByJobId(params.id)` where `is_deleted = false`
    - Return JSON: `{ success: true, data: tasks }` or `{ success: false, error }`
  - POST handler:
    - Parse body, validate with `CreateTaskSchema.safeParse()`
    - Return 400 if validation fails
    - Call `repo.create(validatedData)`
    - Return 201 with created task
  - **Dependencies**: T009, T013 (repository, service)
  - **Validation**: API contract test

- [ ] **T018** [P] Implement PATCH/DELETE endpoints in `src/app/api/jobs/[id]/tasks/[taskId]/route.ts`
  - Add file header
  - PATCH handler:
    - Validate with `UpdateTaskSchema.safeParse()`
    - Call `repo.update(params.taskId, validatedData)`
    - Check photo verification requirement if status='complete'
    - Return 200 or 409 if verification required
  - DELETE handler:
    - Call `repo.softDelete(params.taskId)` (always soft delete after job starts)
    - Return 200 with message
  - **Dependencies**: T009, T013
  - **Validation**: API contract test

- [ ] **T019** [P] Implement GET/POST endpoints in `src/app/api/task-templates/route.ts`
  - Add file header
  - GET handler:
    - Parse query param `includeInactive` (default false)
    - Call `templateRepo.findAll(includeInactive)`
    - Return JSON with templates list
  - POST handler:
    - Validate with `CreateTemplateSchema` and array of `CreateTemplateItemSchema`
    - Call `templateRepo.create(template, items)`
    - Return 201 with created template
    - Handle 409 if name already exists for tenant
  - **Dependencies**: T010, T014
  - **Validation**: API contract test

- [ ] **T020** [P] Implement template detail/instantiate in `src/app/api/task-templates/[id]/route.ts`
  - Add file header
  - GET handler:
    - Call `templateRepo.findByIdWithItems(params.id)`
    - Return template with items array
  - PATCH handler:
    - Validate partial update
    - Call `templateRepo.update(params.id, data)`
    - Return 200 with updated template
  - DELETE handler:
    - Check if template in use (query workflow_tasks WHERE template_id = ?)
    - If in use, return 409 with recommendation to deactivate
    - Otherwise call `templateRepo.delete(params.id)`
  - POST `/api/task-templates/[id]/instantiate` handler:
    - Parse body: `{ jobId: string }`
    - Call `templateService.instantiateTemplate(params.id, jobId)`
    - Return 201 with created tasks
  - **Dependencies**: T010, T014
  - **Validation**: API contract test

- [ ] **T021** [P] Write API contract tests in `tests/api/tasks.api.test.ts`
  - Test POST /api/jobs/:id/tasks with valid data returns 201
  - Test POST with invalid data returns 400 with validation errors
  - Test GET /api/jobs/:id/tasks returns task list
  - Test PATCH /api/jobs/:id/tasks/:taskId updates task
  - Test DELETE soft-deletes task
  - Test photo verification enforcement (409 if missing)
  - Use real HTTP requests to localhost:3000
  - **Dependencies**: T017, T018
  - **Validation**: All tests pass

- [ ] **T022** [P] Write API contract tests in `tests/api/task-templates.api.test.ts`
  - Test POST /api/task-templates creates template with items
  - Test GET /api/task-templates returns list
  - Test GET /api/task-templates/:id returns template with items
  - Test POST /api/task-templates/:id/instantiate creates tasks
  - Test DELETE checks for template in use (409)
  - Use real HTTP requests
  - **Dependencies**: T019, T020
  - **Validation**: All tests pass

---

## Phase 3.6: Voice Interface

**NOTE**: Voice commands depend on repository layer existing.

- [ ] **T023** Create voice command handlers in `src/lib/voice/taskCommands.ts`
  - Add file header with @file, @phase 1, @domain voice, @purpose, @complexity_budget 300, @test_coverage ≥80%
  - Export `taskVoiceCommands: VoiceCommand[]` array with 6 handlers:
    1. Pattern: `/show (job |)tasks/i`, Intent: 'list_tasks'
       - Handler: Load tasks, generate speech "You have X tasks. Task 1: ..."
    2. Pattern: `/mark task (\d+) complete/i`, Intent: 'complete_task'
       - Handler: Parse task number, update status='complete', confirm audibly
    3. Pattern: `/next task/i`, Intent: 'navigate_next'
       - Handler: Return next pending task in sequence
    4. Pattern: `/previous task/i`, Intent: 'navigate_prev'
       - Handler: Return previous task in sequence
    5. Pattern: `/what'?s task (\d+)/i`, Intent: 'query_task'
       - Handler: Read task description + acceptance criteria
    6. Pattern: `/add task:? (.+)/i`, Intent: 'add_task'
       - Handler: Create new task with captured description
  - Each handler returns `{ text: string, audio: AudioBuffer }`
  - Target response time: <2 seconds
  - **Dependencies**: T009 (repository)
  - **Validation**: E2E voice tests

- [ ] **T024** Register voice commands in `src/lib/voice/commandParser.ts`
  - Import `taskVoiceCommands` from taskCommands.ts
  - Add to global command registry: `commandParser.registerCommands(taskVoiceCommands)`
  - Ensure commands loaded on app init
  - **Dependencies**: T023
  - **Validation**: `window.voiceCommandParser.listCommands()` shows task commands

- [ ] **T025** Write E2E voice tests in `tests/e2e/task-voice-commands.spec.ts`
  - Test "show job tasks" lists tasks audibly
  - Test "mark task 1 complete" completes task
  - Test "next task" navigates
  - Test "add task: check oil" creates task
  - Use Playwright to simulate voice commands
  - Verify audio response generated within 2 seconds
  - **Dependencies**: T023, T024
  - **Validation**: `npm run test:e2e -- task-voice`

---

## Phase 3.7: Offline Sync

**NOTE**: Offline sync can be built in parallel with voice interface.

- [ ] **T026** Create Dexie database schema in `src/lib/offline/taskDatabase.ts`
  - Add file header with @file, @phase 1, @domain offline, @purpose, @complexity_budget 300, @test_coverage ≥80%
  - Define `class TaskDatabase extends Dexie`:
    - Table: `tasks` with indexes: 'id, jobId, taskOrder, status, syncStatus'
    - Table: `pendingOperations` with indexes: '++id, timestamp, type, taskId'
  - Define TypeScript interfaces: `OfflineTask`, `PendingOperation`
  - Export singleton instance: `export const taskDb = new TaskDatabase()`
  - **Dependencies**: None (Dexie already in dependencies)
  - **Validation**: Import in test, verify tables created

- [ ] **T027** Implement offline sync service in `src/lib/offline/taskSync.ts`
  - Add file header
  - Export `class TaskSyncService`:
    - Method: `async queueOperation(type, taskId, data)` - Add to pendingOperations
    - Method: `async syncPendingOperations()` - Process queue when online
      - Load pendingOperations ordered by timestamp
      - For each: make API request to sync
      - Clear from queue on success
      - Update syncStatus to 'synced'
    - Method: `async startBackgroundSync()` - Register service worker sync event
  - Register background sync listener:
    ```typescript
    self.addEventListener('sync', async (event) => {
      if (event.tag === 'sync-tasks') {
        event.waitUntil(taskSyncService.syncPendingOperations());
      }
    });
    ```
  - Target: sync completes within 10 seconds after reconnection
  - **Dependencies**: T026 (database)
  - **Validation**: Integration test with offline→online transition

- [ ] **T028** Write offline sync integration tests in `tests/integration/offline/taskSync.int.test.ts`
  - Test queueOperation adds to pendingOperations table
  - Test syncPendingOperations processes queue in order
  - Test sync retries on failure
  - Test conflict resolution (server wins)
  - Simulate offline→online transition
  - Verify sync completes within 10 seconds
  - **Dependencies**: T027
  - **Validation**: `npm run test:integration -- taskSync`

---

## Phase 3.8: UI Components

**NOTE**: Components can be built in parallel after API routes exist.

- [ ] **T029** [P] Create TaskList component in `src/components/tasks/TaskList.tsx`
  - Add file header with @file, @phase 1, @domain components, @purpose, @complexity_budget 300, @test_coverage ≥80%
  - Props: `{ jobId: string, editable: boolean }`
  - Fetch tasks via `fetch(/api/jobs/${jobId}/tasks)`
  - Display tasks ordered by task_order
  - Show task status badge (pending, in-progress, complete, skipped)
  - Highlight required vs optional tasks
  - Support offline mode (load from IndexedDB if fetch fails)
  - **Dependencies**: T017 (API route)
  - **Validation**: Render in Storybook or test page

- [ ] **T030** [P] Create TaskItem component in `src/components/tasks/TaskItem.tsx`
  - Add file header
  - Props: `{ task: WorkflowTask, onComplete: (id) => void, onDelete: (id) => void }`
  - Display: task_description, status, task_order, is_required badge
  - Actions: Complete button, Delete button (soft delete)
  - Show verification photo if present
  - Show supervisor approval status if requires_supervisor_approval
  - **Dependencies**: T017
  - **Validation**: Render in TaskList

- [ ] **T031** [P] Create TaskTemplateSelector component in `src/components/tasks/TaskTemplateSelector.tsx`
  - Add file header
  - Props: `{ onSelect: (templateId) => void }`
  - Fetch templates via `fetch(/api/task-templates)`
  - Display dropdown or list of available templates
  - Filter by job_type if provided
  - On select, call onSelect callback
  - Parent component calls POST /api/task-templates/:id/instantiate
  - **Dependencies**: T019 (API route)
  - **Validation**: Render in job creation form

---

## Phase 3.9: Integration & Validation

**CRITICAL**: These tasks verify the entire system works together.

- [ ] **T032** Write RLS isolation integration tests in `tests/integration/rls/task-rls.int.test.ts`
  - Create test tenant A and tenant B
  - Create tasks for job in tenant A
  - Attempt to access tasks from tenant B user
  - Verify RLS blocks cross-tenant access (empty result or error)
  - Test workflow_tasks RLS policy
  - Test task_templates RLS policy
  - Test task_template_items RLS policy (via template)
  - **Dependencies**: T006 (migration complete)
  - **Validation**: `npm run test:rls`

- [ ] **T033** Write E2E workflow tests in `tests/e2e/task-workflow.spec.ts`
  - Test complete workflow:
    1. Supervisor creates job
    2. Supervisor selects task template
    3. Template instantiated (tasks created)
    4. Technician views task list
    5. Technician completes tasks (voice command)
    6. Technician uploads verification photo
    7. Supervisor approves task
    8. System validates job completion (required tasks complete)
    9. Job marked complete
  - Use Playwright to automate browser interactions
  - Verify each step succeeds
  - **Dependencies**: T017-T025 (APIs, voice, UI)
  - **Validation**: `npm run test:e2e -- task-workflow`

- [ ] **T034** Run performance validation tests
  - Measure task list query time: Target <200ms
    - Create job with 50 tasks
    - Query `GET /api/jobs/:id/tasks`
    - Assert response time < 200ms
  - Measure job completion validation: Target <300ms
    - Query incomplete required tasks
    - Assert query time < 300ms
  - Measure voice response time: Target <2 seconds
    - Execute "show job tasks" command
    - Assert total time (query + TTS) < 2000ms
  - Measure VLM verification: Target <5 seconds (mock VLM)
    - Upload verification photo
    - Call VLM verification (mock)
    - Assert total time < 5000ms
  - **Dependencies**: T017-T025
  - **Validation**: All performance targets met

- [ ] **T035** Update agent context file
  - Run: `.specify/scripts/bash/update-agent-context.sh claude`
  - Verify CLAUDE.md updated with:
    - New domains: workflow-task, task-template
    - New API routes: /api/jobs/:id/tasks, /api/task-templates
    - Voice command patterns
    - Recent changes summary
  - **Dependencies**: T001-T034 (all implementation complete)
  - **Validation**: Git diff shows CLAUDE.md changes

- [ ] **T036** Run pre-commit checks and verify coverage
  - Run: `npm run pre-commit`
    - TypeScript compile: `tsc --noEmit`
    - ESLint: `eslint src/ --ext .ts,.tsx`
    - Tests: `npm run test:coverage`
    - Directive validation: Check @file headers present
    - Complexity check: No files >300 lines (or justified if >300)
  - Verify ≥80% test coverage:
    - workflow-task domain: ≥80%
    - task-template domain: ≥80%
    - API routes: ≥80%
    - Voice handlers: ≥80%
  - Fix any failures before marking task complete
  - **Dependencies**: T001-T035
  - **Validation**: All pre-commit checks pass, coverage ≥80%

---

## Dependencies Graph

```
T001 (workflow_tasks columns)
  ↓
T002 (fix RLS)
  ↓
T003 (task_templates table)
  ↓
T004 (task_template_items table)
  ↓
T005 (indexes)
  ↓
T006 (execute migration + generate types)
  ↓
T007 [P] (task schemas) ──────┐
T008 [P] (template schemas) ──┤
  ↓                           ↓
T009 [P] (WorkflowTaskRepo) ──┤
T010 [P] (TaskTemplateRepo) ──┤
  ↓                           ↓
T011 [P] (task repo tests) ───┤
T012 [P] (template repo tests) ┤
  ↓                           ↓
T013 (WorkflowTaskService) ───┤
T014 (TaskTemplateService) ───┤
  ↓                           ↓
T015 [P] (service tests) ─────┤
T016 [P] (service tests) ─────┤
  ↓                           ↓
T017 [P] (task API routes) ───┤
T018 [P] (task detail API) ───┤
T019 [P] (template API) ──────┤
T020 [P] (template detail) ───┤
  ↓                           ↓
T021 [P] (task API tests) ────┤
T022 [P] (template API tests) ┤
  ↓                           ↓
T023 (voice commands) ────────┤
T024 (register commands) ─────┤
T025 (voice E2E tests) ───────┤
  ↓                           ↓
T026 [P] (Dexie schema) ──────┤
T027 [P] (sync service) ──────┤
T028 [P] (sync tests) ────────┤
  ↓                           ↓
T029 [P] (TaskList UI) ───────┤
T030 [P] (TaskItem UI) ───────┤
T031 [P] (TemplateSelector) ──┤
  ↓                           ↓
T032 (RLS tests) ─────────────┤
T033 (E2E workflow) ──────────┤
T034 (performance tests) ─────┤
  ↓                           ↓
T035 (update CLAUDE.md)
  ↓
T036 (pre-commit + coverage)
```

---

## Parallel Execution Examples

### After T006 (migration complete):
```bash
# Run these in parallel (different files, no dependencies):
Task T007: Create workflow-task schemas
Task T008: Create task-template schemas
```

### After T008 (schemas complete):
```bash
# Run these in parallel:
Task T009: Enhance WorkflowTaskRepository
Task T010: Create TaskTemplateRepository
```

### After T010 (repositories complete):
```bash
# Run these in parallel:
Task T011: Test WorkflowTaskRepository
Task T012: Test TaskTemplateRepository
```

### After T016 (services complete):
```bash
# Run these in parallel:
Task T017: Implement task API GET/POST
Task T018: Implement task API PATCH/DELETE
Task T019: Implement template API GET/POST
Task T020: Implement template detail API
```

### After T020 (APIs complete):
```bash
# Run these in parallel:
Task T021: Test task API
Task T022: Test template API
Task T026: Create Dexie schema
Task T029: Create TaskList component
Task T030: Create TaskItem component
Task T031: Create TaskTemplateSelector
```

---

## Validation Checklist

Before marking feature complete, verify:

### Database ✓
- [ ] workflow_tasks has 24 columns (is_required, is_deleted, template_id added)
- [ ] task_templates table exists with 9 columns
- [ ] task_template_items table exists with 9 columns
- [ ] All RLS policies use correct JWT app_metadata path
- [ ] Indexes created (job_order, required, template)

### Repository ✓
- [ ] WorkflowTaskRepository has findIncompleteRequired, softDelete, createFromTemplate
- [ ] TaskTemplateRepository has findAll, findByIdWithItems, create, update, delete
- [ ] All methods return Result<T, RepositoryError>

### API ✓
- [ ] GET /api/jobs/:id/tasks returns task list
- [ ] POST /api/jobs/:id/tasks creates task with validation
- [ ] PATCH /api/jobs/:id/tasks/:taskId updates task
- [ ] DELETE /api/jobs/:id/tasks/:taskId soft-deletes
- [ ] GET /api/task-templates lists templates
- [ ] POST /api/task-templates creates template with items
- [ ] POST /api/task-templates/:id/instantiate creates tasks

### Voice ✓
- [ ] "Show job tasks" lists tasks (<2s)
- [ ] "Mark task N complete" completes task
- [ ] "Next task" / "Previous task" navigates
- [ ] "Add task: [desc]" creates task
- [ ] All commands registered in parser

### Offline ✓
- [ ] Dexie database schema created
- [ ] Pending operations queue works
- [ ] Sync completes within 10 seconds after reconnection

### UI ✓
- [ ] TaskList displays tasks ordered by task_order
- [ ] TaskItem shows status, actions
- [ ] TaskTemplateSelector loads templates

### Testing ✓
- [ ] ≥80% code coverage achieved
- [ ] RLS isolation tests pass
- [ ] API contract tests pass
- [ ] E2E workflow test passes
- [ ] E2E voice tests pass

### Performance ✓
- [ ] Task list query < 200ms
- [ ] Job completion validation < 300ms
- [ ] Voice response < 2 seconds
- [ ] VLM verification < 5 seconds

### Polish ✓
- [ ] All files have @file directive headers
- [ ] No files exceed 300 lines (or justified)
- [ ] CLAUDE.md updated with new patterns
- [ ] Pre-commit checks pass

---

## Notes

- **[P] notation**: Tasks marked [P] operate on different files and can run in parallel
- **TDD approach**: Write tests before implementation (T011-T012, T015-T016, T021-T022 before corresponding implementation)
- **Commit frequency**: Commit after each task completes
- **RLS critical**: T002 fixes critical security issue, must verify thoroughly
- **Performance**: T034 validates constitutional performance requirements
- **Coverage**: T036 enforces ≥80% coverage requirement

---

**Tasks Generated**: 2025-10-18
**Ready for Execution**: Yes
**Estimated Duration**: 3-5 days with 2 developers (parallelizing [P] tasks)