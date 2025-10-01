# Tasks: Mobile PWA Vision UI

**Input**: Design documents from `/specs/006-mobile-pwa-ui/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript, React 18, Next.js 14
   → Structure: src/app/mobile/equipment-verification/
2. Load design documents ✓
   → data-model.md: VerificationSession, CameraPermissions (UI state only)
   → contracts/: verification-workflow-api.yaml (reuses Feature 001 endpoints)
   → research.md: MediaDevices API, Web Workers, IndexedDB queue
3. Generate tasks by category:
   → Setup: Directory structure, dependencies, Web Worker
   → Tests: Camera workflow, offline queue, detection, manual fallback
   → Core: Components, hooks, service orchestration
   → Integration: Extend offline queue with 200-limit FIFO
   → Polish: E2E tests, performance validation, documentation
4. Apply task rules:
   → Different components = mark [P] for parallel
   → Hooks depend on services (sequential)
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T030)
6. Validation: All UI workflows testable, reuses existing services ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js App Router structure
- **New code**: `src/app/mobile/equipment-verification/`
- **Extended code**: `src/domains/mobile-pwa/repositories/offline-queue.repository.ts`
- **Reused services**: `src/domains/vision/services/` (no changes)

---

## Phase 3.1: Setup & Infrastructure

- [x] **T000** 🚨 MANDATORY: Database precheck - verify Feature 001/007 schema exists
  - Run `npx tsx scripts/check-actual-db.ts` from repo root
  - Verify tables exist with correct schema:
    - `vision_verification_records` (Feature 001)
    - `detected_items` (Feature 001)
    - `vision_cost_records` (Feature 001)
    - `offline_queue` (Feature 007 - IndexedDB, check via browser)
  - Verify RLS policies use `app_metadata.company_id` pattern (not `auth.jwt()`)
  - Document findings in `database-precheck-report.md`
  - **Constitution Rule 1 Compliance**: This task MUST pass before any implementation
  - **Expected Output**: Report showing all 3 Supabase tables exist, have RLS enabled, and policies match expected pattern

- [x] **T001** Create mobile PWA directory structure at `src/app/mobile/equipment-verification/`
  - Create directories: `components/`, `hooks/`, `services/`, `__tests__/`, `__tests__/e2e/`
  - Create placeholder `page.tsx` with basic route handler

- [x] **T002** Install Web Worker dependencies
  - Add `worker-loader` or Next.js worker support configuration
  - Verify TypeScript worker types available

- [x] **T003** [P] Create Web Worker for YOLO detection at `src/app/mobile/equipment-verification/workers/yolo-detection.worker.ts`
  - Import `YOLOInferenceService` from `@/domains/vision/services/yolo-inference.service`
  - Handle `DETECT` message type
  - Post detection results back to main thread
  - Handle errors and timeouts

- [x] **T004** [P] Configure TypeScript for Web Worker imports
  - Update `tsconfig.json` to include worker files
  - Add worker type declarations if needed

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Verify Feature 001 endpoints work)
- [x] **T005** [P] Contract test POST /api/vision/verify in `src/app/mobile/equipment-verification/__tests__/contracts/vision-verify.test.ts`
  - Test multipart form upload (photo + job_id)
  - Assert 201 response with VerificationRecord schema
  - Assert 400 on missing photo
  - Assert 507 on queue full (simulated)

- [x] **T006** [P] Contract test POST /api/vision/detect in `src/app/mobile/equipment-verification/__tests__/contracts/vision-detect.test.ts`
  - Test base64 image_data + expected_items payload
  - Assert 200 response with DetectionResult schema
  - Assert confidence_score, detected_items, should_fallback fields
  - Assert 429 on rate limit (>1fps)

- [x] **T007** [P] Contract test POST /api/vision/vlm-fallback in `src/app/mobile/equipment-verification/__tests__/contracts/vision-vlm-fallback.test.ts`
  - Test base64 image_data + expected_items payload
  - Assert 200 response with DetectionResult schema
  - Assert VLM detection method in detected_items
  - Assert 503 on VLM service unavailable

### Integration Tests (Workflow scenarios)
- [x] **T008** [P] Camera permissions integration test in `src/app/mobile/equipment-verification/__tests__/camera-permissions.test.tsx`
  - Mock `navigator.mediaDevices.getUserMedia`
  - Test granted flow: should return MediaStream
  - Test denied flow: should return error and trigger manual mode
  - Test hardware unavailable: should fallback gracefully

- [x] **T009** [P] YOLO detection workflow test in `src/app/mobile/equipment-verification/__tests__/detection-workflow.test.tsx`
  - Mock Web Worker and YOLO service responses
  - Test 1fps throttle timing (verify frames processed every ~1000ms)
  - Test high confidence (>70%): should mark item verified
  - Test low confidence (<70%): should trigger VLM fallback
  - Test 3 retries: should trigger VLM fallback after 3rd retry

- [x] **T010** [P] Offline queue test in `src/app/mobile/equipment-verification/__tests__/offline-queue.test.tsx`
  - Mock IndexedDB using `fake-indexeddb`
  - Test enqueue when offline: record added to queue
  - Test 200-record limit: oldest evicted when 201st added (FIFO)
  - Test sync when online: records POST to /api/vision/verify
  - Test sync failure: retry count incremented, max 3 retries

- [x] **T011** [P] Manual fallback workflow test in `src/app/mobile/equipment-verification/__tests__/manual-fallback.test.tsx`
  - Test manual checklist interaction (camera-denied flow already tested in T008)
  - Test tap to verify: item verified state toggles
  - Test all verified: completion button enables
  - Test save without photo: POST to /api/vision/verify with photo_url=null

- [x] **T012** [P] Partial detection test in `src/app/mobile/equipment-verification/__tests__/partial-detection.test.tsx`
  - Mock detection result with bounding box at frame edge
  - Test edge detection: should display "Reposition camera" prompt
  - Test full item in frame: no prompt shown
  - Test repositioning: prompt clears when item fully visible

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Repository Extension (Sequential - modifies existing file)
- [x] **T013** Extend offline queue repository with 200-limit FIFO eviction in `src/domains/mobile-pwa/repositories/offline-queue.repository.ts`
  - Add `MAX_QUEUE_SIZE = 200` constant
  - Modify `enqueue()` method: check count before insert
  - If count >= 200: call `getOldestId()` and delete before insert
  - Add `getOldestId()` private method: query by `created_at ASC LIMIT 1`
  - Log warning when eviction occurs

### Services (Sequential - orchestration layer)
- [x] **T014** Create verification workflow service in `src/app/mobile/equipment-verification/services/verification-workflow.service.ts`
  - Import YOLO, VLM, offline queue, verification repository services
  - Method: `startVerification(jobId)` → fetch equipment checklist
  - Method: `processDetection(imageData)` → call YOLO or VLM based on confidence/retries
  - Method: `completeVerification(photo, detectedItems)` → save to Supabase or queue if offline
  - Handle VLM fallback logic: confidence <70% OR retry >=3
  - Track retry count in session state

### Hooks (Parallel where independent)
- [x] **T015** [P] Create camera permissions hook in `src/app/mobile/equipment-verification/hooks/useCameraPermissions.ts`
  - State: `status: 'prompt' | 'granted' | 'denied'`, `stream: MediaStream | null`, `error: string`
  - Method: `requestCamera()` → call `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }})`
  - On success: set status='granted', return stream
  - On error: set status='denied', return error
  - Cleanup: stop all tracks on unmount

- [x] **T016** Create YOLO detection hook in `src/app/mobile/equipment-verification/hooks/useYOLODetection.ts` (depends on T003 worker)
  - State: `detectionResults: DetectedItem[]`, `isProcessing: boolean`, `retryCount: number`
  - Ref: `workerRef: Worker`, `lastFrameTime: number`
  - Method: `startDetection(videoElement)` → initialize worker, start RAF (requestAnimationFrame) loop
  - Method: `processFrame()` → throttle to 1fps using `performance.now()` delta
  - Capture frame to ImageData, post to worker
  - On worker message: update `detectionResults`
  - Cleanup: terminate worker on unmount

- [x] **T017** [P] Create VLM fallback hook in `src/app/mobile/equipment-verification/hooks/useVLMFallback.ts`
  - State: `isFallbackActive: boolean`, `vlmResult: DetectionResult | null`
  - Method: `triggerVLMFallback(imageData, expectedItems)` → call VLMFallbackService
  - Handle loading state during cloud request
  - Return detection result or error

- [x] **T018** Create verification session hook in `src/app/mobile/equipment-verification/hooks/useVerificationSession.ts` (depends on T014 service)
  - State: `sessionId`, `jobId`, `checklist`, `mode: 'camera' | 'manual'`, `status: 'detecting' | 'processing' | 'complete' | 'failed'`
  - Method: `initSession(jobId)` → call `verificationWorkflowService.startVerification()`
  - Method: `updateChecklist(detectedItems)` → mark items as verified
  - Method: `completeSession(photo)` → call `verificationWorkflowService.completeVerification()`
  - Handle mode transitions: camera denied → manual

### Components (Parallel where independent)
- [x] **T019** [P] Create CameraFeed component in `src/app/mobile/equipment-verification/components/CameraFeed.tsx`
  - Accept props: `stream: MediaStream`, `onCapture: (photo: Blob) => void`
  - Render `<video>` element with stream as srcObject
  - Render capture button (enabled when stream active)
  - Render canvas (hidden, for photo capture)
  - Method: `capturePhoto()` → draw video frame to canvas, convert to blob, call onCapture
  - Display loading spinner while stream initializing

- [x] **T020** [P] Create DetectionOverlay component in `src/app/mobile/equipment-verification/components/DetectionOverlay.tsx`
  - Accept props: `detectedItems: DetectedItem[]`, `videoWidth: number`, `videoHeight: number`
  - Render SVG layer over video with bounding boxes
  - For each detected item: draw rect at bounding_box coordinates
  - Color code by confidence: green (>70%), yellow (50-70%), red (<50%)
  - Display item name label above bounding box
  - Helper: `isAtEdge(box)` → check if bounding box touches frame edge (within 50px margin)
  - Display "⚠️ Reposition camera" prompt if any item at edge

- [x] **T021** [P] Create EquipmentChecklist component in `src/app/mobile/equipment-verification/components/EquipmentChecklist.tsx`
  - Accept props: `checklist: EquipmentChecklist`, `detectedItems: DetectedItem[]`, `mode: 'camera' | 'manual'`
  - Render list of equipment items with icons
  - In camera mode: auto-check items when detected (confidence >70%)
  - In manual mode: allow tap to toggle verified state
  - Display count: "X of Y verified"
  - Display completion status: all verified → show checkmark icon

- [x] **T022** [P] Create ManualChecklistFallback component in `src/app/mobile/equipment-verification/components/ManualChecklistFallback.tsx`
  - Accept props: `checklist: EquipmentChecklist`, `onToggleItem: (itemId: string) => void`
  - Render tap-to-verify checklist (44x44px touch targets minimum)
  - Display icon + item name + checkbox
  - On tap: call `onToggleItem(itemId)`
  - Visual states: unverified (○), verified (✓)
  - Display instructions: "Tap each item to verify"

- [x] **T023** [P] Create OfflineQueueStatus component in `src/app/mobile/equipment-verification/components/OfflineQueueStatus.tsx`
  - Accept props: `queueCount: number`, `isOnline: boolean`
  - Display online/offline indicator icon
  - Display queue count: "X pending" (only show if count > 0)
  - Display warning if queue near capacity: count > 180 → "Queue nearly full (X/200)"
  - Display sync status: "Syncing..." when queue draining

### Main Page (Sequential - integrates all components/hooks)
- [x] **T024** Implement main equipment verification page in `src/app/mobile/equipment-verification/page.tsx`
  - Import all hooks: `useCameraPermissions`, `useYOLODetection`, `useVLMFallback`, `useVerificationSession`
  - Import all components: `CameraFeed`, `DetectionOverlay`, `EquipmentChecklist`, `ManualChecklistFallback`, `OfflineQueueStatus`
  - Extract `job_id` from URL params
  - Initialize session: `useVerificationSession(job_id)`
  - Request camera on mount: `useCameraPermissions.requestCamera()`
  - If camera granted: render `CameraFeed` + `DetectionOverlay` + `EquipmentChecklist`
  - If camera denied: render `ManualChecklistFallback`
  - Start YOLO detection when camera stream ready
  - Handle VLM fallback trigger: confidence <70% or retryCount >=3
  - Handle completion: "Complete Verification" button → capture photo → save
  - Display `OfflineQueueStatus` at top of page

---

## Phase 3.4: Integration & Edge Cases

- [x] **T025** Implement partial detection repositioning logic
  - In `DetectionOverlay.tsx`: check if bounding box at edge (margin 50px)
  - If at edge: display prompt "⚠️ Reposition camera to capture full item"
  - Do not auto-verify items with partial bounding boxes
  - Only mark verified when full item in frame

- [x] **T026** Implement retry and VLM fallback logic
  - In `useYOLODetection.ts`: track `retryCount` state
  - On detection timeout (>3s): increment `retryCount`, retry
  - If `retryCount >= 3`: trigger VLM fallback via `useVLMFallback.triggerVLMFallback()`
  - If confidence <70%: immediately trigger VLM fallback (no retries)
  - Reset `retryCount` on successful detection

- [x] **T027** Integrate offline queue with verification completion
  - In `verification-workflow.service.ts`: check `navigator.onLine` before save
  - If online: POST to `/api/vision/verify` directly
  - If offline: call `offlineQueueRepository.enqueue(record)`
  - Listen for online event: trigger `offlineSyncService.syncNow()`
  - Display sync status in UI via `OfflineQueueStatus` component

- [x] **T028** Add 30-day retention verification (Supabase pg_cron check)
  - Verify pg_cron job exists: query `SELECT * FROM cron.job WHERE jobname = 'delete-old-verifications'`
  - If not exists: create scheduled job via Supabase SQL editor (one-time setup)
  - SQL: `DELETE FROM vision_verification_records WHERE created_at < NOW() - INTERVAL '30 days'`
  - Schedule: `0 0 * * *` (daily at midnight)
  - Document in quickstart.md setup instructions

---

## Phase 3.5: Polish & Validation

- [ ] **T029** [P] E2E test complete verification workflow in `src/app/mobile/equipment-verification/__tests__/e2e/equipment-verification-flow.spec.ts`
  - Use Playwright with camera simulation
  - Test full flow: page load → camera start → detection → checklist update → completion → save
  - Assert verification record created in Supabase
  - Test offline flow: go offline → verify → check IndexedDB queue → go online → verify sync
  - Test manual fallback: deny camera → tap checklist → verify → save without photo

- [ ] **T030** [P] Performance validation tests (validates FR-021, FR-022, FR-023)
  - **FR-023**: Test camera start time <2s from page load to video display (assert <2000ms)
  - **FR-021**: Test YOLO inference <1s per frame (log `performance.now()` delta, assert <1000ms)
  - Test FPS throttle accuracy: verify 1fps ±0.1 (900-1100ms frame delta)
  - **FR-022**: Test full workflow <30s from start to completion (5-item checklist, assert <30000ms)
  - Test offline queue: verify 200-record limit, FIFO eviction timing
  - Document results with device specs in performance-benchmarks.md

- [x] **T031** [P] Update project documentation
  - Add Feature 006 to main README.md features list
  - Add mobile PWA quickstart to getting-started guide
  - Add camera permissions setup to deployment docs
  - Update CLAUDE.md with Feature 006 context (already done in planning phase)

- [ ] **T032** Run quickstart validation
  - Follow `specs/006-mobile-pwa-ui/quickstart.md` step-by-step
  - Verify all manual test checklist items pass
  - Test on physical mobile device (iOS Safari, Chrome Android)
  - Verify camera permissions prompt appears
  - Verify offline mode works (airplane mode test)
  - Document any issues or deviations

- [x] **T033** [P] Implement UI feedback states and indicators (FR-014, FR-018, FR-020)
  - Add offline/online status indicator to `OfflineQueueStatus` component (FR-014)
    - Online: Green wifi icon
    - Offline: Red wifi-off icon with "Offline" badge
  - Add success/failure animation states to main page (FR-018)
    - Success: Green checkmark with 300ms fade-in animation
    - Failure: Red X with 200ms shake animation
  - Implement haptic feedback via `navigator.vibrate(50)` on detection success (FR-020)
  - Implement audio beep via Web Audio API on verification complete (FR-020)
    - Frequency: 800Hz, Duration: <100ms, Volume: 50%
  - Add timing tests: assert animations <500ms, haptic 50ms, audio <100ms
  - Test browser compatibility: iOS Safari (haptic via vibrate), Chrome Android

---

## Dependencies

### Phase Dependencies
- **Phase 3.2** (Tests) blocks **Phase 3.3** (Implementation)
- **Phase 3.3** blocks **Phase 3.4** (Integration)
- **Phase 3.4** blocks **Phase 3.5** (Polish)

### Task Dependencies
- T003 (Web Worker) blocks T016 (YOLO detection hook)
- T014 (Workflow service) blocks T018 (Verification session hook)
- T015-T018 (Hooks) block T024 (Main page)
- T019-T023 (Components) block T024 (Main page)
- T005-T007 (Contract tests) verify Feature 001 endpoints exist
- T013 (Offline queue extension) blocks T027 (Offline integration)

### Parallel Execution Groups
- **Group 1 (Setup)**: T001, T002, T003, T004 - can run in parallel
- **Group 2 (Contract Tests)**: T005, T006, T007 - can run in parallel
- **Group 3 (Integration Tests)**: T008, T009, T010, T011, T012 - can run in parallel
- **Group 4 (Hooks)**: T015, T017 independent - can run in parallel (T016, T018 depend on earlier tasks)
- **Group 5 (Components)**: T019, T020, T021, T022, T023 - can run in parallel
- **Group 6 (Polish)**: T029, T030, T031 - can run in parallel

---

## Parallel Execution Examples

### Setup Phase (T001-T004)
```bash
# Launch all setup tasks in parallel
Task: "Create mobile PWA directory structure"
Task: "Install Web Worker dependencies"
Task: "Create Web Worker for YOLO detection"
Task: "Configure TypeScript for Web Worker imports"
```

### Contract Tests (T005-T007)
```bash
# Launch all contract tests in parallel
Task: "Contract test POST /api/vision/verify in src/app/mobile/equipment-verification/__tests__/contracts/vision-verify.test.ts"
Task: "Contract test POST /api/vision/detect in src/app/mobile/equipment-verification/__tests__/contracts/vision-detect.test.ts"
Task: "Contract test POST /api/vision/vlm-fallback in src/app/mobile/equipment-verification/__tests__/contracts/vision-vlm-fallback.test.ts"
```

### Integration Tests (T008-T012)
```bash
# Launch all integration tests in parallel
Task: "Camera permissions integration test in src/app/mobile/equipment-verification/__tests__/camera-permissions.test.tsx"
Task: "YOLO detection workflow test in src/app/mobile/equipment-verification/__tests__/detection-workflow.test.tsx"
Task: "Offline queue test in src/app/mobile/equipment-verification/__tests__/offline-queue.test.tsx"
Task: "Manual fallback workflow test in src/app/mobile/equipment-preparation/__tests__/manual-fallback.test.tsx"
Task: "Partial detection test in src/app/mobile/equipment-verification/__tests__/partial-detection.test.tsx"
```

### Components (T019-T023)
```bash
# Launch all component implementations in parallel
Task: "Create CameraFeed component in src/app/mobile/equipment-verification/components/CameraFeed.tsx"
Task: "Create DetectionOverlay component in src/app/mobile/equipment-verification/components/DetectionOverlay.tsx"
Task: "Create EquipmentChecklist component in src/app/mobile/equipment-verification/components/EquipmentChecklist.tsx"
Task: "Create ManualChecklistFallback component in src/app/mobile/equipment-verification/components/ManualChecklistFallback.tsx"
Task: "Create OfflineQueueStatus component in src/app/mobile/equipment-verification/components/OfflineQueueStatus.tsx"
```

---

## Notes

### Complexity Budgets
- Each component: 200 LOC max
- Each hook: 300 LOC max (400 for `useYOLODetection.ts` due to Web Worker setup)
- Workflow service: 500 LOC max
- Main page: 200 LOC (orchestration only, logic in hooks/services)

### Testing Strategy
- **Contract tests**: Verify Feature 001 endpoints work (no mocking)
- **Integration tests**: Mock browser APIs (MediaDevices, IndexedDB, Web Worker)
- **E2E tests**: Playwright with camera simulation
- **Coverage target**: >80% for new code

### Key Principles
- ✅ Reuse existing services (YOLO, VLM, offline queue, verification repository)
- ✅ Zero new backend code
- ✅ Pure UI integration layer
- ✅ Offline-first architecture
- ✅ Graceful degradation (camera → manual checklist)

### Avoid
- ❌ Creating new vision detection services
- ❌ Creating new backend APIs
- ❌ Creating new database tables
- ❌ Using `setInterval` for frame processing (use `requestAnimationFrame`)
- ❌ Hardcoding retry logic (use configuration from existing services)

---

## Validation Checklist
*GATE: Checked before marking tasks.md complete*

- [x] All contracts have corresponding tests (T005-T007)
- [x] All UI workflows have integration tests (T008-T012)
- [x] All tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Reuses existing services from Feature 001 and Feature 007
- [x] Extension tasks identified (T013 extends offline queue)
- [x] E2E tests cover complete user workflows (T029)
- [x] Performance validation included (T030)
- [x] Documentation updates included (T031)

---

**Total Tasks**: 34 (includes T000 database precheck + T033 UI feedback)
**Estimated Effort**: 3-4 days (1 developer)
**New Code**: ~2,500 LOC (UI layer + orchestration)
**Modified Code**: ~50 LOC (offline queue extension)

**Ready for Phase 3 Implementation** ✅ (after T000 database precheck passes)
