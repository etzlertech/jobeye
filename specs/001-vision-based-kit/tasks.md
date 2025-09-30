# Tasks: Vision-Based Kit Verification

**Input**: Design documents from `/specs/001-vision-based-kit/`
**Prerequisites**: plan.md ✓, spec.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.x, Next.js 14, Supabase, YOLO.js, ONNX Runtime Web
   → Structure: Web application (src/domains/, app/api/, components/)
2. Load design documents ✓
   → Data model: 4 new tables, 1 modified table
   → API contracts: 2 endpoints (POST /api/vision/verify, GET /api/vision/history)
   → Test scenarios: 6 integration tests, 7 contract tests
3. Generate tasks by category ✓
4. Apply task rules ✓
5. Number tasks sequentially ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
9. Return: SUCCESS (50 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Database: `supabase/migrations/`
- Backend services: `src/domains/vision/`
- Components: `src/components/vision/`
- Tests: `__tests__/domains/vision/`
- Edge Functions: `supabase/functions/`
- Models: `public/models/`

## Phase 3.1: Setup & Infrastructure
- [ ] T001 Create vision domain directory structure at src/domains/vision/ (lib, services, repositories subdirectories)
- [ ] T002 Install dependencies: npm install yolojs onnxruntime-web @tensorflow/tfjs openai
- [ ] T003 Create public/models/ directory for YOLO model storage
- [ ] T004 Configure TypeScript paths for @/domains/vision imports in tsconfig.json
- [ ] T005 Create vision types file at src/domains/vision/lib/vision-types.ts with base interfaces

## Phase 3.2: Database Schema & Migrations
- [ ] T006 **MANDATORY**: Run `npm run check:db-actual` and document actual database state before writing any SQL
- [ ] T007 Create database migration at supabase/migrations/040_vision_verification_schema.sql with vision_verification_records table
- [ ] T008 Add detected_items table to migration 040_vision_verification_schema.sql
- [ ] T009 Add vision_cost_records table to migration 040_vision_verification_schema.sql
- [ ] T010 Add detection_confidence_thresholds table to migration 040_vision_verification_schema.sql
- [ ] T011 Add index to job_kits table: CREATE INDEX IF NOT EXISTS idx_job_kits_verification ON job_kits(verification_method, verified_at)
- [ ] T012 Create RLS policies migration at supabase/migrations/041_vision_rls_policies.sql for all vision tables
- [ ] T013 Run migration: supabase db push
- [ ] T014 Generate TypeScript types: npm run generate:types
- [ ] T015 Seed detection thresholds: create supabase/migrations/042_vision_seed_data.sql with default 70% threshold, $10/day budget

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written first and MUST FAIL before ANY implementation**
**VERIFY: Run all tests and confirm they fail with "Cannot find module" or similar errors**

### Contract Tests
- [ ] T016 [P] Contract test POST /api/vision/verify success case in __tests__/domains/vision/contract/vision-verify-post.test.ts
- [ ] T017 [P] Contract test POST /api/vision/verify budget exceeded in __tests__/domains/vision/contract/vision-verify-budget.test.ts
- [ ] T018 [P] Contract test GET /api/vision/history with filters in __tests__/domains/vision/contract/vision-history-get.test.ts
- [ ] T019 [P] Contract test GET /api/vision/queue (offline sync) in __tests__/domains/vision/contract/vision-queue-get.test.ts

### Integration Tests
- [ ] T020 [P] Integration test: Complete verification flow with YOLO local detection in __tests__/domains/vision/integration/vision-verification-flow.test.ts
- [ ] T021 [P] Integration test: Low confidence triggers VLM fallback in __tests__/domains/vision/integration/vlm-fallback-flow.test.ts
- [ ] T022 [P] Integration test: Offline queue and sync in __tests__/domains/vision/integration/offline-queue-sync.test.ts
- [ ] T023 [P] RLS test: Cross-tenant isolation in __tests__/domains/vision/integration/rls-isolation.test.ts

### Performance Tests
- [ ] T024 [P] Performance test: YOLO inference latency <3s in __tests__/domains/vision/performance/yolo-latency.bench.ts
- [ ] T025 [P] Performance test: Frame rate stability at 1 fps in __tests__/domains/vision/performance/frame-rate.bench.ts

## Phase 3.4: Core Implementation (ONLY after tests are failing)

### YOLO Integration (Sequential - Model dependencies)
- [ ] T026 Download YOLOv11n ONNX model to public/models/yolov11n.onnx (https://github.com/ultralytics/assets/releases/)
- [ ] T027 Implement YOLO model loader with IndexedDB caching in src/domains/vision/lib/yolo-loader.ts
- [ ] T028 Implement YOLO inference engine with 3s timeout in src/domains/vision/lib/yolo-inference.ts
- [ ] T029 Implement FPS throttle controller (1 fps) in src/domains/vision/lib/fps-throttle-controller.ts
- [ ] T030 Write unit test for YOLO loader in __tests__/domains/vision/unit/yolo-loader.test.ts
- [ ] T031 Write unit test for YOLO inference in __tests__/domains/vision/unit/yolo-inference.test.ts
- [ ] T032 Validate YOLO model accuracy on test equipment images (create test/fixtures/equipment/ with sample images)

### VLM Fallback (Depends on YOLO)
- [ ] T033 Implement VLM fallback router (70% threshold) in src/domains/vision/lib/vlm-fallback-router.ts
- [ ] T034 Implement OpenAI GPT-4 Vision adapter in src/domains/vision/lib/openai-vision-adapter.ts
- [ ] T035 Implement cost estimation logic ($0.10/request) in src/domains/vision/lib/cost-estimator.ts
- [ ] T036 Write unit test for VLM router in __tests__/domains/vision/unit/vlm-router.test.ts
- [ ] T037 Write integration test for VLM fallback in __tests__/domains/vision/integration/vlm-fallback.test.ts

### Repository Layer (Parallel - Different files)
- [ ] T038 [P] Implement vision-verification.repository.ts with CRUD operations at src/domains/vision/repositories/vision-verification.repository.ts
- [ ] T039 [P] Implement detected-item.repository.ts at src/domains/vision/repositories/detected-item.repository.ts
- [ ] T040 [P] Implement cost-record.repository.ts at src/domains/vision/repositories/cost-record.repository.ts
- [ ] T041 [P] Write unit tests for vision-verification repository in __tests__/domains/vision/unit/vision-verification-repository.test.ts
- [ ] T042 [P] Write unit tests for detected-item repository in __tests__/domains/vision/unit/detected-item-repository.test.ts
- [ ] T043 [P] Write unit tests for cost-record repository in __tests__/domains/vision/unit/cost-record-repository.test.ts

### Service Layer (Depends on repos + YOLO + VLM)
- [ ] T044 Implement vision-verification.service.ts (orchestration) at src/domains/vision/services/vision-verification.service.ts
- [ ] T045 Implement detection-confidence.service.ts (threshold mgmt) at src/domains/vision/services/detection-confidence.service.ts
- [ ] T046 Implement cost-tracking.service.ts (budget enforcement) at src/domains/vision/services/cost-tracking.service.ts
- [ ] T047 Implement offline-vision-queue.service.ts (50-photo queue) at src/domains/vision/services/offline-vision-queue.service.ts
- [ ] T048 Implement container-detector.ts (boundary detection) at src/domains/vision/lib/container-detector.ts
- [ ] T049 Write service unit tests (≥80% coverage) in __tests__/domains/vision/unit/services/
- [ ] T050 Write offline queue integration tests in __tests__/domains/vision/integration/offline-queue.test.ts
- [ ] T051 Write cost budget enforcement tests in __tests__/domains/vision/integration/cost-budget.test.ts

### Feature 003 Integration
- [ ] T052 Implement kit-verification-integration.service.ts at src/scheduling/services/kit-verification-integration.service.ts
- [ ] T053 Add updateVerificationMethod method to update job_kits.verification_method to 'photo' on success
- [ ] T054 Add triggerIncompleteKitNotification method to trigger Feature 003 notifications for incomplete kits
- [ ] T055 Write integration test for kit verification integration in __tests__/scheduling/integration/kit-verification.test.ts

## Phase 3.5: API & UI

### API Routes (Depends on services + repos)
- [ ] T056 Implement POST /api/vision/verify route at app/api/vision/verify/route.ts with multipart photo upload
- [ ] T057 Implement GET /api/vision/history route at app/api/vision/history/route.ts with query filters
- [ ] T058 Implement GET /api/vision/queue route at app/api/vision/queue/route.ts for offline sync status
- [ ] T059 Create Supabase Edge Function vlm-fallback at supabase/functions/vlm-fallback/index.ts
- [ ] T060 Deploy edge function: supabase functions deploy vlm-fallback

### UI Components (Parallel - Different React files)
- [ ] T061 [P] Implement CameraCapture.tsx (1 fps interface) at src/components/vision/CameraCapture.tsx
- [ ] T062 [P] Implement VerificationResults.tsx (visual feedback) at src/components/vision/VerificationResults.tsx
- [ ] T063 [P] Implement CostEstimatePrompt.tsx (VLM approval) at src/components/vision/CostEstimatePrompt.tsx
- [ ] T064 [P] Implement OfflineQueueIndicator.tsx (sync status) at src/components/vision/OfflineQueueIndicator.tsx
- [ ] T065 Create /verify-kit page at app/verify-kit/page.tsx integrating all vision components
- [ ] T066 [P] Write component tests for CameraCapture in __tests__/components/vision/CameraCapture.test.tsx
- [ ] T067 [P] Write component tests for VerificationResults in __tests__/components/vision/VerificationResults.test.tsx

## Phase 3.6: E2E Testing & Validation
- [ ] T068 Write E2E test: complete verification flow in __tests__/e2e/vision/kit-verification-flow.spec.ts
- [ ] T069 Write E2E test: offline mode verification + sync in __tests__/e2e/vision/offline-verification.spec.ts
- [ ] T070 Write E2E test: VLM fallback approval flow in __tests__/e2e/vision/vlm-fallback-approval.spec.ts
- [ ] T071 Create quickstart.md validation script at specs/001-vision-based-kit/quickstart.md
- [ ] T072 Run quickstart.md validation workflow manually
- [ ] T073 Performance validation: measure battery impact during 1-hour session
- [ ] T074 Validate all contract tests pass with actual API responses
- [ ] T075 Validate RLS isolation - no cross-tenant data leaks
- [ ] T076 Validate cost tracking - verify $10/day budget enforcement
- [ ] T077 Validate offline queue - confirm 50-photo capacity and sync
- [ ] T078 Validate YOLO performance - confirm <3s processing on mid-range devices

## Phase 3.7: Documentation & Polish
- [ ] T079 [P] Update CLAUDE.md with vision feature context using `.specify/scripts/bash/update-agent-context.sh claude`
- [ ] T080 [P] Create README.md at src/domains/vision/README.md documenting YOLO setup and usage
- [ ] T081 [P] Document API endpoints in docs/api/vision.md with request/response examples
- [ ] T082 Add JSDoc comments to all public functions in vision domain
- [ ] T083 Run final type check: npm run type-check
- [ ] T084 Run final test suite: npm run test
- [ ] T085 Verify test coverage ≥80%: npm run test:coverage

## Dependencies

**Critical Path**:
1. Database (T006-T015) must complete first - foundation for everything
2. Tests (T016-T025) must be written and FAILING before implementation starts
3. YOLO (T026-T032) before VLM (T033-T037) - core before fallback
4. Repositories (T038-T043) before Services (T044-T051)
5. Services before API Routes (T056-T060)
6. API Routes before UI Components (T061-T067)
7. E2E Tests (T068-T078) last - full stack validation

**Blocking Relationships**:
- T006 (DB precheck) blocks T007-T015 (all migrations)
- T013 (run migration) blocks T014 (generate types)
- T014 (types) blocks T016-T025 (all tests need types)
- T027 (YOLO loader) blocks T028 (inference) blocks T033 (VLM router)
- T038-T040 (repos) block T044-T047 (services use repos)
- T044 (verification service) blocks T052 (integration service) blocks T056 (API route)
- T056-T058 (API routes) block T061-T065 (UI components call APIs)
- T065 (page) blocks T068-T070 (E2E tests need page)

## Parallel Execution Examples

### Initial Setup (3 parallel tasks)
```bash
# Launch T002-T004 together after T001 directory creation:
Task: "Install dependencies: npm install yolojs onnxruntime-web @tensorflow/tfjs openai"
Task: "Create public/models/ directory for YOLO model storage"
Task: "Configure TypeScript paths for @/domains/vision imports in tsconfig.json"
```

### Contract Tests (4 parallel tasks)
```bash
# Launch T016-T019 together after database setup:
Task: "Contract test POST /api/vision/verify success case in __tests__/domains/vision/contract/vision-verify-post.test.ts"
Task: "Contract test POST /api/vision/verify budget exceeded in __tests__/domains/vision/contract/vision-verify-budget.test.ts"
Task: "Contract test GET /api/vision/history with filters in __tests__/domains/vision/contract/vision-history-get.test.ts"
Task: "Contract test GET /api/vision/queue (offline sync) in __tests__/domains/vision/contract/vision-queue-get.test.ts"
```

### Integration Tests (6 parallel tasks)
```bash
# Launch T020-T025 together after contract tests:
Task: "Integration test: Complete verification flow with YOLO local detection in __tests__/domains/vision/integration/vision-verification-flow.test.ts"
Task: "Integration test: Low confidence triggers VLM fallback in __tests__/domains/vision/integration/vlm-fallback-flow.test.ts"
Task: "Integration test: Offline queue and sync in __tests__/domains/vision/integration/offline-queue-sync.test.ts"
Task: "RLS test: Cross-tenant isolation in __tests__/domains/vision/integration/rls-isolation.test.ts"
Task: "Performance test: YOLO inference latency <3s in __tests__/domains/vision/performance/yolo-latency.bench.ts"
Task: "Performance test: Frame rate stability at 1 fps in __tests__/domains/vision/performance/frame-rate.bench.ts"
```

### Repository Layer (6 parallel tasks)
```bash
# Launch T038-T043 together after YOLO/VLM implementation:
Task: "Implement vision-verification.repository.ts with CRUD operations at src/domains/vision/repositories/vision-verification.repository.ts"
Task: "Implement detected-item.repository.ts at src/domains/vision/repositories/detected-item.repository.ts"
Task: "Implement cost-record.repository.ts at src/domains/vision/repositories/cost-record.repository.ts"
Task: "Write unit tests for vision-verification repository in __tests__/domains/vision/unit/vision-verification-repository.test.ts"
Task: "Write unit tests for detected-item repository in __tests__/domains/vision/unit/detected-item-repository.test.ts"
Task: "Write unit tests for cost-record repository in __tests__/domains/vision/unit/cost-record-repository.test.ts"
```

### UI Components (5 parallel tasks)
```bash
# Launch T061-T064 together after API routes complete:
Task: "Implement CameraCapture.tsx (1 fps interface) at src/components/vision/CameraCapture.tsx"
Task: "Implement VerificationResults.tsx (visual feedback) at src/components/vision/VerificationResults.tsx"
Task: "Implement CostEstimatePrompt.tsx (VLM approval) at src/components/vision/CostEstimatePrompt.tsx"
Task: "Implement OfflineQueueIndicator.tsx (sync status) at src/components/vision/OfflineQueueIndicator.tsx"
```

### Documentation (4 parallel tasks)
```bash
# Launch T079-T081 together at the end:
Task: "Update CLAUDE.md with vision feature context using `.specify/scripts/bash/update-agent-context.sh claude`"
Task: "Create README.md at src/domains/vision/README.md documenting YOLO setup and usage"
Task: "Document API endpoints in docs/api/vision.md with request/response examples"
```

## Notes
- All files must include AGENT DIRECTIVE BLOCKS per JobEye constitution
- Respect 300 LoC complexity budget (500 max with justification)
- **CRITICAL**: T006 (npm run check:db-actual) is MANDATORY per Constitution §8 RULE 1
- Test RLS policies thoroughly for multi-tenant isolation
- Implement offline-first from the start, not as afterthought
- Every VLM call must log estimated cost for budget tracking
- YOLO model must be cached in IndexedDB, not re-downloaded
- Frame rate controller must maintain 1 fps ±0.1 fps tolerance

## Validation Checklist
- [x] All contracts have corresponding tests (4 contract tests)
- [x] All entities have repository tasks (3 repositories)
- [x] All tests come before implementation (T016-T025 before T026+)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Database precheck task (T006) included per constitution
- [x] TDD sequence enforced (tests fail → implement → tests pass)
- [x] ≥80% test coverage target specified (T049, T085)