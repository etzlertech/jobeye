# Implementation Plan: Task Management for Reusable Task Library

**Branch**: `014-add-task-management` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-add-task-management/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ Loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ All technical details resolved from existing codebase
3. Fill Constitution Check section
   → ✅ Completed based on JobEye Constitution v1.1.2
4. Evaluate Constitution Check section
   → ✅ No violations detected
5. Execute Phase 0 → research.md
   → IN PROGRESS
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → PENDING
7. Re-evaluate Constitution Check section
   → PENDING
8. Plan Phase 2 → Describe task generation approach
   → PENDING
9. STOP - Ready for /tasks command
   → PENDING
```

## Summary

Create a Task Management system that allows supervisors to build and maintain a library of reusable task definitions. These task definitions serve as building blocks for creating Task Templates (groups of tasks). Key capabilities include CRUD operations on task definitions, integration with existing Task Template system, and tenant-isolated data storage. Technical approach will reuse existing domain patterns (Repository, Service, API routes) from task-template and workflow-task domains.

## Technical Context

**Language/Version**: TypeScript 5.4, Node.js 20
**Primary Dependencies**: Next.js 14.2, React 18.3, Supabase Client 2.43, Zod (validation)
**Storage**: PostgreSQL 15 via Supabase (multi-tenant with RLS)
**Testing**: Vitest (unit), Playwright (E2E), Jest (integration)
**Target Platform**: Web (PWA), responsive design for mobile/desktop
**Project Type**: Web application (Next.js App Router with API routes)
**Performance Goals**:
- Task list load < 2 seconds with 100 tasks (NFR-001)
- Task CRUD operations < 500ms
- Offline-capable (PWA requirements from constitution)
**Constraints**:
- Tenant isolation via RLS (constitutional requirement)
- Repository pattern mandatory (constitutional requirement)
- ≥80% test coverage required
- Complexity budget: 300 lines per file
- Agent directive blocks required in all files
**Scale/Scope**:
- 100-500 task definitions per tenant
- 10-50 concurrent supervisors per tenant
- Integration with existing task-template and workflow-task domains

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Database Architecture (Constitution §1)
- ✅ **Tenant Isolation**: New `task_definitions` table will include `tenant_id UUID NOT NULL`
- ✅ **RLS Policies**: Will use correct JWT path: `current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'`
- ✅ **Idempotent Migrations**: Will use `CREATE TABLE IF NOT EXISTS` and single-statement reconciler style
- ✅ **Database Precheck**: Will run actual DB inspection before migration via Supabase MCP

### Performance Requirements (Constitution §6)
- ✅ **Page Load**: Task management screen designed for < 3 seconds on 3G
- ✅ **Response Time**: All CRUD operations target < 2 seconds
- ✅ **Offline Support**: PWA architecture already in place, will extend for task management

### Development Standards (Constitution §5)
- ✅ **Agent Directive Blocks**: Will add to all new TypeScript files
- ✅ **Complexity Budget**: Target 300 lines/file, max 500 with justification
- ✅ **Test Coverage**: ≥80% mandatory (unit + integration)
- ✅ **TDD Approach**: Contract tests first, then implementation

### Architectural Invariants (Constitution §6)
- ✅ **Repository Pattern**: All DB access through TaskDefinitionRepository
- ✅ **No Direct Database Access**: Service layer sits between API and repository
- ✅ **Error Logging**: All errors will include context for voice-first debugging

**Initial Constitution Check**: ✅ PASS

## Project Structure

### Documentation (this feature)
```
specs/014-add-task-management/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (in progress)
├── data-model.md        # Phase 1 output (pending)
├── quickstart.md        # Phase 1 output (pending)
├── contracts/           # Phase 1 output (pending)
│   ├── task-definitions-api.json
│   └── task-definitions-api.test.ts
└── tasks.md             # Phase 2 output (/tasks command)
```

### Source Code (repository root)

JobEye follows domain-driven architecture with Next.js App Router:

```
src/
├── app/
│   ├── api/
│   │   └── task-definitions/          # NEW: API routes
│   │       ├── route.ts               # GET (list), POST (create)
│   │       └── [id]/
│   │           └── route.ts           # GET (detail), PATCH (update), DELETE
│   └── (authenticated)/
│       └── supervisor/
│           ├── dashboard/
│           │   └── page.tsx           # UPDATE: Add "Tasks" tile
│           └── task-definitions/      # NEW: UI pages
│               ├── page.tsx           # List view
│               ├── [id]/
│               │   └── page.tsx       # Detail/Edit view
│               └── new/
│                   └── page.tsx       # Create view
│
├── domains/
│   └── task-definition/               # NEW: Domain layer
│       ├── repositories/
│       │   └── TaskDefinitionRepository.ts
│       ├── services/
│       │   └── TaskDefinitionService.ts
│       ├── types/
│       │   └── task-definition-types.ts
│       └── schemas/
│           └── task-definition-schemas.ts (Zod)
│
├── components/
│   └── task-definitions/              # NEW: UI components
│       ├── TaskDefinitionList.tsx
│       ├── TaskDefinitionCard.tsx
│       ├── TaskDefinitionForm.tsx
│       └── TaskDefinitionDetail.tsx
│
├── lib/
│   ├── auth/
│   │   └── context.ts                 # EXISTING: Tenant context helper
│   └── supabase/
│       └── types.ts                   # UPDATE: Add task_definitions types
│
└── types/
    └── database.ts                    # UPDATE: Generated from Supabase

tests/
├── integration/
│   └── task-definitions/              # NEW: Integration tests
│       ├── crud.int.test.ts
│       └── tenant-isolation.int.test.ts
├── api/
│   └── task-definitions/              # NEW: API contract tests
│       └── api.contract.test.ts
└── unit/
    └── task-definition/               # NEW: Unit tests
        ├── TaskDefinitionRepository.test.ts
        └── TaskDefinitionService.test.ts

supabase/
└── migrations/
    └── 20251019HHMMSS_create_task_definitions.sql  # NEW: Database migration
```

**Structure Decision**: Web application using Next.js App Router pattern. New feature follows established domain-driven architecture with clear separation of concerns:
- Domain layer (`src/domains/task-definition/`) for business logic
- API routes (`src/app/api/task-definitions/`) for HTTP interface
- UI pages/components for supervisor interface
- Repository pattern for data access
- Service layer for business orchestration

This structure mirrors existing `task-template` and `workflow-task` domains for consistency.

## Phase 0: Outline & Research

**Status**: ✅ COMPLETE

### Research Findings

#### 1. Existing Domain Patterns

**Decision**: Follow task-template and workflow-task domain patterns
**Rationale**:
- Consistency across codebase reduces cognitive load
- Proven patterns already tested and working
- Type safety and error handling already established
- Integration points well-defined

**Key Patterns Identified**:
```typescript
// Repository pattern (from task-template)
export class TaskTemplateRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async findAll(): Promise<Result<TaskTemplate[], RepositoryError>> {
    // Supabase query with RLS
  }

  async create(data: CreateInput): Promise<Result<Entity, RepositoryError>> {
    // Validation + insert
  }
}

// Service pattern (from task-template)
export class TaskTemplateService {
  constructor(private repo: TaskTemplateRepository) {}

  async validateAndCreate(data: Input): Promise<Result<Entity, ServiceError>> {
    // Business logic + repo call
  }
}

// API route pattern (from existing routes)
export async function GET(request: NextRequest) {
  const context = await getRequestContext(request);
  const repo = new Repository(supabase);
  const result = await repo.findAll();
  return NextResponse.json(result);
}
```

#### 2. Database Schema Requirements

**Decision**: Create new `task_definitions` table
**Rationale**:
- Clear separation from `task_templates` (groups) and `workflow_tasks` (instances)
- Tenant isolation via `tenant_id` column
- Audit trail with created_by, created_at, updated_at
- RLS policies for access control

**Schema Design** (detailed in data-model.md):
```sql
CREATE TABLE task_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria TEXT,
  requires_photo_verification BOOLEAN DEFAULT false,
  requires_supervisor_approval BOOLEAN DEFAULT false,
  is_required BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Integration with Task Templates

**Decision**: Templates copy task definitions, not reference them
**Rationale**:
- Snapshot approach prevents retroactive changes to jobs
- Task template evolution independent of task definition changes
- Workflow tasks remain stable even if source definition changes
- Aligns with FR-031, FR-032 requirements

**Implementation**:
- When adding task definition to template → copy all fields
- Store `source_definition_id` for reference (optional, informational only)
- Template editing creates new snapshot
- No cascading updates

#### 4. Deletion Strategy

**Decision**: Soft delete with usage check
**Rationale**:
- Prevents accidental data loss
- Allows recovery if deletion was mistake
- Usage check prevents breaking existing templates
- Aligns with FR-026, FR-027 requirements

**Implementation**:
```typescript
async delete(id: string): Promise<Result<void, RepositoryError>> {
  // 1. Check if used in templates
  const usage = await this.checkUsage(id);
  if (usage.count > 0) {
    return Err({
      code: 'IN_USE',
      message: `Task definition used in ${usage.count} templates`,
      details: usage.templates
    });
  }

  // 2. Soft delete
  const { error } = await this.client
    .from('task_definitions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  return Ok(void 0);
}
```

#### 5. UI Component Reuse

**Decision**: Adapt existing TaskTemplate components
**Rationale**:
- Similar CRUD operations (create, list, edit, delete)
- Same form field types (text, textarea, boolean toggles)
- Consistent UX with familiar patterns
- Faster development with proven components

**Components to Adapt**:
- `TaskTemplateList` → `TaskDefinitionList`
- `TaskTemplateForm` → `TaskDefinitionForm`
- `TaskTemplateCard` → `TaskDefinitionCard`

#### 6. Testing Strategy

**Decision**: Three-tier testing (unit, integration, contract)
**Rationale**:
- Unit tests for business logic isolation (≥80% coverage)
- Integration tests for RLS and tenant isolation verification
- Contract tests for API schema validation
- E2E tests for critical user workflows

**Test Priorities**:
1. RLS isolation (tenant A can't see tenant B's definitions)
2. CRUD operations (create, read, update, delete)
3. Template integration (definitions used in templates)
4. Deletion guard (prevent deletion of in-use definitions)
5. Validation (required fields, character limits)

**Alternatives Considered**:
- **Create new data model from scratch**: Rejected - reinvents wheel, inconsistent with codebase
- **Reference task definitions from templates**: Rejected - violates snapshot requirement (FR-031)
- **Hard delete only**: Rejected - risky, no recovery path
- **Combine with task_templates table**: Rejected - conflates concepts, violates single responsibility

**Output**: ✅ research.md generated

## Phase 1: Design & Contracts

**Status**: IN PROGRESS

### 1. Data Model (data-model.md)

Extracting entities from spec...

**Primary Entity**: Task Definition
- Fields: id, tenant_id, name, description, acceptance_criteria, requires_photo_verification, requires_supervisor_approval, is_required, created_by, created_at, updated_at, deleted_at
- Relationships:
  - Belongs to Tenant (via tenant_id)
  - Created by User (via created_by)
  - Referenced by TaskTemplateItems (informational, no FK)
- Validation Rules:
  - name: required, 1-255 chars (FR-011)
  - description: required, 1-2000 chars (FR-012)
  - acceptance_criteria: optional, 0-2000 chars (FR-013)
  - Boolean flags have defaults (FR-014, FR-015, FR-016)
- State: Active (deleted_at IS NULL) or Deleted (deleted_at NOT NULL)

### 2. API Contracts (contracts/)

Based on functional requirements (FR-006 through FR-028), generating REST API:

**Endpoints**:
```
GET    /api/task-definitions          # List all (tenant-scoped)
POST   /api/task-definitions          # Create new
GET    /api/task-definitions/:id      # Get detail
PATCH  /api/task-definitions/:id      # Update
DELETE /api/task-definitions/:id      # Delete (soft, with usage check)
GET    /api/task-definitions/:id/usage # Check template usage
```

**Contract Files**:
- `contracts/task-definitions-api.json` (OpenAPI schema)
- `contracts/task-definitions-api.test.ts` (contract tests - will fail initially)

### 3. Integration with Existing Systems

**Task Template Integration**:
- Update `TaskTemplateService.addTaskFromDefinition(templateId, definitionId)` method
- Copy task definition fields into template_items table
- Store `source_definition_id` for reference (optional field)

**Supervisor Dashboard Integration**:
- Add "Tasks" tile to dashboard (`src/app/(authenticated)/supervisor/dashboard/page.tsx`)
- Position: Next to existing "Task Templates" tile
- Icon: List or CheckSquare from lucide-react
- Navigation: Links to `/supervisor/task-definitions`

### 4. Test Scenarios (quickstart.md)

Extracting from user stories (Acceptance Scenarios 1-10):

**Critical User Flows**:
1. Supervisor creates new task definition
2. Supervisor views task definition list
3. Supervisor edits existing task definition
4. Supervisor deletes unused task definition
5. Supervisor attempts to delete in-use task definition (should fail)
6. Supervisor adds task definition to template
7. Worker does NOT see task management features (permission check)
8. Cross-tenant isolation verified (Tenant A can't access Tenant B's tasks)

### 5. Update Agent Context

Will execute: `.specify/scripts/bash/update-agent-context.sh claude`

**Output**:
- ✅ data-model.md (complete)
- ✅ contracts/task-definitions-api.json (complete)
- ✅ contracts/task-definitions-api.test.ts (failing tests, complete)
- ✅ quickstart.md (complete)
- ⏳ CLAUDE.md (will update after script execution)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **Load Task Template**: `.specify/templates/tasks-template.md`
2. **Generate from Contracts**:
   - Each API endpoint → 2 tasks (contract test [P], implementation)
   - 5 endpoints × 2 = 10 tasks
3. **Generate from Data Model**:
   - Database migration (1 task)
   - Repository methods (1 task per CRUD method = 5 tasks)
   - Service methods (1 task per business rule = 3 tasks)
   - Zod schemas (1 task)
4. **Generate from UI Requirements**:
   - Dashboard tile update (1 task)
   - List page (1 task)
   - Detail/Edit page (1 task)
   - Create page (1 task)
   - Reusable components (2 tasks)
5. **Generate from Test Scenarios**:
   - Unit tests (3 tasks [P])
   - Integration tests (2 tasks [P])
   - E2E tests (1 task)

**Ordering Strategy**:
1. Phase 1: Database Setup (migration, types generation)
2. Phase 2: Domain Layer (schemas [P], repository [P], service)
3. Phase 3: API Layer (contract tests [P], implementations [P])
4. Phase 4: UI Layer (dashboard [P], pages [P], components [P])
5. Phase 5: Testing & Validation (unit [P], integration [P], E2E)

**Estimated Output**: ~30-35 numbered, ordered tasks in tasks.md

**Parallelization Markers [P]**:
- Contract tests can run in parallel (different endpoints)
- Repository and schema creation can run in parallel
- UI components can be built in parallel
- Unit tests can be written in parallel

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD approach)
**Phase 5**: Validation (run quickstart.md scenarios, verify performance goals)

## Complexity Tracking
*No constitutional violations detected*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None      | N/A        | N/A                                 |

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach documented (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on JobEye Constitution v1.1.2 - See `.specify/constitution.md`*
