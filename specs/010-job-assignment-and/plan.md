
# Implementation Plan: Job Assignment and Crew Hub Dashboard

**Branch**: `main` (MAIN-ONLY WORKFLOW) | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/travisetzler/Documents/GitHub/jobeye/specs/010-job-assignment-and/spec.md`

**⚠️ CRITICAL WORKFLOW NOTE**: This project uses **main-only workflow** with auto-deploy to Railway. All commits go directly to `main` branch. Never create or switch branches. Multiple agents coordinate via frequent small commits.

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
Enable supervisors to assign jobs to crew members, and provide a crew dashboard showing assigned jobs sorted by "next to load" priority (scheduled start time). Crew members can view their assigned jobs, access item load lists, and update load status. The implementation requires a new job_assignments table with RLS policies, API endpoints for assignment operations, and a Crew Hub UI matching the supervisor dashboard design.

## Technical Context
**Language/Version**: TypeScript 5.4, Node.js 20+
**Primary Dependencies**: Next.js 14.2, React 18.3, Supabase 2.43, Tailwind CSS 4.1
**Storage**: Supabase PostgreSQL with Row Level Security (RLS)
**Testing**: Jest 29.7 (unit), Playwright 1.55 (E2E), Testing Library 16.3
**Target Platform**: Web (Next.js SSR/SSG), Progressive Web App (PWA)
**Project Type**: web (Next.js frontend + backend API routes)
**Performance Goals**: Dashboard load <3s, job assignment API <500ms, real-time job updates
**Constraints**: Multi-tenant RLS isolation, offline-capable PWA, voice-first UX compatibility
**Scale/Scope**: ~10 API routes, 3-5 UI screens, new database table + RLS policies, 20-30 implementation tasks

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Database Architecture Compliance
- ✅ **Tenant Isolation**: New `job_assignments` table will include `tenant_id` column
- ✅ **RLS Policies**: Will enable RLS and create tenant isolation policy using `app_metadata.tenant_id`
- ✅ **No Bypass Patterns**: All queries through Supabase client with RLS enforcement
- ✅ **Service Role Minimal**: Only for migration application, not runtime queries

### Development Standards Compliance
- ✅ **Agent Directive Blocks**: All new TypeScript files will include required headers
- ✅ **Complexity Budget**: Target 300 LoC/file (max 500), will split into multiple files if needed
- ✅ **Testing Requirements**: ≥80% coverage with unit, integration, and RLS tests
- ✅ **Repository Pattern**: All database access through domain repositories

### Voice-First & PWA Compliance
- ✅ **Voice Compatibility**: New UI will support voice commands (future enhancement)
- ✅ **Offline Support**: Job assignments will sync via service worker (defer to Phase 2)
- ⚠️ **Cost Tracking**: N/A - this feature doesn't use AI/VLM services

### Performance Baselines
- ✅ **Page Load**: < 3 seconds on 3G (existing app meets this)
- ✅ **API Response**: < 500ms for job assignment operations
- ✅ **Database Queries**: Indexed by tenant_id for fast filtering

**Initial Constitution Check**: ✅ PASS - No violations detected

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
├── app/
│   ├── api/
│   │   ├── jobs/[jobId]/
│   │   │   └── assign/route.ts           # POST assign crew to job
│   │   │   │                             # ⚠️ MUST call getRequestContext() first
│   │   │   │                             # ⚠️ MUST verify isSupervisor = true
│   │   │   └── unassign/route.ts         # DELETE remove crew assignment
│   │   │       │                         # ⚠️ MUST call getRequestContext() first
│   │   │       │                         # ⚠️ MUST verify isSupervisor = true
│   │   └── crew/
│   │       └── jobs/route.ts              # GET assigned jobs for crew member
│   │           │                          # ⚠️ MUST call getRequestContext() first
│   │           │                          # ⚠️ MUST use context.userId for filtering
│   ├── (authenticated)/
│   │   ├── crew-hub/
│   │   │   └── page.tsx                   # Crew Hub dashboard
│   │   │       │                          # ⚠️ MUST call getRequestContext() first
│   │   │       │                          # ⚠️ MUST display TenantBadge component
│   │   └── jobs/[id]/
│   │       └── load-list/page.tsx         # Item Load List screen
│   │           │                          # ⚠️ MUST call getRequestContext() first
│   │           │                          # ⚠️ MUST display TenantBadge component
│   └── layout.tsx
├── domains/
│   └── job-assignment/                    # New domain
│       ├── repositories/
│       │   └── job-assignment.repository.ts  # ⚠️ All queries scoped by tenant_id
│       ├── services/
│       │   └── job-assignment.service.ts     # ⚠️ Requires RequestContext param
│       └── types/
│           └── job-assignment.types.ts
├── lib/
│   └── auth/
│       └── context.ts                     # ⚠️ EXTEND with isCrew, isSupervisor helpers
└── components/
    └── crew/
        ├── JobTile.tsx                    # Reusable job card
        └── LoadStatusBadge.tsx            # Load progress indicator

src/__tests__/
├── domains/job-assignment/
│   ├── repositories/job-assignment.repository.test.ts
│   ├── services/job-assignment.service.test.ts
│   └── integration/job-assignment-rls.test.ts
├── api/
│   ├── job-assignment.api.test.ts
│   └── crew-jobs.api.test.ts
└── e2e/
    └── crew-hub-workflow.e2e.test.ts

supabase/migrations/
└── 010_job_assignments.sql                # Migration for job_assignments table
```

**Structure Decision**: Next.js 14 web application with API routes and domain-driven design.
- API routes in `/app/api/` for backend logic
- Page components in `/app/(authenticated)/` for protected routes
- Domain logic in `/src/domains/job-assignment/` following repository pattern
- Tests co-located in `/src/__tests__/` matching source structure
- Database migrations in `/supabase/migrations/`

## ⚠️ CRITICAL: Tenant Context Requirements

**EVERY API route and page component MUST**:

1. **Import and call getRequestContext()** at the start:
```typescript
import { getRequestContext } from '@/lib/auth/context';

export async function GET(request: Request) {
  const context = await getRequestContext(request);
  // context = { tenantId, userId, roles, isCrew, isSupervisor }

  // Use context.tenantId for all database queries
  // Use context.userId for filtering user-specific data
  // Use context.isCrew / isSupervisor for authorization
}
```

2. **Display TenantBadge on all UI pages**:
```typescript
import { TenantBadge } from '@/components/tenant/TenantBadge';

export default async function CrewHubPage() {
  const context = await getRequestContext();

  return (
    <div>
      <TenantBadge tenantName={context.tenantName} role={context.roles[0]} />
      {/* Page content */}
    </div>
  );
}
```

3. **Extend context.ts with role helpers**:
```typescript
// Add to RequestContext interface in src/lib/auth/context.ts
export interface RequestContext {
  tenantId: string;
  userId: string;
  roles: string[];
  tenantName?: string;
  // NEW: Role helpers for this feature
  isCrew: boolean;      // role === 'technician'
  isSupervisor: boolean; // role === 'manager' || role === 'admin'
}
```

**Why This Matters**:
- Ongoing auth migration from header-based (`x-tenant-id`) to session-based (JWT `app_metadata`)
- Missing getRequestContext() call = potential auth regression
- Missing TenantBadge = no visual confirmation of tenant context
- Validates tenant isolation during development/testing

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
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All design decisions comply with constitution.

**Post-Design Constitution Re-Check**:
- ✅ **Database Schema**: `job_assignments` table follows RLS pattern with `app_metadata.tenant_id`
- ✅ **Repository Pattern**: All DB access through `job-assignment.repository.ts`
- ✅ **Complexity Budget**: Estimated file sizes within 300 LoC limit
- ✅ **Testing Coverage**: Unit, integration, RLS, and E2E tests planned
- ✅ **Type Safety**: JobStatus enum mismatch identified and will be resolved
- ✅ **No New External Dependencies**: Uses existing Next.js, React, Supabase stack

**Design Complexity Analysis**:
- **New Table**: 1 table (`job_assignments`) - justified for many-to-many relationships
- **New API Routes**: 3 routes (assign, unassign, crew/jobs) - minimal surface area
- **New Domain**: 1 domain (`job-assignment`) - clean separation of concerns
- **New UI Pages**: 2 pages (crew-hub, load-list) - required by feature spec

**Total Estimated LoC**:
- Backend (repositories + services): ~400 LoC
- API routes: ~300 LoC
- UI components: ~500 LoC
- Tests: ~600 LoC
- **Total**: ~1,800 LoC (reasonable for feature scope)

**Post-Design Constitution Check**: ✅ PASS - No violations, design is constitutional


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - `research.md` created with live DB queries
- [x] Phase 1: Design complete (/plan command) - `data-model.md`, `contracts/`, `quickstart.md` created
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - See Phase 2 section above
- [x] Phase 3: Tasks generated (/tasks command) - `tasks.md` created with 40 ordered, dependency-aware tasks
- [ ] Phase 4: Implementation complete - **Ready to execute tasks.md**
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (no violations)
- [x] Post-Design Constitution Check: PASS (all design decisions constitutional)
- [x] All NEEDS CLARIFICATION resolved (Technical Context had no NEEDS CLARIFICATION markers)
- [x] Complexity deviations documented (none - all within constitutional limits)

**Artifacts Generated**:
- [x] `/specs/010-job-assignment-and/research.md` (Phase 0)
- [x] `/specs/010-job-assignment-and/data-model.md` (Phase 1)
- [x] `/specs/010-job-assignment-and/contracts/assign-job.openapi.yaml` (Phase 1)
- [x] `/specs/010-job-assignment-and/contracts/unassign-job.openapi.yaml` (Phase 1)
- [x] `/specs/010-job-assignment-and/contracts/crew-jobs.openapi.yaml` (Phase 1)
- [x] `/specs/010-job-assignment-and/quickstart.md` (Phase 1)
- [x] `CLAUDE.md` updated with feature context (Phase 1)
- [x] `/specs/010-job-assignment-and/tasks.md` (Phase 3) - 42 implementation tasks with critical refinements

**MCP Query Evidence Trail**:
- ✅ 12 timestamped Supabase MCP queries executed (2025-10-16 07:10:00 - 07:11:06 PST)
- ✅ All findings documented in `research.md` with query transcripts
- ✅ Live database schema verified for jobs, users_extended, tenant_members tables
- ✅ Sample data analyzed (62 jobs, 30 users)
- ✅ RLS policies inspected and constitutional pattern identified

**Next Step**: Execute tasks from `tasks.md` starting with T001-T002 (setup), then proceed through phases 3.2-3.9.

---
*Based on Constitution v1.1.2 - See `.specify/constitution.md`*
