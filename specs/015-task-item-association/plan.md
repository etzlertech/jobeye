
# Implementation Plan: Task-Level Item Association

**Branch**: `015-task-item-association` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/travisetzler/Documents/GitHub/jobeye/specs/015-task-item-association/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Enable associating Items and Item Kits directly to Tasks and Task Templates, creating task-level equipment requirements ("Job Load Lists"). This complements existing job-level item assignment by allowing supervisors to specify which equipment/materials are needed for specific tasks. Key deliverables:

- Two new association tables: `task_template_item_associations` and `workflow_task_item_associations`
- Enhanced template editing UI to add items/kits to template tasks
- Template instantiation logic to copy item associations from template to workflow tasks
- Job planning view showing equipment needs aggregated by task
- Worker task view showing required equipment for current task
- Supervisor override capabilities to customize item requirements per job

## Technical Context
**Language/Version**: TypeScript 5.3, Next.js 14 (App Router), React 18
**Primary Dependencies**: Supabase Client SDK, Zod (validation), Lucide React (icons)
**Storage**: PostgreSQL 15 via Supabase (multi-tenant with RLS)
**Testing**: Vitest (unit tests), Playwright (integration tests), coverage ≥80%
**Target Platform**: Web application (responsive PWA)
**Project Type**: Web (Next.js SSR + client components)
**Performance Goals**: <1s job load with 50 tasks + 200 item associations, <2s template save with 10 tasks
**Constraints**: RLS mandatory on all tables, tenant isolation enforced, repository pattern required
**Scale/Scope**: ~10 new database operations, 6 new UI components, ~2000 LoC across 15 files

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Database Architecture (RLS-First) ✅
- [x] All new tables include `tenant_id UUID NOT NULL REFERENCES tenants(id)`
- [x] All new tables have RLS enabled with tenant_isolation policy
- [x] RLS policies use correct path: `request.jwt.claims -> 'app_metadata' ->> 'tenant_id'`
- [x] Foreign key constraints for data integrity
- [x] Check constraints for business rules (item_id XOR kit_id)

**Status**: PASS - Two new tables (`task_template_item_associations`, `workflow_task_item_associations`) will follow RLS pattern

### Hybrid Vision Pipeline N/A
- Not applicable to this feature (no vision/ML components)

### Voice-First UX N/A
- Not applicable to Phase 1 (UI-based feature, voice integration out of scope)

### Cost & Model Governance N/A
- Not applicable (no AI/LLM operations)

### Development Standards ✅
- [x] Agent directive blocks on all TypeScript files
- [x] Complexity budget: 300 LoC per file (expect 15 files avg ~130 LoC each)
- [x] Test coverage ≥80% requirement
- [x] Repository pattern for all database access
- [x] Service pattern for business logic
- [x] Result<T, E> pattern for error handling

**Status**: PASS - Following established patterns from task-template domain

### Architectural Invariants ✅
- [x] No direct database access (repository pattern)
- [x] All errors logged with context
- [x] Foreign key constraints prevent orphaned data
- [x] Cascade deletes configured where appropriate

**Status**: PASS - Consistent with existing codebase architecture

### Database Precheck (Rule 1) ✅
- [x] Will query actual schema via Supabase MCP before migrations
- [x] Will use idempotent CREATE TABLE IF NOT EXISTS statements
- [x] Will apply single-statement migrations (no DO $$ blocks)
- [x] Will verify indexes and constraints before adding

**Status**: PASS - Migration strategy documented in Phase 1

### Push After Commit (Rule 2) ✅
- [x] All commits will be pushed immediately
- [x] Push failures will be reported with specific errors

**Status**: PASS - Standard workflow

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── domains/
│   ├── task-template/
│   │   ├── repositories/TaskTemplateItemAssociationRepository.ts (NEW)
│   │   ├── services/TaskTemplateService.ts (MODIFY - add association methods)
│   │   ├── types/task-template-association-types.ts (NEW)
│   │   └── schemas/task-template-association-schemas.ts (NEW)
│   ├── workflow-task/
│   │   ├── repositories/WorkflowTaskItemAssociationRepository.ts (NEW)
│   │   ├── services/WorkflowTaskService.ts (MODIFY - add association methods)
│   │   ├── types/workflow-task-association-types.ts (NEW)
│   │   └── schemas/workflow-task-association-schemas.ts (NEW)
│   ├── item/ (EXISTING - no changes)
│   └── kit/ (EXISTING - no changes)
├── app/
│   └── (authenticated)/
│       └── supervisor/
│           ├── templates/
│           │   ├── [id]/edit/page.tsx (MODIFY - add item association UI)
│           │   └── components/
│           │       ├── TaskItemAssociationManager.tsx (NEW)
│           │       └── ItemKitBrowserModal.tsx (NEW)
│           └── jobs/
│               └── [id]/
│                   ├── page.tsx (MODIFY - show task equipment)
│                   └── components/
│                       └── TaskEquipmentList.tsx (NEW)
├── components/
│   └── task-items/
│       ├── ItemAssociationCard.tsx (NEW)
│       └── KitAssociationCard.tsx (NEW)
└── types/
    └── database.ts (UPDATE - add new table types)

migrations/ (or equivalent)
└── 20251019_add_task_item_associations.sql (NEW)

tests/
├── integration/
│   ├── task-template-item-associations/
│   │   └── crud.int.test.ts (NEW)
│   └── workflow-task-item-associations/
│       └── crud.int.test.ts (NEW)
└── unit/
    ├── task-template/
    │   └── TaskTemplateItemAssociationRepository.test.ts (NEW)
    └── workflow-task/
        └── WorkflowTaskItemAssociationRepository.test.ts (NEW)
```

**Structure Decision**: Web application using Next.js App Router with domain-driven design. New association functionality spans two existing domains (task-template and workflow-task) plus shared UI components. Following established repository → service → API route → component pattern.

## Phase 0: Outline & Research ✅ COMPLETE

**Output**: `/specs/015-task-item-association/research.md`

### Research Questions Resolved

1. **R1: Association Table Design** → Two separate junction tables (template vs. workflow)
2. **R2: Item vs. Kit Distinction** → Support BOTH with XOR constraint
3. **R3: Template Instantiation** → Service-layer copy with source tracking
4. **R4: Status Tracking** → ENUM with 5 states (pending, loaded, verified, missing, returned)
5. **R5: UI Architecture** → Accordion panels with co-located item association manager
6. **R6: Performance Strategy** → Single query with nested selects, indexed foreign keys

All technical unknowns resolved. No NEEDS CLARIFICATION remaining.

## Phase 1: Design & Contracts ✅ COMPLETE

**Output**:
- `/specs/015-task-item-association/data-model.md` - Complete entity definitions, schemas, migrations
- `/specs/015-task-item-association/contracts/template-item-associations-api.yaml` - OpenAPI spec for template associations
- `/specs/015-task-item-association/contracts/workflow-task-item-associations-api.yaml` - OpenAPI spec for workflow associations
- `/specs/015-task-item-association/quickstart.md` - 6 test scenarios with validation steps
- `CLAUDE.md` - Updated with new domain context

### Entities Created

1. **task_template_item_associations** - Links template items to required items/kits
   - Columns: id, tenant_id, template_item_id, item_id, kit_id, quantity, is_required, notes
   - Constraints: XOR (item_id OR kit_id), unique per template item
   - Indexes: template_item_id, item_id, kit_id, tenant_id

2. **workflow_task_item_associations** - Links workflow tasks to items/kits with status tracking
   - Columns: id, tenant_id, workflow_task_id, item_id, kit_id, quantity, is_required, status, loaded_at, loaded_by, notes, source_template_association_id
   - Constraints: XOR (item_id OR kit_id), unique per workflow task, loaded_at/loaded_by together
   - Indexes: workflow_task_id, item_id, kit_id, source_template_association_id, status, tenant_id

### API Contracts

**Template Item Associations**:
- GET /api/task-templates/{templateId}/items/{itemId}/associations
- POST /api/task-templates/{templateId}/items/{itemId}/associations
- GET /api/task-templates/{templateId}/items/{itemId}/associations/{associationId}
- PATCH /api/task-templates/{templateId}/items/{itemId}/associations/{associationId}
- DELETE /api/task-templates/{templateId}/items/{itemId}/associations/{associationId}

**Workflow Task Item Associations**:
- GET /api/jobs/{jobId}/tasks/{taskId}/associations
- POST /api/jobs/{jobId}/tasks/{taskId}/associations
- GET /api/jobs/{jobId}/tasks/{taskId}/associations/{associationId}
- PATCH /api/jobs/{jobId}/tasks/{taskId}/associations/{associationId}
- DELETE /api/jobs/{jobId}/tasks/{taskId}/associations/{associationId}
- POST /api/jobs/{jobId}/tasks/{taskId}/associations/{associationId}/load (convenience endpoint)

### Quickstart Scenarios

1. Add items to template task
2. Instantiate template with items
3. Load equipment for task
4. Supervisor override
5. Performance validation
6. RLS and tenant isolation

## Phase 2: Task Planning Approach ✅ DESCRIBED

*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

When `/tasks` command runs, it will:

1. **Load templates**:
   - `.specify/templates/tasks-template.md` as base structure
   - Phase 1 design docs (data-model.md, contracts/, quickstart.md)

2. **Generate database tasks**:
   - T001: Create migration file for task_item_status ENUM
   - T002: Create task_template_item_associations table with RLS
   - T003: Create workflow_task_item_associations table with RLS
   - T004: Add indexes on association tables
   - T005: Add triggers for timestamps and status transitions
   - T006: Verify migration with actual database precheck (Rule 1)
   - T007: Apply migration to production via Supabase MCP

3. **Generate repository layer tasks** (TDD - tests first):
   - T008: Create TaskTemplateItemAssociationRepository interface and tests [P]
   - T009: Implement TaskTemplateItemAssociationRepository CRUD
   - T010: Create WorkflowTaskItemAssociationRepository interface and tests [P]
   - T011: Implement WorkflowTaskItemAssociationRepository CRUD

4. **Generate service layer tasks**:
   - T012: Add association methods to TaskTemplateService (tests first)
   - T013: Add association methods to WorkflowTaskService (tests first)
   - T014: Update TaskTemplateService.instantiateTemplate() to copy associations
   - T015: Add business rule: Required items block task completion

5. **Generate API route tasks**:
   - T016: Create template item associations API routes [P]
   - T017: Create workflow task item associations API routes [P]
   - T018: Add /load convenience endpoint
   - T019: API contract tests (based on OpenAPI specs)

6. **Generate UI component tasks**:
   - T020: Create TaskItemAssociationManager component
   - T021: Create ItemKitBrowserModal component
   - T022: Create ItemAssociationCard and KitAssociationCard components
   - T023: Update template edit page to integrate association manager
   - T024: Create TaskEquipmentList component for job view
   - T025: Update job detail page to show task equipment tab
   - T026: Update workflow task view for workers to show required equipment

7. **Generate integration test tasks**:
   - T027: Template item association CRUD integration tests
   - T028: Workflow task item association CRUD integration tests
   - T029: Template instantiation with associations test
   - T030: Equipment loading workflow test
   - T031: RLS and tenant isolation tests

8. **Generate validation tasks**:
   - T032: Execute quickstart.md scenarios 1-6
   - T033: Performance validation (50 tasks, 200 associations)
   - T034: Test coverage verification (≥80%)
   - T035: Update database.ts types via generation

### Ordering Strategy

- **Phase-based**: Migration → Repository → Service → API → UI
- **TDD order**: Tests before implementation within each phase
- **Parallelization**: Mark [P] for tasks that can run in parallel:
  - T008 and T010 (different repos)
  - T016 and T017 (different API routes)
  - Integration tests can run in parallel if properly isolated

### Dependency Graph

```
T001-T007 (Migration) → All other tasks
T008-T011 (Repositories) → T012-T015 (Services)
T012-T015 (Services) → T016-T019 (API Routes)
T016-T019 (API Routes) → T020-T026 (UI Components)
T027-T031 (Integration Tests) → T032-T034 (Validation)
```

### Estimated Output

**Total Tasks**: ~35 numbered, ordered tasks
**Estimated Duration**: 3-4 days for implementation
**Test Coverage Target**: ≥80%
**Lines of Code**: ~2000 LoC across 15 new files + 3 modified files

### Critical Path

Migration → Repositories → Services → API Routes → UI → Validation

Tasks T001-T007 are blocking (must complete before any implementation).
Tasks T032-T034 are validation gates (must pass before merge).

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) ✅
- [x] Phase 1: Design complete (/plan command) ✅
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✅
- [ ] Phase 3: Tasks generated (/tasks command) - Ready to execute
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS ✅
- [x] Post-Design Constitution Check: PASS ✅
- [x] All NEEDS CLARIFICATION resolved ✅
- [x] Complexity deviations documented: NONE (no deviations) ✅

**Artifacts Generated**:
- [x] spec.md - Feature specification with clarifications
- [x] research.md - 6 research questions resolved
- [x] data-model.md - Complete schema design with migrations
- [x] contracts/template-item-associations-api.yaml - OpenAPI spec
- [x] contracts/workflow-task-item-associations-api.yaml - OpenAPI spec
- [x] quickstart.md - 6 test scenarios
- [x] CLAUDE.md - Updated agent context
- [x] plan.md - This file (complete)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
