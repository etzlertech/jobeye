# Implementation Plan: Scheduling, Day Plan & Kit Assignment

**Branch**: `003-scheduling-kits` | **Date**: 2025-01-29 | **Spec**: [003-scheduling-kits.md](../003-scheduling-kits.md)
**Input**: Feature specification from `.specify/features/003-scheduling-kits.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
2. Fill Technical Context ✓
3. Fill Constitution Check ✓
4. Evaluate Constitution Check ✓
5. Execute Phase 0 → research.md ✓
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
7. Re-evaluate Constitution Check ✓
8. Plan Phase 2 → Task generation approach ✓
9. STOP - Ready for /tasks command
```

## Summary
Voice-driven job scheduling system with technician day plans, route optimization, and reusable kit management. Supports offline-first operation with conflict resolution and integrates deeply with the voice pipeline for hands-free field operations.

## Technical Context
**Language/Version**: TypeScript 5.x / Node.js 20.x (Next.js 14)
**Primary Dependencies**: Next.js 14, Supabase SDK, React 18, TanStack Query, Twilio SDK
**Storage**: Supabase (PostgreSQL) with PostGIS for route optimization
**Testing**: Jest, React Testing Library, Playwright
**Target Platform**: Web (Progressive Web App with offline support)
**Project Type**: web (frontend + backend)
**Performance Goals**: Day plan load <500ms, Voice-to-schedule <2s, Route optimization <3s for 50 stops
**Constraints**: Offline cache <100MB per tech, Max 6 jobs per technician per day
**Scale/Scope**: Support 1000+ technicians, 10k+ jobs/day, Multi-tenant isolation

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Based on the JobEye project constitution (Architecture-as-Code principles):
- ✅ **Directive Block Contract**: All files will include proper AGENT DIRECTIVE BLOCKS
- ✅ **Complexity Budget**: Each file limited to 300 LoC default (500 max)
- ✅ **Voice-First Design**: Core feature is voice-driven scheduling
- ✅ **Multi-Tenant Architecture**: All tables include company_id for RLS
- ✅ **Offline-First**: Local caching and queue-based sync designed in
- ✅ **Repository Pattern**: Database access through repository classes only
- ✅ **Testing Requirements**: 90% coverage target with unit/integration/E2E tests

## Project Structure

### Documentation (this feature)
```
.specify/features/003-scheduling-kits/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command) ✓
├── data-model.md        # Phase 1 output (/plan command) ✓
├── quickstart.md        # Phase 1 output (/plan command) ✓
├── contracts/           # Phase 1 output (/plan command) ✓
│   ├── scheduling-api.yaml
│   └── kit-management-api.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── scheduling/
│   ├── repositories/
│   │   ├── day-plan.repository.ts
│   │   ├── schedule-event.repository.ts
│   │   ├── crew-assignment.repository.ts
│   │   ├── kit.repository.ts
│   │   ├── kit-item.repository.ts
│   │   ├── kit-variant.repository.ts
│   │   ├── job-kit.repository.ts
│   │   ├── kit-override-log.repository.ts
│   │   └── notification-delivery.repository.ts
│   ├── services/
│   │   ├── scheduling.service.ts
│   │   ├── schedule-conflict.service.ts
│   │   ├── schedule-notification.service.ts
│   │   ├── day-plan.service.ts
│   │   ├── day-plan-validation.service.ts
│   │   ├── break-scheduler.service.ts
│   │   ├── kit.service.ts
│   │   ├── route-optimization.service.ts
│   │   ├── notification.service.ts
│   │   ├── container-integration.service.ts
│   │   ├── travel-time.service.ts
│   │   ├── offline-travel.service.ts
│   │   ├── notification-rate-limiter.service.ts
│   │   ├── cost-monitor.service.ts
│   │   └── data-retention.service.ts
│   ├── voice/
│   │   ├── scheduling-intents.ts
│   │   ├── kit-management-intents.ts
│   │   └── day-plan-queries.ts
│   └── offline/
│       ├── scheduling-cache.ts
│       ├── conflict-resolver.ts
│       └── sync-queue.ts
├── components/
│   ├── scheduling/
│   │   ├── SchedulingWizard.tsx
│   │   ├── DayPlanView.tsx
│   │   └── KitManagement.tsx
│   └── voice/
│       └── VoiceSchedulingUI.tsx
└── __tests__/
    ├── scheduling/
    │   ├── unit/
    │   ├── integration/
    │   └── rls/
    └── e2e/
        └── scheduling-flows.test.ts

supabase/
├── functions/
│   ├── notify-kit-override/
│   └── twilio-webhook/
└── migrations/
    └── 035_scheduling_kits_schema.sql
```

**Structure Decision**: Web application structure with dedicated scheduling module following the project's domain-driven architecture. Repositories for data access, services for business logic, voice integration for natural language commands, and offline support for field operations.

## Phase 0: Outline & Research ✓

Research completed and documented in research.md:
- Route optimization: Mapbox primary with PostGIS foundation
- Notifications: Twilio via Supabase Edge Functions
- Offline sync: Custom IndexedDB for MVP, PowerSync deferred to Phase 2
- All technical decisions documented with rationale

**Output**: research.md with all NEEDS CLARIFICATION resolved ✓

## Phase 1: Design & Contracts ✓

1. **Data model created** → `data-model.md` ✓
   - 8 entities with relationships defined
   - Validation rules documented
   - State transitions mapped

2. **API contracts generated** → `/contracts/` ✓
   - scheduling-api.yaml: Day plans and events
   - kit-management-api.yaml: Kit CRUD and assignments
   - OpenAPI 3.1.0 format

3. **Contract tests planned** (for Phase 2):
   - One test file per endpoint
   - Schema validation tests
   - RLS policy tests

4. **Test scenarios extracted** → quickstart.md ✓
   - 6 complete user scenarios
   - Voice command examples
   - Offline sync workflows

5. **Agent file updated** → CLAUDE.md ✓
   - Added scheduling-kits section
   - New technologies documented
   - Voice commands listed

**Output**: data-model.md, /contracts/*, quickstart.md, CLAUDE.md updated ✓

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load contracts and data model from Phase 1
- Generate failing contract tests first (TDD approach)
- Create repository classes with CRUD operations
- Implement services with business logic
- Add voice intent handlers
- Create offline sync infrastructure
- Build React components
- Write integration tests

**Task Categories**:
1. **Database Migration** [P]
   - Create all 8 tables with indexes
   - Add RLS policies
   - Create triggers for notifications

2. **Repository Layer** [P]
   - 8 repository classes (one per entity)
   - Basic CRUD operations
   - Offline queue integration

3. **Service Layer**
   - SchedulingService: Event management
   - DayPlanService: Route optimization
   - KitService: Kit management with overrides
   - NotificationService: Twilio integration

4. **Voice Integration**
   - Intent patterns for scheduling
   - Kit override voice flows
   - Day plan queries

5. **Offline Infrastructure**
   - IndexedDB setup
   - Service worker registration
   - Sync queue implementation
   - Conflict resolution

6. **UI Components**
   - Scheduling wizard
   - Day plan view with map
   - Kit management interface

7. **Testing**
   - Contract tests for all endpoints
   - RLS policy tests
   - Offline sync tests
   - E2E scheduling flows

**Ordering Strategy**:
1. Database schema first (foundation)
2. Repositories in parallel [P]
3. Services depend on repositories
4. Voice and offline in parallel [P]
5. UI components last
6. Tests throughout (TDD)

**Estimated Output**: 40-50 numbered tasks covering:
- 10 infrastructure tasks
- 15 backend implementation tasks
- 10 frontend tasks
- 15 testing tasks

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (via /tasks command)
**Phase 4**: Implementation following tasks.md
**Phase 5**: Validation and performance testing

## Complexity Tracking
*No violations detected - all decisions align with constitution*

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - approach described)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none found)

---
*Based on JobEye Architecture-as-Code principles*