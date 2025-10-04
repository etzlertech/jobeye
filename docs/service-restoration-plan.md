<!--
@file docs/service-restoration-plan.md
@created 2025-10-05
@created_by codex
@description Recovery plan for gutted service layers across domains
END AGENT DIRECTIVE BLOCK
-->

# Service Restoration Master Plan

## 1. Situation Overview
- Root cause: Feature-009 cleanup replaced multiple service layers with placeholders to bypass missing repositories. Core business logic and Supabase integration were removed across Field Intelligence, Intake, Safety, Time Tracking, and Job Workflows domains.
- Goal: Reintroduce functional service code without discarding legitimate cleanup (class-based repositories, inventory consolidation, docs updates) already merged into main.
- Reference baseline: Commit 93c43a5 (feat 005: complete Phase 3 implementation - all components, services, APIs, and E2E tests). Use this as the source of truth when restoring logic.

## 2. Guiding Principles
1. Incremental restoration – Check out files from 93c43a5, adapt to the new repository pattern, and retain logging or TODO scaffolding where repository implementations are still missing.
2. Directive compliance – Ensure every restored file keeps the AGENT directive block and stays within the 300 LoC budget (justify if above 300).
3. TDD-first – Write or update unit and integration tests before finalizing each service restoration; confirm tests fail, then implement logic, and finally ensure npm exec -- tsx scripts/ci/fast-pre-commit.ts passes locally.
4. Repository abstraction – No direct Supabase calls from services; route through existing or newly recreated repositories extending BaseRepository.
5. Observability and voice context – Retain structured logging (voice-logger) and voice prompts that were present in the original implementation.
6. No regressions to cleanup – Preserve class-based repositories, unified inventory model, and doc updates introduced after 93c43a5.

## 3. Global Prerequisites
- [ ] Verify Husky hooks locally (adjust PATH or convert scripts to npx.cmd on Windows if needed) so pre-commit can run.
- [ ] Run npm run quick-check to capture baseline TypeScript and lint errors (note unrelated failures separately).
- [ ] Create scratch branch backups if needed, but all commits stay on main per workflow rules.
- [ ] Ensure .env.local has valid Supabase credentials for any integration tests touching the database (still guarded by RLS).

## 4. Restoration Phases and Tasks

### Phase A – Field Intelligence Services
Focus: restore analytics, routing, time, and workflow services; these feed dashboards and automations.

Status snapshot:
- Already rehydrated (with temporary helper stubs):
  - intake-duplicate-matching.service.ts
  - routing-analytics.service.ts
  - intake-conversions.service.ts
  - time-auto-clockout.service.ts
- Still gutted (needs full restoration):
  - intake-analytics.service.ts
  - intake-ocr.service.ts
  - routing-geofencing.service.ts
  - routing-gps-tracking.service.ts
  - routing-progress.service.ts
  - time-analytics.service.ts
  - time-approval.service.ts
  - time-timesheets.service.ts
  - workflows-analytics.service.ts
  - workflows-completion-verification.service.ts
  - workflows-instruction-search.service.ts
  - workflows-job-arrival.service.ts
  - workflows-task-parsing.service.ts

Execution loop for each service:
1. git checkout 93c43a5 -- <service file> into a scratch location for reference (do not overwrite yet).
2. Compare against current stub to identify removed logic, dependencies, and DTOs.
3. Update imports to align with current repository paths (@/domains/.../repositories/*). Create or restore repositories if they were removed (track separately).
4. Replace previous helper stubs with real methods; keep temporary adapters if repository functionality is still pending, but log TODO with clear follow-up ticket reference.
5. Reapply structured logging and voice prompts.
6. Write or restore the corresponding unit and integration tests under src/__tests__/field-intelligence/.
7. Run TypeScript compile and targeted tests.

Prioritization inside Phase A:
1. Analytics trio – intake-analytics, time-analytics, workflows-analytics (unblocks dashboards).
2. Routing suite – routing-geofencing, routing-gps-tracking, routing-progress (restores technician tracking).
3. Timekeeping – time-approval, time-timesheets (needed before workflow arrival flow).
4. Workflow automation – remaining workflow services.

### Phase B – Intake Domain (Non Field-Intelligence)
- File: src/domains/intake/services/business-card-ocr.service.ts
- Actions:
  1. Restore Tesseract plus VLM fallback pipeline from 93c43a5 (or other pre-cleanup commit).
  2. Ensure the OCR config aligns with current vision utilities (may need to import from src/domains/vision/services).
  3. Add unit test covering both high-confidence Tesseract path and low-confidence VLM fallback.

### Phase C – Safety Domain
- File: src/domains/safety/services/safety-verification.service.ts
- Actions: reinstate photo verification workflow, including:
  - YOLO inference plus VLM validation chaining.
  - Supabase logging for audit trail.
  - Tests simulating verified and rejected photos.

### Phase D – Time Tracking Domain
- File: src/domains/time-tracking/services/time-tracking.service.ts
- Actions:
  - Restore repository interactions for clock in and clock out, including geofence validation and overlapping shift checks.
  - Coordinate with restored Field Intelligence time services to ensure consistent DTOs.
  - Write integration test covering clock-in and clock-out happy path plus double clock-in guard.

### Phase E – Job Workflows Domain
- File: src/domains/job-workflows/services/arrival-workflow.service.ts
- Actions:
  - Reintroduce multi-step arrival flow (photo requirement, time entry creation, notifications).
  - Ensure dependencies on routing and time services point to restored implementations.
  - Add end-to-end style test (mocking downstream services) to validate orchestrated sequence.

## 5. Repository and DTO Audit
- Confirm whether repositories under src/domains/field-intelligence/repositories were deleted or only stubs remain; restore as needed from 93c43a5.
- Reconcile DTO or type definitions shared between services and API handlers; update src/domains/field-intelligence/types (if the directory was removed) or recreate.
- Run npm exec -- tsx scripts/ci/report:api-surface.ts (if available) to verify exported APIs remain stable.

## 6. Testing and Validation Strategy
1. For each restored service, create or restore Jest unit tests and, where applicable, integration tests hitting Supabase (guard with environment detection).
2. Update any snapshot tests invalidated by restored logic.
3. After each phase, run npm run test:unit and npm run test:integration.
4. Once all phases complete, run the full pre-commit suite: npm exec -- tsx scripts/ci/fast-pre-commit.ts.
5. Document any unrelated existing failures so they are not conflated with restoration regressions.

## 7. Risk Log and Mitigations
- Repository drift: Some repositories may have been renamed or removed; mitigate by inspecting git diff 93c43a5..HEAD for src/domains/field-intelligence/repositories.
- Supabase schema mismatch: Database may have evolved since 93c43a5; run npm run check:db-actual before relying on old queries, and adjust SQL to match real schema.
- Husky path issues on Windows: Ensure scripts call npx.cmd or npm.cmd or adjust PATH so contributors can commit.
- Complexity overages: If restored services exceed 300 LoC, break into helper modules or document justification per constitution.

## 8. Communication and Tracking
- Mirror this plan in the project TODO tracking (update TodoWrite manifest once tooling is available).
- After restoring each service, append a short note to docs/service-restoration-plan.md under a new Progress Log section summarizing date, file, tests added, and outstanding follow-ups.

## 9. Immediate Next Steps
1. Stabilize developer tooling (Husky, npx path) so commits can proceed.
2. Start Phase A with intake-analytics.service.ts, reintroducing logic and tests.
3. Continue through Field Intelligence list in the priority order above, updating this plan as milestones are reached.

## Progress Log
- 2025-10-05: Restored `intake-analytics.service.ts` logic with stubbed Supabase fetch, aligning with current placeholder pattern. No historical unit tests existed; broader TypeScript issues remain tracked separately.
- 2025-10-05: Restored intake-ocr.service.ts with stubbed GPT-4 Vision call and persistence hook; actual OCR integration pending repository rebuild.
- 2025-10-05: Restored routing-geofencing.service.ts with stubbed boundary/event fetches; real repositories still pending.
- 2025-10-05: Restored routing-gps-tracking.service.ts with stubbed breadcrumb persistence/fetch; real GPS repo wiring still outstanding.
- 2025-10-05: Restored routing-progress.service.ts with stubbed schedule/breadcrumb lookups; ETA/delay calculations await repository hookups.
- 2025-10-05: Restored business-card-ocr.service.ts with parsing logic, helper modules, VLM fallback, and unit/integration coverage; repository-backed persistence still pending.
- 2025-10-05: Restored safety-verification.service.ts with YOLO primary logic, Gemini fallback, persistence hooks, and unit/integration coverage; production wiring should adopt createSafetyVerificationService factory to supply Supabase context.
- 2025-10-05: Restored time-tracking.service.ts with geofence enforcement, overlap prevention, Supabase-aware factory, and unit/integration coverage; downstream API handlers must adopt createTimeTrackingService to pass tenant/job context.
- 2025-10-05: Restored arrival-workflow.service.ts with safety verification integration, time tracking orchestration, notification hooks, and accompanying factories/tests.

## Phase B-E Detailed Roadmap
- Detailed execution checklists now live in docs/service-restoration-plan-phases-b-e.md (created 2025-10-05) covering Intake OCR, Safety, Time Tracking, and Job Workflows restorations.
