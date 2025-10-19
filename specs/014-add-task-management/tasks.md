# Tasks: Task Management for Reusable Task Library

**Feature**: 014-add-task-management
**Input**: Design documents from `/specs/014-add-task-management/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow
```
1. Load plan.md → Tech stack: TypeScript 5.4, Next.js 14.2, Supabase
2. Load data-model.md → Entity: TaskDefinition (12 fields, 3 indexes, RLS)
3. Load contracts/ → 6 API endpoints (task-definitions-api.json)
4. Load quickstart.md → 8 test scenarios
5. Generate tasks by category:
   → Setup: DB migration, types, structure
   → Tests: 6 contract tests, integration tests, unit tests
   → Core: schemas, repository, service, API routes
   → Integration: UI components, dashboard, templates
   → Polish: E2E tests, performance, validation
6. Apply TDD ordering: Tests before implementation
7. Mark [P] for parallel tasks (different files)
8. Validate: All contracts tested, all entities modeled
```

## Format: `[ID] Description [P?]`
- **[P]**: Can run in parallel (different files, no dependencies)
- All paths relative to repository root

## Phase 3.1: Setup & Database

**Foundation**: Database schema and type generation

- [ ] **T001** Create database migration file `supabase/migrations/YYYYMMDDHHMMSS_create_task_definitions.sql`
  - Table: task_definitions (12 fields per data-model.md)
  - Indexes: tenant, tenant_name, created_by
  - RLS policy: tenant_isolation_task_definitions
  - Trigger: update_updated_at_column
  - Dependencies: Verify tenants table exists, auth.users exists, update_updated_at_column() function exists

- [ ] **T002** Execute database migration via Supabase MCP
  - Query live database to verify current schema
  - Apply migration to create task_definitions table
  - Verify table created successfully
  - Verify RLS policy active
  - Verify indexes created

- [ ] **T003** Generate TypeScript types from Supabase schema
  - Run: `npm run generate:types`
  - Verify task_definitions types in `src/types/database.ts`
  - Commit generated types
  - Dependencies: T002 complete

- [ ] **T004** [P] Create domain directory structure
  - Create `src/domains/task-definition/repositories/`
  - Create `src/domains/task-definition/services/`
  - Create `src/domains/task-definition/types/`
  - Create `src/domains/task-definition/schemas/`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)

- [ ] **T005** [P] Contract test: GET /api/task-definitions (list) in `tests/api/task-definitions/list.contract.test.ts`
  - Test 200 response with tenant-scoped data array
  - Test include_deleted query parameter
  - Test 401 unauthorized
  - Expected: FAIL (endpoint doesn't exist yet)

- [ ] **T006** [P] Contract test: POST /api/task-definitions (create) in `tests/api/task-definitions/create.contract.test.ts`
  - Test 201 created with valid input
  - Test 400 validation errors (empty name, description too long)
  - Test 401 unauthorized
  - Test 403 forbidden (non-supervisor)
  - Expected: FAIL (endpoint doesn't exist yet)

- [ ] **T007** [P] Contract test: GET /api/task-definitions/:id (detail) in `tests/api/task-definitions/detail.contract.test.ts`
  - Test 200 response with task definition data
  - Test 404 not found
  - Test 401 unauthorized
  - Expected: FAIL (endpoint doesn't exist yet)

- [ ] **T008** [P] Contract test: PATCH /api/task-definitions/:id (update) in `tests/api/task-definitions/update.contract.test.ts`
  - Test 200 updated with partial input
  - Test 400 validation errors
  - Test 404 not found
  - Test 401 unauthorized
  - Test 403 forbidden
  - Expected: FAIL (endpoint doesn't exist yet)

- [ ] **T009** [P] Contract test: DELETE /api/task-definitions/:id (soft delete) in `tests/api/task-definitions/delete.contract.test.ts`
  - Test 200 deleted (unused definition)
  - Test 409 conflict (in-use definition with template details)
  - Test 404 not found
  - Test 401 unauthorized
  - Test 403 forbidden
  - Expected: FAIL (endpoint doesn't exist yet)

- [ ] **T010** [P] Contract test: GET /api/task-definitions/:id/usage (check usage) in `tests/api/task-definitions/usage.contract.test.ts`
  - Test 200 response with templateCount, templateIds, templateNames
  - Test 404 not found
  - Test 401 unauthorized
  - Expected: FAIL (endpoint doesn't exist yet)

### Unit Tests (Domain Layer)

- [ ] **T011** [P] Unit test: Zod schemas in `tests/unit/task-definition/schemas.test.ts`
  - Test CreateTaskDefinitionSchema validation
  - Test UpdateTaskDefinitionSchema validation
  - Test name: required, 1-255 chars, trim
  - Test description: required, 1-2000 chars
  - Test acceptance_criteria: optional, max 2000 chars
  - Test boolean defaults
  - Expected: FAIL (schemas don't exist yet)

- [ ] **T012** [P] Unit test: TaskDefinitionRepository in `tests/unit/task-definition/repository.test.ts`
  - Test findAll() - tenant scoped
  - Test findById() - returns Result<TaskDefinition, RepositoryError>
  - Test create() - validates input, returns created entity
  - Test update() - partial updates, updates updated_at
  - Test delete() - soft delete with usage check
  - Test checkUsage() - returns template count and names
  - Expected: FAIL (repository doesn't exist yet)

- [ ] **T013** [P] Unit test: TaskDefinitionService in `tests/unit/task-definition/service.test.ts`
  - Test createTaskDefinition() - business validation
  - Test updateTaskDefinition() - prevents editing deleted
  - Test deleteTaskDefinition() - enforces usage guard
  - Test getTaskDefinitionUsage() - returns usage stats
  - Expected: FAIL (service doesn't exist yet)

### Integration Tests (Cross-Layer)

- [ ] **T014** [P] Integration test: Tenant isolation in `tests/integration/task-definitions/tenant-isolation.int.test.ts`
  - Scenario: Tenant A creates definition
  - Scenario: Tenant B queries - gets empty list
  - Scenario: Tenant B tries to access Tenant A's definition by ID - gets 404
  - Verify RLS policy enforcement
  - Expected: FAIL (no implementation yet)

- [ ] **T015** [P] Integration test: CRUD operations in `tests/integration/task-definitions/crud.int.test.ts`
  - Create task definition
  - List definitions (verify appears)
  - Update definition (verify updated_at changes)
  - Delete unused definition (verify soft delete)
  - Attempt delete in-use definition (verify blocked)
  - Expected: FAIL (no implementation yet)

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Domain Layer

- [ ] **T016** [P] Create TypeScript types in `src/domains/task-definition/types/task-definition-types.ts`
  - TaskDefinition interface
  - CreateTaskDefinitionInput interface
  - UpdateTaskDefinitionInput interface
  - TaskDefinitionUsage interface
  - TaskDefinitionWithUsage type
  - Dependencies: T003 (generated types)

- [ ] **T017** [P] Create Zod schemas in `src/domains/task-definition/schemas/task-definition-schemas.ts`
  - CreateTaskDefinitionSchema with validation rules from data-model.md
  - UpdateTaskDefinitionSchema (partial of CreateTaskDefinitionSchema)
  - Export inferred types
  - Dependencies: T011 (test must be failing)

- [ ] **T018** Create TaskDefinitionRepository in `src/domains/task-definition/repositories/TaskDefinitionRepository.ts`
  - constructor(client: SupabaseClient<Database>)
  - async findAll(includeDeleted?: boolean): Promise<Result<TaskDefinition[], RepositoryError>>
  - async findById(id: string): Promise<Result<TaskDefinition, RepositoryError>>
  - async create(data: CreateTaskDefinitionInput): Promise<Result<TaskDefinition, RepositoryError>>
  - async update(id: string, data: UpdateTaskDefinitionInput): Promise<Result<TaskDefinition, RepositoryError>>
  - async delete(id: string): Promise<Result<void, RepositoryError>>
  - async checkUsage(id: string): Promise<Result<TaskDefinitionUsage, RepositoryError>>
  - Dependencies: T012 (test must be failing), T016 (types), T017 (schemas)

- [ ] **T019** Create TaskDefinitionService in `src/domains/task-definition/services/TaskDefinitionService.ts`
  - constructor(repo: TaskDefinitionRepository)
  - async createTaskDefinition(data: CreateTaskDefinitionInput, userId: string): Promise<Result<TaskDefinition, ServiceError>>
  - async updateTaskDefinition(id: string, data: UpdateTaskDefinitionInput): Promise<Result<TaskDefinition, ServiceError>>
  - async deleteTaskDefinition(id: string): Promise<Result<void, ServiceError>>
  - async getTaskDefinitionUsage(id: string): Promise<Result<TaskDefinitionUsage, ServiceError>>
  - Business logic: usage guard, validation
  - Dependencies: T013 (test must be failing), T018 (repository)

### API Layer

- [ ] **T020** Create API route: GET /api/task-definitions (list) in `src/app/api/task-definitions/route.ts`
  - export async function GET(request: NextRequest)
  - Get request context (tenant_id)
  - Create repository, call findAll()
  - Return NextResponse.json() with data array
  - Handle errors (401, 500)
  - Dependencies: T005 (contract test failing), T018 (repository)

- [ ] **T021** Create API route: POST /api/task-definitions (create) in `src/app/api/task-definitions/route.ts`
  - export async function POST(request: NextRequest)
  - Parse and validate request body with Zod
  - Check supervisor role (403 if not)
  - Create service, call createTaskDefinition()
  - Return 201 with created entity
  - Handle errors (400, 401, 403, 500)
  - Dependencies: T006 (contract test failing), T019 (service)

- [ ] **T022** Create API route: GET /api/task-definitions/:id (detail) in `src/app/api/task-definitions/[id]/route.ts`
  - export async function GET(request: NextRequest, { params }: { params: { id: string } })
  - Get request context
  - Create repository, call findById(params.id)
  - Return 200 with task definition
  - Handle errors (404, 401, 500)
  - Dependencies: T007 (contract test failing), T018 (repository)

- [ ] **T023** Create API route: PATCH /api/task-definitions/:id (update) in `src/app/api/task-definitions/[id]/route.ts`
  - export async function PATCH(request: NextRequest, { params }: { params: { id: string } })
  - Parse and validate request body with Zod (partial)
  - Check supervisor role (403 if not)
  - Create service, call updateTaskDefinition()
  - Return 200 with updated entity
  - Handle errors (400, 404, 401, 403, 500)
  - Dependencies: T008 (contract test failing), T019 (service)

- [ ] **T024** Create API route: DELETE /api/task-definitions/:id (soft delete) in `src/app/api/task-definitions/[id]/route.ts`
  - export async function DELETE(request: NextRequest, { params }: { params: { id: string } })
  - Check supervisor role (403 if not)
  - Create service, call deleteTaskDefinition()
  - Return 200 success or 409 conflict with usage details
  - Handle errors (404, 409, 401, 403, 500)
  - Dependencies: T009 (contract test failing), T019 (service)

- [ ] **T025** Create API route: GET /api/task-definitions/:id/usage (check usage) in `src/app/api/task-definitions/[id]/usage/route.ts`
  - export async function GET(request: NextRequest, { params }: { params: { id: string } })
  - Get request context
  - Create service, call getTaskDefinitionUsage()
  - Return 200 with usage data
  - Handle errors (404, 401, 500)
  - Dependencies: T010 (contract test failing), T019 (service)

## Phase 3.4: Integration & UI

### UI Components

- [ ] **T026** [P] Create TaskDefinitionCard component in `src/components/task-definitions/TaskDefinitionCard.tsx`
  - Display: name, description (truncated), flags (photo, approval, required)
  - Actions: Edit button, Delete button
  - Adapt from TaskTemplateCard
  - Add agent directive block
  - Dependencies: T016 (types)

- [ ] **T027** [P] Create TaskDefinitionList component in `src/components/task-definitions/TaskDefinitionList.tsx`
  - Fetch definitions from GET /api/task-definitions
  - Render grid of TaskDefinitionCard components
  - Sort alphabetically by name
  - Loading state, error state
  - Add agent directive block
  - Dependencies: T020 (API endpoint), T026 (Card component)

- [ ] **T028** [P] Create TaskDefinitionForm component in `src/components/task-definitions/TaskDefinitionForm.tsx`
  - Fields: name, description, acceptance_criteria, requires_photo_verification, requires_supervisor_approval, is_required
  - Client-side validation with Zod
  - Submit to POST or PATCH endpoints
  - Error display
  - Add agent directive block
  - Dependencies: T017 (schemas)

- [ ] **T029** [P] Create TaskDefinitionDetail component in `src/components/task-definitions/TaskDefinitionDetail.tsx`
  - Display full task definition details
  - Edit mode toggle
  - Delete with confirmation (check usage first)
  - Add agent directive block
  - Dependencies: T016 (types)

### UI Pages

- [ ] **T030** Create task definitions list page in `src/app/(authenticated)/supervisor/task-definitions/page.tsx`
  - Render TaskDefinitionList component
  - "Create Task" button → navigate to /new
  - Page title: "Task Library"
  - Supervisor auth guard
  - Add agent directive block
  - Dependencies: T027 (List component)

- [ ] **T031** Create task definition detail page in `src/app/(authenticated)/supervisor/task-definitions/[id]/page.tsx`
  - Fetch definition from GET /api/task-definitions/:id
  - Render TaskDefinitionDetail component
  - Edit/Delete actions
  - Breadcrumb navigation
  - Add agent directive block
  - Dependencies: T022 (detail API), T029 (Detail component)

- [ ] **T032** Create task definition create page in `src/app/(authenticated)/supervisor/task-definitions/new/page.tsx`
  - Render TaskDefinitionForm component
  - Submit to POST /api/task-definitions
  - Redirect to list on success
  - Add agent directive block
  - Dependencies: T021 (create API), T028 (Form component)

### Dashboard Integration

- [ ] **T033** Update supervisor dashboard in `src/app/(authenticated)/supervisor/dashboard/page.tsx`
  - Add "Tasks" tile next to "Task Templates" tile
  - Icon: CheckSquare or List from lucide-react
  - Navigation: /supervisor/task-definitions
  - Label: "Task Library" or "Task Management"
  - Dependencies: T030 (list page exists)

### Task Template Integration

- [ ] **T034** Update TaskTemplateService to support adding from task library in `src/domains/task-template/services/TaskTemplateService.ts`
  - Add method: async addTaskFromDefinition(templateId: string, definitionId: string)
  - Fetch task definition
  - Copy fields to template_items with source_definition_id
  - Return Result<TaskTemplateItem, ServiceError>
  - Dependencies: T019 (TaskDefinitionService)

- [ ] **T035** Update task template UI to show "Add from Library" button
  - Add button in template editor
  - Modal to select from task definitions
  - Call TaskTemplateService.addTaskFromDefinition()
  - Refresh template items
  - Dependencies: T034 (service method)

## Phase 3.5: Polish & Validation

### End-to-End Tests

- [ ] **T036** E2E test: Create task definition flow in `tests/e2e/task-definitions/create-flow.spec.ts`
  - Navigate to /supervisor/task-definitions
  - Click "Create Task"
  - Fill form with valid data
  - Submit
  - Verify appears in list
  - Verify database record created
  - Dependencies: T030, T032 (pages exist)

- [ ] **T037** E2E test: Edit task definition flow in `tests/e2e/task-definitions/edit-flow.spec.ts`
  - Navigate to task definition detail
  - Click "Edit"
  - Update fields
  - Submit
  - Verify changes reflected
  - Verify updated_at changed
  - Dependencies: T031 (detail page)

- [ ] **T038** E2E test: Delete task definition with usage guard in `tests/e2e/task-definitions/delete-flow.spec.ts`
  - Create task definition
  - Add to template
  - Attempt delete
  - Verify 409 error with template names
  - Remove from template
  - Delete successfully
  - Verify soft deleted (deleted_at set)
  - Dependencies: T035 (template integration)

### Performance & Validation

- [ ] **T039** Performance test: Task list load time in `tests/performance/task-definitions-load.bench.ts`
  - Seed 100 task definitions
  - Measure GET /api/task-definitions response time
  - Verify < 2 seconds (NFR-001)
  - Measure page render time
  - Dependencies: T020 (list API)

- [ ] **T040** Run quickstart validation scenarios in `specs/014-add-task-management/quickstart.md`
  - Scenario 1: Create task definition
  - Scenario 2: View task list
  - Scenario 3: Edit task definition
  - Scenario 4: Delete unused task
  - Scenario 5: Delete in-use task (blocked)
  - Scenario 6: Add to template
  - Scenario 7: Worker permission check
  - Scenario 8: Cross-tenant isolation
  - Verify all SQL validation queries
  - Document results
  - Dependencies: All implementation tasks complete

### Documentation

- [ ] **T041** [P] Update database documentation in `docs/database/guides/agent-quickstart.md`
  - Add task_definitions table schema
  - Document RLS policy
  - Document indexes
  - Document relationships with task_template_items
  - Dependencies: T002 (migration complete)

- [ ] **T042** [P] Update CHANGELOG.md
  - Add entry for feature 014-add-task-management
  - Document breaking changes (none expected)
  - Document new API endpoints
  - Document database migration
  - Dependencies: All tasks complete

## Dependencies Graph

```
Setup Layer:
T001 → T002 → T003
T004 (parallel)

Test Layer (all parallel, all depend on setup):
T005, T006, T007, T008, T009, T010 (contract tests)
T011, T012, T013 (unit tests)
T014, T015 (integration tests)

Implementation Layer:
T003 → T016 (types)
T011 → T017 (schemas)
T012, T016, T017 → T018 (repository)
T013, T018 → T019 (service)
T005, T018 → T020 (GET list)
T006, T019 → T021 (POST create)
T007, T018 → T022 (GET detail)
T008, T019 → T023 (PATCH update)
T009, T019 → T024 (DELETE)
T010, T019 → T025 (GET usage)

UI Layer (parallel sets):
T016 → T026, T028, T029 (components)
T020, T026 → T027 (list component)
T027 → T030 (list page)
T022, T029 → T031 (detail page)
T021, T028 → T032 (create page)
T030 → T033 (dashboard)

Integration:
T019 → T034 (template service)
T034 → T035 (template UI)

Polish:
T030, T032 → T036 (E2E create)
T031 → T037 (E2E edit)
T035 → T038 (E2E delete)
T020 → T039 (performance)
All → T040 (quickstart)
T002 → T041, T042 (docs)
```

## Parallel Execution Examples

### Example 1: Contract Tests (Phase 3.2)
After T004 complete, run all 6 contract tests in parallel:
```bash
# All use different files - safe to parallelize
Task: "Contract test GET /api/task-definitions (list)"
Task: "Contract test POST /api/task-definitions (create)"
Task: "Contract test GET /api/task-definitions/:id (detail)"
Task: "Contract test PATCH /api/task-definitions/:id (update)"
Task: "Contract test DELETE /api/task-definitions/:id (soft delete)"
Task: "Contract test GET /api/task-definitions/:id/usage (usage)"
```

### Example 2: Unit Tests (Phase 3.2)
After contract tests, run unit tests in parallel:
```bash
# Different test files - safe to parallelize
Task: "Unit test Zod schemas"
Task: "Unit test TaskDefinitionRepository"
Task: "Unit test TaskDefinitionService"
```

### Example 3: UI Components (Phase 3.4)
After T016 (types), run component creation in parallel:
```bash
# Different component files - safe to parallelize
Task: "Create TaskDefinitionCard component"
Task: "Create TaskDefinitionForm component"
Task: "Create TaskDefinitionDetail component"
```

### Example 4: Documentation (Phase 3.5)
After implementation complete, run docs in parallel:
```bash
# Different doc files - safe to parallelize
Task: "Update database documentation"
Task: "Update CHANGELOG.md"
```

## Validation Checklist

Before marking feature complete:

- [x] All contracts have corresponding tests (T005-T010)
- [x] All entities have model tasks (T016 TaskDefinition)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (verified file conflicts)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [ ] All 6 API endpoints implemented (T020-T025)
- [ ] All 8 quickstart scenarios pass (T040)
- [ ] Performance goal met: < 2s load time (T039)
- [ ] Test coverage ≥80% (verify after T040)
- [ ] Constitutional compliance verified (RLS, Repository, TDD)

## Task Count Summary

- **Setup**: 4 tasks (T001-T004)
- **Tests**: 11 tasks (T005-T015)
- **Implementation**: 10 tasks (T016-T025)
- **UI**: 10 tasks (T026-T035)
- **Polish**: 7 tasks (T036-T042)
- **Total**: 42 tasks

## Estimated Timeline

- **Phase 3.1 (Setup)**: 2-3 hours
- **Phase 3.2 (Tests)**: 6-8 hours (TDD critical path)
- **Phase 3.3 (Implementation)**: 8-10 hours
- **Phase 3.4 (UI)**: 6-8 hours
- **Phase 3.5 (Polish)**: 4-6 hours
- **Total**: ~26-35 hours

## Notes

- **TDD Enforcement**: Phase 3.2 must complete before 3.3 - tests must fail first
- **Parallel Safety**: [P] tasks verified for file independence
- **Constitutional Compliance**: All tasks follow repository pattern, RLS policies, test coverage
- **Commit Strategy**: Commit after each task completion
- **Test-First**: Contract tests drive API implementation, unit tests drive domain layer
- **Performance**: NFR-001 verified in T039 (< 2s load time)
- **Documentation**: Always update docs after schema changes (T041, T042)

---

**Tasks Ready for Execution**: 2025-10-19
**Next Step**: Begin Phase 3.1 (Setup) with T001
