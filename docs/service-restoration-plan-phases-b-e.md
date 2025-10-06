<!--
@file docs/service-restoration-plan-phases-b-e.md
@created 2025-10-05
@created_by codex
@description Detailed recovery plan for Phases B-E service restorations
END AGENT DIRECTIVE BLOCK
-->

# Service Restoration Plan: Phases B-E

## Scope
This document elaborates the restoration roadmap for the remaining gutted service domains outside Field Intelligence:

- Intake: business-card-ocr.service.ts
- Safety: safety-verification.service.ts
- Time Tracking: time-tracking.service.ts
- Job Workflows: arrival-workflow.service.ts

Baseline reference remains commit 93c43a5, which captured the last known good implementations before cleanup stubbing.

## Shared Prerequisites
- Validate Husky/NPM path configuration so pre-commit scripts run on Windows machines (ensure npx.cmd and npm.cmd calls are available or adjust scripts accordingly).
- Capture current TypeScript and lint status via 'npm run quick-check'; record unrelated failures separately to avoid conflating them with restoration regressions.
- Confirm .env.local has Supabase credentials before running integration tests; never bypass RLS or service role constraints outside approved scripts.
- For every restored file, maintain the AGENT directive block and keep complexity under 300 LoC (document justification if temporarily over the limit).
- Use repositories that extend BaseRepository; no direct Supabase client calls from services.

## Phase B - Intake Domain (Business Card OCR)
- Objective: Restore the OCR pipeline that extracts contact data with Tesseract first and VLM fallback.
- Primary File: src/domains/intake/services/business-card-ocr.service.ts
- Support Artifacts: OCR utilities, DTO definitions, any repository or storage adapters removed during cleanup.

### Task Checklist
1. [x] Pull historical service code from commit 93c43a5 into a scratch location for comparison (baseline already stubbed; documented in plan).
2. [x] Recreate or verify dependencies including OCR utility helpers, storage adapters, and DTO definitions.
3. [x] Rebuild service logic on top of the current repository pattern (class-based, extends BaseRepository). Restore missing repositories separately.
4. [x] Reinstate voice-aware logging and error messaging that were stripped during stubbing.
5. [x] Restore unit tests at src/__tests__/intake/business-card-ocr.service.test.ts covering Tesseract only flow, VLM fallback, and failure handling.
6. [x] Add integration smoke test guarded by environment detection to ensure Supabase persistence respects RLS.
7. [x] Run targeted Jest tests plus npm run test:unit; log unrelated failures separately.
8. [x] Document completion in the master plan progress log with date, commit, and outstanding TODOs.

_Default wiring available via `createBusinessCardOcrService` (uses Tesseract + Gemini fallback). Callers should supply `tenantId` and `sessionId` when persistence is required._



## Phase C - Safety Domain (Safety Verification Service)
- Objective: Reinstate YOLO to VLM safety verification pipeline with audit logging.
- Primary File: src/domains/safety/services/safety-verification.service.ts
- Support Artifacts: Safety repositories, audit log repositories, YOLO and VLM configuration modules.

### Task Checklist
1. [x] Recover pre-cleanup implementation from commit 93c43a5 and diff against the stub (stub only; documented need for fresh implementation).
2. [x] Ensure supporting repositories exist (safety-verification.repository.ts added, leveraging vision verification tables).
3. [x] Re-enable YOLO inference stage with configuration toggles and hook VLM fallback while preserving cost tracking (cost persistence stubbed until repository restored).
4. [x] Reinforce Supabase audit logging through the repository layer with tenant-aware filters (SafetyVerificationRepository records to vision_verifications + detected items).
5. [x] Restore unit tests at src/__tests__/safety/safety-verification.service.test.ts covering YOLO success, VLM fallback, and failure handling.
6. [x] Optionally add integration smoke test to verify audit records persist correctly with mocked Supabase client.
7. [x] Note follow-up items for reconnecting live YOLO runtime if still disabled.
8. [x] Update progress documentation with results and open issues.

#### Configuration Notes (2025-10-05)
- Introduced `yolo-remote-client` helper that posts base64 payloads to a configurable endpoint; factory now prefers remote runtime when `SAFETY_YOLO_ENDPOINT` (or `VISION_YOLO_ENDPOINT`) is present, otherwise it falls back to the existing mock detector.
- `createSafetyVerificationService` accepts `yolo` options and forwards Supabase clients so audit records land in `vision_verifications` / `vision_detected_items`.
- New environment flags: `SAFETY_YOLO_ENDPOINT`, `SAFETY_YOLO_API_KEY`, `SAFETY_YOLO_MODEL`, `SAFETY_YOLO_TIMEOUT_MS` (with `VISION_YOLO_*` fallbacks) documented for deployment.
- Follow-ups: load-test remote endpoint latency (<1.5s target), add integration mocks for error handling, wire cost tracking once billing fields are exposed, and confirm VisionVerificationService remote mode runs in browsers that can supply `ImageData` → Blob conversions.

## Phase D - Time Tracking Domain (Time Tracking Service)
- Objective: Restore clock-in and clock-out logic with geofence checks, overlap prevention, and break enforcement.
- Primary File: src/domains/time-tracking/services/time-tracking.service.ts
- Support Artifacts: time-entry, shift, and related repositories plus location and geofencing helpers.

### Task Checklist
1. [x] Retrieve pre-cleanup service and analyze dependencies including location services, repositories, and DTOs (stub only; rebuilt using repository contract).
2. [x] Restore repository integration using current BaseRepository structure; create adapters if repositories are still missing.
3. [x] Reinstate geofence validation, wiring into restored routing and geofencing services from Phase A (factory provides default geofence stub).
4. [x] Reapply overlapping shift prevention and break enforcement logic; add explicit TODOs if upstream data remains stubbed.
5. [x] Restore unit tests at src/__tests__/time-tracking/time-tracking.service.test.ts covering clock-in, double clock-in prevention, and geofence violations.
6. [x] Add integration test (environment guarded) to ensure Supabase inserts and updates succeed under RLS (currently mocks repository; wire Supabase once available).
7. [x] Verify downstream API handlers or hooks compile against the restored service without behavioral regressions (field-intelligence `/api/time/clock` now uses the factory wiring).
8. [x] Record work in the progress log with commit hash and remaining follow-ups.

_Endpoints updated: `/api/field-intelligence/time/clock` now calls `createTimeTrackingService`; `/api/field-intelligence/workflows/arrivals` uses `createArrivalWorkflowService` (with safety verification enabled when `GOOGLE_API_KEY` is provided). Arrival GET remains informational until read repositories are restored._

## Phase E - Job Workflows Domain (Arrival Workflow)
- Objective: Rebuild orchestrated arrival workflow coordinating routing, time tracking, safety, and notifications.
- Primary File: src/domains/job-workflows/services/arrival-workflow.service.ts
- Support Artifacts: Workflow repositories, notification services, and shared DTOs.

### Task Checklist
1. [x] Recover historical implementation from commit 93c43a5 and map external service dependencies (stub only; rebuilt with factories).
2. [x] Update imports to point at restored services from Phases A, C, and D while maintaining dependency injection patterns.
3. [x] Reinstate multi-step flow including arrival detection, auto clock-in, photo verification, notification dispatch, and audit logging (notifications optional when client provided).
4. [x] Confirm workflow state persistence uses BaseRepository derivatives; restore missing repositories where needed (factory uses Supabase JobRepository when available, otherwise stubs).
5. [x] Restore unit tests at src/__tests__/job-workflows/arrival-workflow.service.test.ts covering success path and failure scenarios.
6. [x] Add high-level integration or e2e-style test (mocked downstream services) to validate orchestration and voice prompts.
7. [x] Update documentation with completion notes and outstanding gaps before UI work depends on it.

## Cross-Phase Deliverables
- Maintain the checklists in this document and mirror status updates in docs/service-restoration-plan.md to keep a single source of truth.
- Summarize new issues discovered (missing repositories, schema drift, configuration gaps) and create follow-up TODO markers or tickets.
- After each phase, run npm exec -- tsx scripts/ci/fast-pre-commit.ts; track unrelated failures on the master bug list.
- Once all phases are complete, prepare a consolidation summary for CLAUDE.md so future agents understand the restoration status.

## Tracking Table
| Phase | Primary Service File | Baseline Commit | Test Suites to Restore | Status | Notes |
|-------|----------------------|-----------------|------------------------|--------|-------|
| B | business-card-ocr.service.ts | 93c43a5 | Unit, integration smoke | In progress | Service + unit + integration tests restored; helper modules created; repository persistence available via optional context |
| C | safety-verification.service.ts | 93c43a5 | Unit, optional integration | In progress | Remote YOLO endpoint wiring added (SAFETY_YOLO_* env). Verify model latency + complete audit dashboards next |
| D | time-tracking.service.ts | 93c43a5 | Unit and integration | In progress | Service rebuilt with geofence/overlap logic; ensure handler wiring + Supabase integration next |
| E | arrival-workflow.service.ts | 93c43a5 | Unit and orchestration integration | In progress | Service restored with time-tracking/safety factories; ensure production clients supply Supabase + notifications |

Update the Status and Notes columns as work progresses to maintain a resilient hand-off trail.
