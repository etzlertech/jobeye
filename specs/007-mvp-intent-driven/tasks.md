# Tasks: MVP Intent-Driven Mobile App

**Input**: Design documents from `/specs/007-mvp-intent-driven/`
**Prerequisites**: plan.md (complete), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & Infrastructure
- [x] T001 Create domain directories for intent, supervisor, and crew in src/domains/
- [x] T002 Set up database migrations for new tables (ai_interaction_logs, intent_classifications, offline_sync_queue) with tenant_id column using Supabase RPC method
- [x] T003 [P] Configure PWA manifest and service worker in public/ directory
- [x] T004 [P] Set up offline storage utilities using IndexedDB in src/lib/offline/
- [x] T005 [P] Create camera capture component with 1fps throttling in src/components/camera/
- [x] T006 [P] Create voice interaction components (STT/TTS) in src/components/voice/
- [x] T007 Update environment variables for VLM API keys in .env.example

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Contract Tests
- [x] T008 [P] Contract test POST /api/intent/classify in tests/domains/intent/api/test_classify_contract.test.ts
- [x] T009 [P] Contract test POST /api/intent/feedback in tests/domains/intent/api/test_feedback_contract.test.ts
- [x] T010 [P] Contract test POST /api/supervisor/inventory/add in tests/domains/supervisor/api/test_inventory_add_contract.test.ts
- [x] T011 [P] Contract test POST /api/supervisor/jobs/create in tests/domains/supervisor/api/test_jobs_create_contract.test.ts
- [x] T012 [P] Contract test POST /api/supervisor/jobs/{jobId}/assign in tests/domains/supervisor/api/test_jobs_assign_contract.test.ts
- [x] T013 [P] Contract test GET /api/supervisor/dashboard/status in tests/domains/supervisor/api/test_dashboard_status_contract.test.ts
- [x] T014 [P] Contract test POST /api/supervisor/voice/command in tests/domains/supervisor/api/test_voice_command_contract.test.ts
- [x] T015 [P] Contract test GET /api/crew/jobs in tests/domains/crew/api/test_jobs_get_contract.test.ts
- [x] T016 [P] Contract test POST /api/crew/jobs/{jobId}/start in tests/domains/crew/api/test_jobs_start_contract.test.ts
- [x] T017 [P] Contract test POST /api/crew/jobs/{jobId}/load-verify in tests/domains/crew/api/test_load_verify_contract.test.ts
- [x] T018 [P] Contract test POST /api/crew/maintenance/report in tests/domains/crew/api/test_maintenance_report_contract.test.ts
- [x] T019 [P] Contract test POST /api/crew/voice/command in tests/domains/crew/api/test_crew_voice_command_contract.test.ts

### Integration Tests
- [x] T020 [P] Integration test: Supervisor adds inventory through camera in tests/e2e/supervisor-inventory-flow.test.ts
- [x] T021 [P] Integration test: Crew member verifies job load in tests/e2e/crew-load-verification-flow.test.ts
- [x] T022 [P] Integration test: Voice-driven job creation in tests/e2e/voice-job-creation-flow.test.ts
- [x] T023 [P] Integration test: Offline mode sync in tests/e2e/offline-sync-flow.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models & Repositories
- [x] T024 [P] Create AIInteractionLog model and repository in src/domains/intent/repositories/ai-interaction-log.repository.ts
- [x] T025 [P] Create IntentClassification model and repository in src/domains/intent/repositories/intent-classification.repository.ts
- [x] T026 [P] Create OfflineSyncQueue model and repository in src/domains/intent/repositories/offline-sync-queue.repository.ts
- [x] T027 Extend jobs table with new columns via migration in supabase/migrations/

### Services Layer
- [x] T028 [P] Intent classification service using existing VLM in src/domains/intent/services/intent-classification.service.ts
- [x] T029 [P] AI interaction logging service in src/domains/intent/services/ai-interaction-logger.service.ts
- [x] T030 [P] Offline sync service with retry logic in src/domains/intent/services/offline-sync.service.ts
- [x] T031 [P] Supervisor workflow service in src/domains/supervisor/services/supervisor-workflow.service.ts
- [x] T032 [P] Crew workflow service in src/domains/crew/services/crew-workflow.service.ts
- [x] T033 [P] Voice command processor service in src/domains/intent/services/voice-command.service.ts

### API Endpoints
- [x] T034 POST /api/intent/classify endpoint in src/app/api/intent/classify/route.ts
- [x] T035 POST /api/intent/feedback endpoint in src/app/api/intent/feedback/route.ts
- [x] T036 POST /api/supervisor/inventory/add endpoint in src/app/api/supervisor/inventory/add/route.ts
- [x] T037 POST /api/supervisor/jobs/create endpoint in src/app/api/supervisor/jobs/create/route.ts
- [x] T038 POST /api/supervisor/jobs/[jobId]/assign endpoint in src/app/api/supervisor/jobs/[jobId]/assign/route.ts
- [x] T039 GET /api/supervisor/dashboard/status endpoint in src/app/api/supervisor/dashboard/status/route.ts
- [x] T040 POST /api/supervisor/voice/command endpoint in src/app/api/supervisor/voice/command/route.ts
- [x] T041 GET /api/crew/jobs endpoint in src/app/api/crew/jobs/route.ts
- [x] T042 POST /api/crew/jobs/[jobId]/start endpoint in src/app/api/crew/jobs/[jobId]/start/route.ts
- [x] T043 POST /api/crew/jobs/[jobId]/load-verify endpoint in src/app/api/crew/jobs/[jobId]/load-verify/route.ts
- [x] T044 POST /api/crew/maintenance/report endpoint in src/app/api/crew/maintenance/report/route.ts
- [x] T045 POST /api/crew/voice/command endpoint in src/app/api/crew/voice/command/route.ts

### UI Components & Pages
- [ ] T046 [P] Camera capture component with intent display in src/components/camera/CameraCapture.tsx
- [ ] T047 [P] Voice command button component in src/components/voice/VoiceCommandButton.tsx
- [ ] T048 [P] Job card component with 512x512 thumbnails in src/components/ui/JobCard.tsx
- [ ] T049 [P] Item checklist component for load verification in src/components/ui/ItemChecklist.tsx
- [ ] T049a [P] Create ButtonLimiter component to enforce max 4 buttons per screen in src/components/ui/ButtonLimiter.tsx
- [ ] T050 Login page with role detection in src/app/(auth)/sign-in/page.tsx
- [ ] T051 Supervisor dashboard page in src/app/supervisor/page.tsx
- [ ] T052 Supervisor inventory management page in src/app/supervisor/inventory/page.tsx
- [ ] T053 Supervisor job creation page in src/app/supervisor/jobs/create/page.tsx
- [ ] T054 Crew dashboard page in src/app/crew/page.tsx
- [ ] T055 Crew job detail page in src/app/crew/jobs/[jobId]/page.tsx
- [ ] T056 Crew load verification page in src/app/crew/jobs/[jobId]/verify/page.tsx
- [ ] T056a Super Admin role management UI page in src/app/admin/users/page.tsx

## Phase 3.4: Integration & Middleware
- [ ] T057 Role-based middleware for supervisor/crew routes in src/middleware.ts
- [ ] T058 Offline detection and queue management in service worker
- [ ] T059 Background sync handler for offline operations
- [ ] T060 Rate limiting for AI/VLM API calls
- [ ] T061 Cost tracking integration with existing vision domain
- [ ] T062 Real-time updates using Supabase subscriptions

## Phase 3.5: Polish & Validation
- [ ] T063 [P] Unit tests for intent classification service in tests/domains/intent/services/intent-classification.test.ts
- [ ] T064 [P] Unit tests for offline sync service in tests/domains/intent/services/offline-sync.test.ts
- [ ] T065 [P] Performance tests: Intent recognition <3s in tests/performance/intent-speed.test.ts
- [ ] T066 [P] Performance tests: Page loads <2s in tests/performance/page-loads.test.ts
- [ ] T067 Update CLAUDE.md with new MVP feature documentation
- [ ] T068 Create seed data script for demo users and jobs in scripts/seed-mvp-demo.ts
- [ ] T069 Validate all quickstart scenarios pass
- [ ] T070 Security audit: RLS policies on new tables
- [ ] T071 Create RLS policies for ai_interaction_logs table with tenant isolation
- [ ] T072 Create RLS policies for intent_classifications table with tenant isolation
- [ ] T073 Create RLS policies for offline_sync_queue table with tenant isolation
- [ ] T074 Create RLS isolation tests for all new tables in tests/security/
- [ ] T075 Create agent directive blocks for all new TypeScript files in src/ directories per constitution requirements
- [ ] T076 Implement VLM budget enforcement with $0.10/request limit per constitution in src/domains/intent/lib/budget-enforcer.ts

## Dependencies
- Setup (T001-T007) must complete first
- All tests (T008-T023) before any implementation
- Models (T024-T027) before services (T028-T033)
- Services before endpoints (T034-T045)
- Endpoints before UI (T046-T056)
- Core complete before integration (T057-T062)
- Everything complete before polish (T063-T070)

## Parallel Execution Examples
```bash
# Phase 3.1 - Setup tasks that can run in parallel:
Task: "Configure PWA manifest and service worker in public/ directory"
Task: "Set up offline storage utilities using IndexedDB in src/lib/offline/"
Task: "Create camera capture component with 1fps throttling in src/components/camera/"
Task: "Create voice interaction components (STT/TTS) in src/components/voice/"

# Phase 3.2 - All contract tests can run in parallel:
Task: "Contract test POST /api/intent/classify in tests/domains/intent/api/test_classify_contract.test.ts"
Task: "Contract test POST /api/intent/feedback in tests/domains/intent/api/test_feedback_contract.test.ts"
Task: "Contract test POST /api/supervisor/inventory/add in tests/domains/supervisor/api/test_inventory_add_contract.test.ts"
# ... (all other contract tests)

# Phase 3.3 - Models and services in parallel:
Task: "Create AIInteractionLog model and repository in src/domains/intent/repositories/ai-interaction-log.repository.ts"
Task: "Create IntentClassification model and repository in src/domains/intent/repositories/intent-classification.repository.ts"
Task: "Intent classification service using existing VLM in src/domains/intent/services/intent-classification.service.ts"
```

## Notes
- Leverage existing vision domain for VLM operations
- Reuse existing auth, job, and equipment domains
- Camera capture must throttle to 1fps for performance
- All AI interactions must be logged with cost tracking
- Offline sync queue has 3 retry limit before expiring
- Voice commands use Web Speech API with server fallback
- Maximum 4 buttons per screen enforced in UI components

## Validation Checklist
- [x] All 3 contracts have corresponding test tasks
- [x] All 3 new entities have model/repository tasks
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] tasks modify the same file
- [x] All API endpoints from contracts are implemented
- [x] Quickstart scenarios have integration tests