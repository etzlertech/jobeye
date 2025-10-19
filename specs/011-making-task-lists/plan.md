
# Implementation Plan: Task Lists for Jobs

**Branch**: `011-making-task-lists` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-making-task-lists/spec.md`

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

**Primary Requirement**: Enable field technicians, supervisors, and administrators to create, manage, and complete structured task lists for jobs with voice-first interface, offline capability, photo verification, and supervisor approval workflows.

**Scope Decision**: Enhance the existing `workflow_tasks` table with missing capabilities rather than creating a new system. The table already has 21 columns including tenant isolation, completion tracking, verification fields, and supervisor approval workflows.

**Key Enhancements Needed**:
1. Add `is_required` boolean field to support required vs. optional task differentiation
2. Add `is_deleted` boolean field to support soft-deletion (prevent hard delete after job starts)
3. Create new `task_templates` table for reusable task definitions by job type
4. Create new `task_template_items` table to define template task sequences
5. Add voice command handlers for task operations (list, complete, add, navigate)
6. Implement job completion validation (block if required tasks incomplete)
7. Update RLS policies to use correct JWT app_metadata path
8. Build repository layer following type-safe patterns

## Technical Context
**Language/Version**: TypeScript 5.4+ / Node.js 20+
**Primary Dependencies**: Next.js 14.2, React 18.3, @supabase/supabase-js 2.43, Zod 3.23, IndexedDB (Dexie 4.2)
**Storage**: PostgreSQL 17.4 (Supabase hosted) with RLS, IndexedDB for offline storage
**Testing**: Jest 29.7 (unit/integration), Playwright 1.55 (E2E), @testing-library/react 16.3
**Target Platform**: Progressive Web App (PWA), modern browsers, mobile-first responsive design
**Project Type**: Web application (Next.js SSR + client-side React)
**Performance Goals**:
- Voice response < 2 seconds (local commands)
- VLM verification < 5 seconds
- Offline sync < 10 seconds after reconnection
- Page load < 3 seconds on 3G
**Constraints**:
- Offline-capable (PWA service worker + IndexedDB)
- Voice-first interface (every action has voice equivalent)
- Multi-tenant isolation (RLS enforced at DB level)
- VLM cost budget: < $0.25 per verification
**Scale/Scope**:
- Multi-tenant SaaS
- ~10k tasks/month per tenant
- 50+ concurrent users per tenant
- 3 new DB tables (task_templates, task_template_items, enhancements to workflow_tasks)
- 6 voice command handlers
- 5 API routes (task CRUD + template management)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Database Architecture (Section 1)
- ✅ **Tenant Isolation**: workflow_tasks already has `tenant_id UUID NOT NULL`. New tables (task_templates, task_template_items) will include tenant_id
- ⚠️ **RLS Policies**: Current workflow_tasks RLS uses `app.current_tenant_id` setting, but constitution requires `request.jwt.claims -> 'app_metadata' ->> 'tenant_id'`. **MUST FIX**
- ✅ **No Bypass Patterns**: Repository pattern enforces all access through Supabase client with RLS
- ✅ **Service Role Minimal Use**: Only for migrations via MCP/scripts, not in application code

### Hybrid Vision Pipeline (Section 2)
- ✅ **VLM First Approach**: Existing `ai_confidence` field supports VLM scoring for task verification
- ✅ **Cost Budget Compliance**: VLM verification budget $0.25/request aligns with constitution's $0.25 per-request limit
- ✅ **Timeout Compliance**: 5-second VLM timeout matches constitution requirement

### Voice-First UX (Section 3)
- ✅ **Voice Equivalents**: All task operations (list, complete, add, navigate) will have voice commands
- ✅ **Offline-First PWA**: IndexedDB + service worker for offline task operations
- ✅ **Background Sync**: Task completions queue offline, sync on reconnection

### Cost & Model Governance (Section 4)
- ✅ **Budget Tracking**: VLM operations record estimated cost in verification_data jsonb
- ✅ **Per-Request Limits**: $0.25 VLM budget within constitution's $0.25 limit

### Development Standards (Section 5)
- ✅ **Agent Directive Blocks**: All new TypeScript files will include @file, @phase, @domain, @purpose, @complexity_budget, @test_coverage headers
- ✅ **Complexity Budget**: 300 lines default, 500 max with justification
- ✅ **Testing Requirements**: ≥80% coverage mandatory, integration tests for RLS, E2E for voice flows

### Architectural Invariants (Section 6)
- ✅ **Repository Pattern**: All DB operations through type-safe repository layer (WorkflowTaskRepository, TaskTemplateRepository)
- ✅ **Async AI Calls**: VLM verification async with 5s timeout
- ✅ **Cost Tracking**: Every VLM call records cost in verification_data
- ✅ **Error Logging**: All errors logged with voice context
- ✅ **Voice Session State**: Task operations maintain voice session state

### Non-Negotiables (Section 8)
- ✅ **Rule 1 - DB Precheck**: Will query workflow_tasks schema via MCP before migrations
- ✅ **Rule 1 - Idempotent SQL**: Migrations use CREATE IF NOT EXISTS, ALTER IF NOT EXISTS patterns
- ✅ **Rule 1 - No Multi-Statement Blocks**: Each migration statement executed individually
- ✅ **Rule 2 - Push After Commit**: Git push immediately after each commit

### Gate Status: ⚠️ CONDITIONAL PASS
**Issue**: workflow_tasks RLS policy uses incorrect JWT path (`app.current_tenant_id` instead of `request.jwt.claims -> 'app_metadata' ->> 'tenant_id'`)

**Resolution**: Phase 0 research must include RLS policy correction as first migration task

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
│   ├── workflow-task/          # Existing workflow_tasks domain
│   │   ├── WorkflowTaskRepository.ts
│   │   ├── WorkflowTaskService.ts
│   │   └── types.ts
│   └── task-template/          # NEW: Task templates domain
│       ├── TaskTemplateRepository.ts
│       ├── TaskTemplateService.ts
│       └── types.ts
├── app/
│   └── api/
│       ├── jobs/[id]/tasks/    # Task CRUD operations
│       │   ├── route.ts         # GET (list), POST (create)
│       │   └── [taskId]/
│       │       └── route.ts     # PATCH (update), DELETE (soft delete)
│       └── task-templates/      # Template management
│           ├── route.ts         # GET (list), POST (create)
│           └── [id]/
│               └── route.ts     # GET (detail), PATCH, DELETE
├── components/
│   └── tasks/
│       ├── TaskList.tsx
│       ├── TaskItem.tsx
│       └── TaskTemplateSelector.tsx
├── lib/
│   ├── voice/
│   │   └── taskCommands.ts     # Voice command handlers
│   └── offline/
│       └── taskSync.ts         # Offline sync logic
└── types/
    └── supabase.ts             # Auto-generated from DB schema

tests/
├── integration/
│   ├── workflow-task/
│   │   ├── taskRepo.int.test.ts
│   │   └── taskService.int.test.ts
│   └── task-template/
│       ├── templateRepo.int.test.ts
│       └── templateService.int.test.ts
├── api/
│   ├── tasks.api.test.ts
│   └── task-templates.api.test.ts
└── e2e/
    └── task-voice-commands.spec.ts

supabase/migrations/
└── [timestamp]_enhance_workflow_tasks.sql
```

**Structure Decision**: Next.js 14 App Router structure with domain-driven organization. Task management spans multiple domains (workflow-task, task-template) with repositories, services, API routes, React components, and voice handlers.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. **Database Migration Tasks** (Sequential):
   - Task 1: Execute workflow_tasks enhancement migration (add is_required, is_deleted, template_id)
   - Task 2: Fix workflow_tasks RLS policy to use JWT app_metadata
   - Task 3: Create task_templates table with RLS
   - Task 4: Create task_template_items table with RLS
   - Task 5: Create indexes for performance
   - Task 6: Verify migration success and RLS policies

2. **Repository Layer Tasks** [P]:
   - Task 7-8: Enhance WorkflowTaskRepository (findIncompleteRequired, softDelete, createFromTemplate)
   - Task 9-10: Create TaskTemplateRepository (CRUD operations)
   - Task 11-12: Write repository unit tests (≥80% coverage)

3. **Service Layer Tasks** [P]:
   - Task 13: Create WorkflowTaskService (business logic for completion validation)
   - Task 14: Create TaskTemplateService (template instantiation logic)
   - Task 15-16: Write service unit tests

4. **API Route Tasks** [P]:
   - Task 17: Implement GET/POST /api/jobs/:id/tasks
   - Task 18: Implement PATCH/DELETE /api/jobs/:id/tasks/:taskId
   - Task 19: Implement GET/POST /api/task-templates
   - Task 20: Implement POST /api/task-templates/:id/instantiate
   - Task 21-22: Write API contract tests

5. **Voice Interface Tasks**:
   - Task 23: Create taskCommands.ts with 6 voice handlers
   - Task 24: Register voice commands in command parser
   - Task 25: Write E2E voice command tests

6. **Offline Sync Tasks**:
   - Task 26: Create Dexie database schema for offline tasks
   - Task 27: Implement offline sync service with background worker
   - Task 28: Write offline sync integration tests

7. **UI Component Tasks** [P]:
   - Task 29: Create TaskList component
   - Task 30: Create TaskItem component
   - Task 31: Create TaskTemplateSelector component

8. **Integration & Validation**:
   - Task 32: Write integration tests for RLS isolation
   - Task 33: Write E2E tests for complete task workflow
   - Task 34: Run performance validation (voice < 2s, VLM < 5s)
   - Task 35: Update agent context (CLAUDE.md)
   - Task 36: Run pre-commit checks and verify ≥80% coverage

**Ordering Strategy**:
- Database first (blocks all other work)
- Repository before services (dependency)
- Services before API routes (dependency)
- API routes before UI (dependency)
- Voice and offline can run parallel with UI
- Integration tests last (need all pieces)

**Parallelization**:
- [P] marks indicate tasks that can run in parallel within their phase
- Example: Repository tests can run while service layer is being built

**Estimated Output**: 36 numbered, dependency-ordered tasks in tasks.md

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
- [x] Phase 0: Research complete (/plan command) - research.md created
- [x] Phase 1: Design complete (/plan command) - data-model.md, contracts/, quickstart.md created
- [x] Phase 2: Task planning complete (/plan command - approach described above)
- [ ] Phase 3: Tasks generated (/tasks command) - tasks.md to be created
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: CONDITIONAL PASS (RLS policy fix required)
- [x] Post-Design Constitution Check: PASS (RLS fix included in Phase 2 tasks)
- [x] All NEEDS CLARIFICATION resolved (5 clarifications answered in spec.md)
- [x] Complexity deviations documented (none - within constitutional bounds)

**Artifacts Created**:
- [x] `/specs/011-making-task-lists/plan.md` (this file)
- [x] `/specs/011-making-task-lists/research.md` (10 research decisions documented)
- [x] `/specs/011-making-task-lists/data-model.md` (3 tables, ERD, TypeScript types)
- [x] `/specs/011-making-task-lists/contracts/tasks-api.md` (5 endpoints documented)
- [x] `/specs/011-making-task-lists/contracts/templates-api.md` (6 endpoints documented)
- [x] `/specs/011-making-task-lists/quickstart.md` (7-step implementation guide)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
