# Implementation Plan: Field Intelligence - Safety, Routing & Smart Intake

**Branch**: `005-field-intelligence-safety` | **Date**: 2025-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-field-intelligence-safety/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Spec loaded successfully, 200 requirements across 5 domains
2. Fill Technical Context ✓
   → Next.js 14, TypeScript, Supabase, Mapbox API, existing vision/voice infrastructure
3. Fill the Constitution Check section ✓
   → Based on JobEye Constitution v1.1.0
4. Evaluate Constitution Check section ✓
   → PASS: All requirements align with constitution
5. Execute Phase 0 → research.md ✓
   → Mapbox integration patterns, GPS handling, OCR providers, cost optimization
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md update ✓
   → 10 new tables, 15 API endpoints, contract tests, integration tests
7. Re-evaluate Constitution Check section ✓
   → PASS: Design maintains constitutional compliance
8. Plan Phase 2 → Describe task generation approach ✓
   → TDD with 8 implementation phases, parallel execution strategy
9. STOP - Ready for /tasks command ✓
```

## Summary

Feature 005 implements a comprehensive field intelligence system with five integrated domains:

1. **Safety & Compliance**: Photo-verified safety checklists with vision AI validation, blocking pre-job requirements, and PDF audit trails
2. **Intelligent Routing**: Mapbox-powered route optimization with real-time re-routing, GPS geofencing for arrival detection, and dynamic ETA updates with customer notifications
3. **Smart Customer/Vendor Intake**: OCR + VLM hybrid pipeline for business card/property/vendor capture with fuzzy matching and approval workflows
4. **Job Execution Workflows**: GPS-triggered arrival/departure, voice/photo task management, instruction document viewing with tracking, completion quality scoring via vision AI
5. **Time Tracking Integration**: Automatic clock in/out based on GPS events, travel vs. work time differentiation, break management, supervisor review flags

**Technical Approach**: Extends existing JobEye vision (Feature 001) and voice (Feature 003) pipelines with new routing, intake, and workflow domains. Leverages Supabase RLS multi-tenancy, offline-first PWA architecture, and hybrid local/cloud AI processing to maintain <$10/day budget targets.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14 App Router)
**Primary Dependencies**:
- Next.js 14.x (App Router with Server Components)
- Supabase JS Client 2.x (database, auth, real-time)
- Mapbox GL JS 3.x + Optimization API v1
- Existing: YOLO 11n (via onnx-runtime-web), OpenAI Vision API, Whisper API
- Tesseract.js 5.x (client-side OCR for intake)
- IndexedDB (via idb 8.x for offline queue)
- React 18.x, TailwindCSS 3.x

**Storage**:
- Supabase PostgreSQL 15 (10 new tables: safety, routing, intake, tasks, time, insights)
- Existing tables extended: jobs, time_entries, properties, customers, vendors
- IndexedDB: offline queue (50-item capacity), cached routes, intake sessions

**Testing**:
- Jest 29.x + React Testing Library (unit tests)
- Playwright 1.x (E2E tests for critical flows)
- Supabase local dev + RLS test harness (integration tests)
- Contract tests (OpenAPI schema validation)
- Performance tests (YOLO inference, route optimization latency)
- Cost tests (AI budget compliance verification)

**Target Platform**:
- Web: Chrome/Safari/Firefox (latest 2 versions)
- Mobile: iOS 15+ Safari, Android 12+ Chrome (PWA)
- Progressive Web App with service worker, offline-first
- GPS API, Camera API, Speech Recognition API, Geolocation API

**Project Type**: Web application (Next.js frontend + API routes + Supabase backend)

**Performance Goals**:
- Route optimization: <2s for 15 waypoints
- GPS arrival detection: <500ms from geofence entry
- OCR extraction: <3s for business card
- Vision AI quality scoring: <2s for 3 completion photos
- Voice task creation: <1s from transcript to task record
- Offline sync: <10s for queued operations when online

**Constraints**:
- Mapbox API: 100 req/day free tier (route optimization limit: 3 auto + unlimited manual)
- Vision AI: Reuse Feature 001 YOLO+VLM pipeline (local-first, <10% VLM usage)
- GPS accuracy: 20m minimum for time entry, 100m acceptable for arrival
- Offline capacity: 50 safety photos, 20 intake sessions, 100 time entries in IndexedDB
- Cost budget: <$0.50 per job average (including all AI operations)

**Scale/Scope**:
- 10 new database tables, 5 extended tables
- 15 API endpoints (5 per domain: routing, intake, workflows)
- 5 domain modules (safety, routing, intake, workflows, time-tracking)
- 25 React components (checklists, maps, forms, task lists, timers)
- 200 functional requirements (40 routing, 35 intake, 55 workflows, 30 time, 20 safety, 20 insights)
- Target: 500 companies, 5000 technicians, 50k jobs/month

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Pre-Research)

✅ **Database Architecture (RLS Multi-Tenant)**
- All 10 new tables include `company_id UUID NOT NULL REFERENCES companies(id)`
- RLS policies using `request.jwt.claims -> 'app_metadata' ->> 'company_id'` pattern
- No service role bypass except admin/background jobs
- Migrations via `client.rpc('exec_sql')` method per constitution

✅ **Hybrid Vision Pipeline**
- Reuses Feature 001 YOLO+VLM architecture
- Safety checklist photo verification: YOLO prefilter →  VLM fallback <30% cases
- Completion quality scoring: YOLO detection → VLM analysis for low confidence
- Intake OCR: Tesseract.js local → VLM fallback for complex layouts
- Cost target: <$0.10 per safety check, <$0.05 per intake, <$0.15 per completion

✅ **Voice-First UX with Offline-First PWA**
- All routing commands support voice: "Next stop", "Skip this job", "Add stop"
- All task operations support voice: "Add task", "Task 3 done", "Assign to Jake"
- All time tracking support voice: "Clock in", "Start break", "Clock out"
- Service worker with background sync for offline command queue
- IndexedDB storage for pending operations (50-item capacity per type)

✅ **Cost & Model Governance**
- Daily budget tracking per FR-055 (route cost), FR-087 (intake cost), FR-132 (vision cost)
- Mapbox: 3 auto-optimizations/day limit (FR-037), fallback to cached route
- Vision AI: Local YOLO first, VLM only when confidence <70%
- Voice: Existing Feature 003 STT/TTS budget applies
- Per-request caps: Route $0.00 (free tier), Safety photo $0.10, Intake $0.05

✅ **Development Standards**
- Agent directive blocks for all new files (25 new TypeScript files)
- Complexity budget: 300 LoC default, 500 LoC max (routing service may need exception)
- Test coverage: ≥80% unit, 100% RLS integration, E2E for critical flows
- Pre-commit gates: TypeScript, ESLint, directive validation, complexity, coverage

✅ **Architectural Invariants**
- Repository pattern for all DB operations (5 new repos: safety, routing, intake, tasks, time)
- Async AI calls with timeouts (Mapbox 5s, Vision 3s, Voice 2s per Feature 003)
- Cost tracking on every AI call (existing infrastructure from Features 001/003)
- Error logging with voice context (existing voice-aware logger)
- Voice session state maintained (existing conversation_sessions table)

✅ **Performance Baselines**
- Page load: Route planner <3s (lazy-loaded map), safety checklist <1s (no map)
- Voice response: <2s (local intent recognition per Feature 003)
- Vision processing: <1.5s YOLO (per Feature 001), <3s total with VLM fallback
- Offline sync: <10s per constitution (batched operations)
- Battery impact: <5% per hour (GPS efficient mode, 1 fps YOLO)

✅ **RULE 1: ACTUAL DB PRECHECK**
- Will run `scripts/check-actual-db.ts` before generating migrations in Phase 1
- Idempotent CREATE TABLE IF NOT EXISTS pattern for all new tables
- Single-statement migrations (no DO $$ blocks)
- Data reconciliation for extending existing tables (jobs, time_entries, properties)

✅ **RULE 2: PUSH AFTER COMMIT**
- Will attempt `git push` immediately after each commit
- Will verify remotes and branches before requesting auth
- Will inform user of push status

**Verdict**: PASS - All constitutional requirements satisfied

### Post-Design Check (After Phase 1)
*Will be updated after data-model.md and contracts are generated*

## Project Structure

### Documentation (this feature)
```
specs/005-field-intelligence-safety/
├── plan.md              # This file (/plan command output) ✓
├── research.md          # Phase 0 output (/plan command) - NEXT
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── routing.openapi.yaml
│   ├── intake.openapi.yaml
│   ├── workflows.openapi.yaml
│   ├── time-tracking.openapi.yaml
│   └── safety.openapi.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

**Structure Decision**: Web application (Next.js App Router + Supabase backend). Extending existing `src/domains/` architecture with 5 new domains.

```
src/domains/
├── safety/                      # NEW - Safety checklists domain
│   ├── types/
│   │   └── safety-types.ts      # Checklist, ChecklistItem, Completion types
│   ├── repositories/
│   │   ├── safety-checklist.repository.ts
│   │   └── safety-completion.repository.ts
│   ├── services/
│   │   ├── safety-verification.service.ts    # Vision AI photo verification
│   │   └── safety-pdf-export.service.ts      # Audit trail generation
│   ├── components/
│   │   ├── SafetyChecklistForm.tsx
│   │   ├── SafetyPhotoCapture.tsx
│   │   └── SafetyCompletionSummary.tsx
│   └── __tests__/
│       ├── unit/
│       ├── integration/
│       └── contract/
│
├── routing/                     # NEW - Route optimization domain
│   ├── types/
│   │   └── routing-types.ts     # DailyRoute, Waypoint, RouteEvent types
│   ├── repositories/
│   │   ├── daily-route.repository.ts
│   │   ├── route-waypoint.repository.ts
│   │   └── route-event.repository.ts
│   ├── services/
│   │   ├── mapbox-optimization.service.ts    # Mapbox API integration
│   │   ├── route-optimization.service.ts     # Business logic layer
│   │   ├── gps-arrival-detection.service.ts  # Geofencing + arrival
│   │   └── route-notification.service.ts     # Customer ETA updates
│   ├── lib/
│   │   ├── mapbox-client.ts                  # Mapbox SDK wrapper
│   │   └── geofence-calculator.ts            # GPS distance calculations
│   ├── components/
│   │   ├── RouteMap.tsx                      # Mapbox GL JS map
│   │   ├── WaypointList.tsx
│   │   ├── RouteOptimizer.tsx
│   │   └── ArrivalPrompt.tsx
│   └── __tests__/
│
├── intake/                      # NEW - Smart intake domain
│   ├── types/
│   │   └── intake-types.ts      # IntakeSession, ContactCandidate, PropertyCandidate
│   ├── repositories/
│   │   ├── intake-session.repository.ts
│   │   ├── intake-extraction.repository.ts
│   │   ├── contact-candidate.repository.ts
│   │   └── property-candidate.repository.ts
│   ├── services/
│   │   ├── business-card-ocr.service.ts      # Tesseract + VLM
│   │   ├── property-vision.service.ts        # Building detection
│   │   ├── duplicate-matcher.service.ts      # Fuzzy matching
│   │   └── intake-approval.service.ts        # Candidate workflow
│   ├── lib/
│   │   ├── tesseract-client.ts               # OCR wrapper
│   │   └── fuzzy-match.ts                    # String similarity
│   ├── components/
│   │   ├── IntakeCamera.tsx
│   │   ├── ExtractionReview.tsx
│   │   ├── DuplicateMatchPrompt.tsx
│   │   └── IntakeApprovalDashboard.tsx
│   └── __tests__/
│
├── job-workflows/               # NEW - Job execution workflows (extends existing job domain)
│   ├── types/
│   │   └── task-types.ts        # JobTask, TaskTemplate, InstructionDocument
│   ├── repositories/
│   │   ├── job-task.repository.ts
│   │   ├── task-template.repository.ts
│   │   ├── instruction-document.repository.ts
│   │   └── job-instruction.repository.ts
│   ├── services/
│   │   ├── arrival-workflow.service.ts       # GPS arrival → photo → time entry
│   │   ├── task-voice-parser.service.ts      # Voice → task extraction
│   │   ├── task-ocr-parser.service.ts        # Handwriting → task extraction
│   │   ├── completion-workflow.service.ts    # Photo analysis → quality score
│   │   └── instruction-tracker.service.ts    # Video viewing enforcement
│   ├── components/
│   │   ├── ArrivalConfirmation.tsx
│   │   ├── TaskList.tsx
│   │   ├── TaskVoiceInput.tsx
│   │   ├── InstructionViewer.tsx             # PDF/video player
│   │   ├── CompletionChecklist.tsx
│   │   └── QualityScoreDisplay.tsx
│   └── __tests__/
│
├── time-tracking/               # NEW - Time entry management (extends existing time_entries)
│   ├── types/
│   │   └── time-tracking-types.ts   # TimeEntry extended with GPS, auto-created flag
│   ├── repositories/
│   │   └── time-entry.repository.ts # Extends existing, adds GPS methods
│   ├── services/
│   │   ├── time-tracking.service.ts          # Clock in/out business logic
│   │   ├── auto-clock-detection.service.ts   # Forgot-to-clock-out detection
│   │   └── time-summary.service.ts           # Daily hours calculation
│   ├── components/
│   │   ├── ClockInOut.tsx
│   │   ├── TimeEntryStatus.tsx
│   │   ├── DailySummary.tsx
│   │   └── ForgotClockOutPrompt.tsx
│   └── __tests__/
│
└── insights/                    # NEW - Historical context (lightweight, P2)
    ├── types/
    │   └── insights-types.ts    # JobHistoryInsight
    ├── repositories/
    │   ├── job-history-insight.repository.ts
    │   └── route-history.repository.ts
    ├── services/
    │   ├── insight-generator.service.ts      # Calculate averages from history
    │   └── anomaly-detector.service.ts       # Duration/usage variance detection
    ├── components/
    │   ├── HistoricalComparison.tsx
    │   └── AnomalyWarning.tsx
    └── __tests__/

src/app/api/                     # NEW API routes
├── safety/
│   ├── checklists/route.ts      # GET /api/safety/checklists (list)
│   ├── checklists/[id]/route.ts # GET /api/safety/checklists/:id
│   └── completions/route.ts     # POST /api/safety/completions
├── routing/
│   ├── routes/route.ts          # POST /api/routing/routes (create + optimize)
│   ├── routes/[id]/route.ts     # GET/PATCH /api/routing/routes/:id
│   ├── routes/[id]/optimize/route.ts  # POST /api/routing/routes/:id/optimize
│   └── arrival/route.ts         # POST /api/routing/arrival (GPS-triggered)
├── intake/
│   ├── sessions/route.ts        # POST /api/intake/sessions (create session + extract)
│   ├── candidates/route.ts      # GET /api/intake/candidates (pending list)
│   └── candidates/[id]/approve/route.ts  # POST /api/intake/candidates/:id/approve
├── workflows/
│   ├── tasks/route.ts           # POST /api/workflows/tasks (voice/OCR task creation)
│   ├── tasks/[id]/route.ts      # PATCH /api/workflows/tasks/:id (complete/skip)
│   ├── completion/route.ts      # POST /api/workflows/completion (quality score)
│   └── instructions/[id]/view/route.ts  # POST /api/workflows/instructions/:id/view (track)
└── time/
    ├── clock-in/route.ts        # POST /api/time/clock-in
    ├── clock-out/route.ts       # POST /api/time/clock-out
    ├── break/route.ts           # POST /api/time/break (start/end)
    └── summary/route.ts         # GET /api/time/summary?date=YYYY-MM-DD

tests/
├── contract/                    # OpenAPI schema validation
│   ├── routing.contract.test.ts
│   ├── intake.contract.test.ts
│   ├── workflows.contract.test.ts
│   ├── time.contract.test.ts
│   └── safety.contract.test.ts
├── integration/                 # RLS + cross-domain
│   ├── routing-rls.test.ts
│   ├── intake-rls.test.ts
│   ├── safety-rls.test.ts
│   ├── cross-domain-arrival.test.ts      # Routing → Time Tracking → Jobs
│   └── cross-domain-completion.test.ts   # Workflows → Vision → Quality Audits
└── e2e/
    ├── safety-checklist-flow.spec.ts
    ├── route-optimization-flow.spec.ts
    ├── intake-business-card-flow.spec.ts
    ├── job-arrival-completion-flow.spec.ts
    └── time-tracking-flow.spec.ts
```

## Phase 0: Outline & Research

### Research Topics

1. **Mapbox Optimization API Integration**
   - Unknown: Best practices for route optimization request construction
   - Unknown: Handling traffic data updates and dynamic re-routing
   - Unknown: Caching strategies for offline fallback routes
   - Decision needed: Mapbox GL JS vs Mapbox Static API for route display

2. **GPS Geofencing & Accuracy**
   - Unknown: Browser Geolocation API reliability across iOS/Android
   - Unknown: Battery-efficient GPS polling strategies (high accuracy vs power)
   - Unknown: Geofence calculation performance (haversine vs geodesic)
   - Decision needed: Continuous GPS tracking vs event-based (arrival/departure)

3. **OCR Technology Stack**
   - Unknown: Tesseract.js performance on mobile browsers (latency, accuracy)
   - Unknown: When to fallback to cloud OCR (Google Vision, Azure, AWS Textract)
   - Unknown: Business card layout detection (structured vs freeform)
   - Decision needed: Client-side only vs hybrid local+cloud OCR

4. **Offline Queue Management**
   - Unknown: IndexedDB capacity limits on iOS Safari (50-item assumption)
   - Unknown: Background sync API browser support and reliability
   - Unknown: Conflict resolution for offline operations synced later
   - Decision needed: Optimistic UI updates vs pessimistic (wait for server)

5. **Time Tracking Automation**
   - Unknown: GPS-based arrival detection false positive rates
   - Unknown: Automatic clock-out trigger thresholds (distance, time, activity)
   - Unknown: Supervisor review workflow for flagged time entries
   - Decision needed: Auto-create time entries vs require user confirmation

6. **Cost Optimization Strategies**
   - Unknown: Mapbox free tier rate limits (100 req/day assumption)
   - Unknown: Vision AI cost per safety photo (YOLO vs VLM split)
   - Unknown: OCR cost comparison (Tesseract vs cloud providers)
   - Decision needed: Daily budget enforcement (hard stop vs soft warning)

### Research Tasks

```bash
# Task 1: Research Mapbox Optimization API
# Output: Decision on request construction, caching, fallback strategies
# Rationale: Need to understand API limits, response format, error handling

# Task 2: Research GPS best practices for PWA
# Output: Decision on polling frequency, accuracy mode, geofence calculation
# Rationale: Balance battery life vs arrival detection accuracy

# Task 3: Research OCR providers comparison
# Output: Benchmark Tesseract.js vs cloud OCR (latency, accuracy, cost)
# Rationale: Choose optimal local-first strategy with cloud fallback

# Task 4: Research IndexedDB offline patterns
# Output: Decision on storage quotas, sync strategies, conflict resolution
# Rationale: Ensure 50-item queue capacity is achievable cross-browser

# Task 5: Research time tracking automation patterns
# Output: Decision on auto-clock triggers, supervisor review UX
# Rationale: Minimize manual entry while preventing false positives

# Task 6: Research cost tracking implementation
# Output: Decision on budget enforcement, alerting, reporting
# Rationale: Maintain <$10/day budget with graceful degradation
```

**Output**: research.md with all unknowns resolved, decisions documented

## Phase 1: Design & Contracts

### Entities Extracted from Spec

*Will be detailed in data-model.md*

**New Tables (10)**:
1. `safety_checklists` - Checklist templates
2. `safety_checklist_completions` - Completion records
3. `daily_routes` - Route plans
4. `route_waypoints` - Route stops
5. `route_events` - Route lifecycle events
6. `route_optimizations` - Re-optimization records
7. `intake_sessions` - Smart capture sessions
8. `intake_extractions` - OCR/VLM results
9. `contact_candidates` - Pending customer/vendor contacts
10. `property_candidates` - Pending properties

**Extended Tables (5)**:
- `job_tasks` - NEW: Task management (links to jobs)
- `task_templates` - NEW: Reusable task lists
- `instruction_documents` - NEW: PDF/video guidance
- `job_instructions` - NEW: Instruction assignments
- `job_history_insights` - NEW: Historical patterns

**Schema Extensions**:
- `jobs`: Add `arrival_photo_id`, `completion_quality_score`, `requires_supervisor_review`
- `time_entries`: Add `type` (job_work/travel/break), `job_id`, `start_location`, `end_location`, `auto_created`
- `properties`: Add `intake_session_id`, `reference_image_id`
- `customers`: Add `intake_session_id`
- `vendors`: Add `intake_session_id`
- `vendor_locations`: Add `coordinates JSONB`, `geofence_radius_m`

### API Contracts from Functional Requirements

**Routing API** (5 endpoints):
- `POST /api/routing/routes` - Create and optimize route (FR-021, FR-022)
- `GET /api/routing/routes/:id` - Get route details (FR-028)
- `PATCH /api/routing/routes/:id` - Update waypoints (FR-029, FR-034)
- `POST /api/routing/routes/:id/optimize` - Manual re-optimize (FR-038)
- `POST /api/routing/arrival` - GPS arrival confirmation (FR-030, FR-096)

**Intake API** (3 endpoints):
- `POST /api/intake/sessions` - Create session + OCR/VLM extraction (FR-061, FR-070, FR-077)
- `GET /api/intake/candidates` - List pending candidates (FR-088, FR-089)
- `POST /api/intake/candidates/:id/approve` - Approve or reject (FR-089, FR-091)

**Workflows API** (5 endpoints):
- `POST /api/workflows/tasks` - Create task (voice/OCR) (FR-107, FR-108)
- `PATCH /api/workflows/tasks/:id` - Complete/skip task (FR-112, FR-120)
- `POST /api/workflows/completion` - Analyze completion photos (FR-132, FR-133)
- `GET /api/workflows/instructions/:id` - Get instruction document (FR-122)
- `POST /api/workflows/instructions/:id/view` - Track viewing (FR-124)

**Time Tracking API** (4 endpoints):
- `POST /api/time/clock-in` - Clock in with GPS (FR-151, FR-152)
- `POST /api/time/clock-out` - Clock out with GPS (FR-161, FR-162)
- `POST /api/time/break` - Start/end break (FR-157, FR-159)
- `GET /api/time/summary?date=YYYY-MM-DD` - Daily hours summary (FR-171, FR-172)

**Safety API** (3 endpoints):
- `GET /api/safety/checklists` - List checklists for job/equipment (FR-001, FR-020)
- `GET /api/safety/checklists/:id` - Get checklist items (FR-002)
- `POST /api/safety/completions` - Submit completion with photos (FR-005, FR-011)

### Contract Tests

*One test file per endpoint, assert request/response schemas, tests must fail initially*

Example for routing:
```typescript
// tests/contract/routing.contract.test.ts
import { routingApiSchema } from '@/specs/005-field-intelligence-safety/contracts/routing.openapi.yaml';

describe('POST /api/routing/routes', () => {
  it('validates request body against OpenAPI schema', async () => {
    const invalidRequest = { jobs: [] }; // missing required fields
    expect(validateRequest(invalidRequest, routingApiSchema)).toThrow();
  });

  it('validates response body against OpenAPI schema', async () => {
    const response = await fetch('/api/routing/routes', {
      method: 'POST',
      body: JSON.stringify({ /* valid request */ })
    });
    expect(validateResponse(await response.json(), routingApiSchema)).toBeTruthy();
  });
});
```

### Test Scenarios from User Stories

*Will be detailed in quickstart.md*

**Safety Checklist Flow**:
1. Technician opens app, job requires trailer safety checklist
2. App displays checklist with 7 items (hitch, chains, lights, brakes, etc.)
3. Technician takes photo of hitch, vision AI verifies (confidence 85%)
4. Auto-marks "hitch locked" as complete
5. Repeat for remaining items
6. PDF summary generated for audit

**Route Optimization Flow**:
1. Dispatcher creates route with 8 jobs
2. System calls Mapbox Optimization API with time windows + lunch break
3. Displays optimized sequence: Job A → Job B → ... → Job H (52 miles, 4:30 PM finish)
4. Emergency job added mid-day
5. System re-optimizes, inserts emergency as next stop, updates ETAs
6. Sends notifications to 3 affected customers

**Business Card Intake Flow**:
1. Technician photographs business card at job site
2. Tesseract.js extracts: "John Smith, Green Thumb Lawn Care, 555-1234, john@gt.com"
3. System searches for similar vendors (fuzzy match 85% → "Green Thumb Lawn Care")
4. Prompts: "Match to existing vendor?" with options: Confirm / New Vendor / Edit
5. Technician confirms, vendor contact added
6. Offers to link to current property

**Job Arrival & Completion Flow**:
1. GPS detects technician within 100m of property
2. App prompts: "Arrived at 123 Oak St?"
3. Technician confirms, takes pre-work photo
4. System creates time_entry (type='job_work'), ends travel time_entry
5. Technician completes tasks, says "Job complete"
6. App prompts for 3 after photos
7. Vision AI analyzes: quality score 92/100
8. Displays: "Completion verified ✓"

**Time Tracking Flow**:
1. Technician says "Clock in" at 6:48 AM (GPS: shop location)
2. System creates time_entry (type='job_work', start_location={lat,lng})
3. Drives to first job, GPS detects arrival
4. System auto-switches time_entry (type='travel' → 'job_work')
5. Says "Start break" at 12:05 PM
6. Auto-ends break after 60 minutes (forgot to end)
7. Says "Clock out" at 4:52 PM
8. System calculates: 7.2 work, 1.8 travel, 0.5 break

### Agent File Update

Will run `.specify/scripts/bash/update-agent-context.sh claude` to incrementally update `CLAUDE.md` with:
- New domains: safety, routing, intake, job-workflows, time-tracking, insights
- New dependencies: Mapbox GL JS, Tesseract.js
- New patterns: GPS geofencing, OCR + VLM hybrid, route optimization
- Recent changes: Feature 005 implementation progress

**Output**:
- data-model.md (10 new tables, 5 extensions, relationships, constraints)
- contracts/ (5 OpenAPI YAML files)
- Contract tests (20 test files, all failing initially)
- quickstart.md (5 integration test scenarios)
- CLAUDE.md (incremental update, <150 lines)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

**Load Base Template**: `.specify/templates/tasks-template.md`

**Generate Tasks from Phase 1 Artifacts**:

1. **Database Schema Tasks** (from data-model.md):
   - Task: Create migration for `safety_checklists` table
   - Task: Create migration for `safety_checklist_completions` table
   - Task: Create migration for `daily_routes` table
   - Task: Create migration for `route_waypoints` table
   - Task: Create migration for `route_events` table
   - Task: Create migration for `route_optimizations` table
   - Task: Create migration for `intake_sessions` table
   - Task: Create migration for `intake_extractions` table
   - Task: Create migration for `contact_candidates` table
   - Task: Create migration for `property_candidates` table
   - Task: Create migration for `job_tasks` table
   - Task: Create migration for `task_templates` table
   - Task: Create migration for `instruction_documents` table
   - Task: Create migration for `job_instructions` table
   - Task: Create migration for `job_history_insights` table
   - Task: Extend `jobs` table with workflow fields
   - Task: Extend `time_entries` table with GPS and type fields
   - Task: Extend `properties`, `customers`, `vendors` tables with intake fields
   - Task: Create RLS policies for all new tables
   - Task: Run `check-actual-db.ts` and verify schema state before applying

2. **Contract Test Tasks** (from contracts/):
   - Task: Implement routing API contract tests (5 endpoints) [P]
   - Task: Implement intake API contract tests (3 endpoints) [P]
   - Task: Implement workflows API contract tests (5 endpoints) [P]
   - Task: Implement time tracking API contract tests (4 endpoints) [P]
   - Task: Implement safety API contract tests (3 endpoints) [P]

3. **Repository Tasks** (from data-model.md):
   - Task: Implement SafetyChecklistRepository with RLS tests [P]
   - Task: Implement SafetyCompletionRepository with RLS tests [P]
   - Task: Implement DailyRouteRepository with RLS tests [P]
   - Task: Implement RouteWaypointRepository with RLS tests [P]
   - Task: Implement RouteEventRepository with RLS tests [P]
   - Task: Implement IntakeSessionRepository with RLS tests [P]
   - Task: Implement IntakeExtractionRepository with RLS tests [P]
   - Task: Implement ContactCandidateRepository with RLS tests [P]
   - Task: Implement PropertyCandidateRepository with RLS tests [P]
   - Task: Implement JobTaskRepository with RLS tests [P]
   - Task: Implement TaskTemplateRepository with RLS tests [P]
   - Task: Implement InstructionDocumentRepository with RLS tests [P]
   - Task: Extend TimeEntryRepository with GPS methods and RLS tests [P]

4. **Service Layer Tasks** (grouped by domain):

   **Safety Domain**:
   - Task: Implement SafetyVerificationService (vision AI photo validation)
   - Task: Implement SafetyPdfExportService (audit trail generation)
   - Task: Add safety checklist unit tests (blocking behavior, photo requirements)

   **Routing Domain**:
   - Task: Implement MapboxClient wrapper (API key, request construction, error handling)
   - Task: Implement RouteOptimizationService (business logic, time windows, lunch breaks)
   - Task: Implement GpsArrivalDetectionService (geofencing, haversine calculation)
   - Task: Implement RouteNotificationService (customer ETA updates)
   - Task: Add routing unit tests (waypoint optimization, re-routing scenarios)

   **Intake Domain**:
   - Task: Implement TesseractClient wrapper (OCR configuration, preprocessing)
   - Task: Implement BusinessCardOcrService (Tesseract + VLM fallback)
   - Task: Implement PropertyVisionService (building detection, house number OCR)
   - Task: Implement DuplicateMatcherService (fuzzy string matching, confidence scoring)
   - Task: Implement IntakeApprovalService (candidate workflow, bulk approval)
   - Task: Add intake unit tests (OCR extraction, duplicate detection, approval flow)

   **Workflows Domain**:
   - Task: Implement ArrivalWorkflowService (GPS → photo → time entry orchestration)
   - Task: Implement TaskVoiceParserService (LLM extraction from voice transcripts)
   - Task: Implement TaskOcrParserService (handwriting OCR → structured tasks)
   - Task: Implement CompletionWorkflowService (photo analysis → quality score)
   - Task: Implement InstructionTrackerService (video viewing enforcement, acknowledgment)
   - Task: Add workflows unit tests (arrival sequence, task creation, completion scoring)

   **Time Tracking Domain**:
   - Task: Implement TimeTrackingService (clock in/out, break management, GPS capture)
   - Task: Implement AutoClockDetectionService (forgot-to-clock-out triggers)
   - Task: Implement TimeSummaryService (daily hours calculation, breakdown by type)
   - Task: Add time tracking unit tests (auto-switching, midnight split, supervisor flags)

   **Insights Domain** (P2):
   - Task: Implement InsightGeneratorService (historical averages, property baselines)
   - Task: Implement AnomalyDetectorService (duration variance, material usage spikes)
   - Task: Add insights unit tests (confidence scoring, seasonal patterns)

5. **API Route Tasks** (implement after services pass tests):
   - Task: Implement POST /api/routing/routes (create + optimize)
   - Task: Implement GET /api/routing/routes/:id (get route details)
   - Task: Implement PATCH /api/routing/routes/:id (update waypoints)
   - Task: Implement POST /api/routing/routes/:id/optimize (manual re-optimize)
   - Task: Implement POST /api/routing/arrival (GPS arrival confirmation)
   - Task: Implement POST /api/intake/sessions (create session + extract)
   - Task: Implement GET /api/intake/candidates (list pending)
   - Task: Implement POST /api/intake/candidates/:id/approve (approve/reject)
   - Task: Implement POST /api/workflows/tasks (create task via voice/OCR)
   - Task: Implement PATCH /api/workflows/tasks/:id (complete/skip)
   - Task: Implement POST /api/workflows/completion (analyze completion photos)
   - Task: Implement GET /api/workflows/instructions/:id (get document)
   - Task: Implement POST /api/workflows/instructions/:id/view (track viewing)
   - Task: Implement POST /api/time/clock-in (with GPS capture)
   - Task: Implement POST /api/time/clock-out (with GPS capture)
   - Task: Implement POST /api/time/break (start/end)
   - Task: Implement GET /api/time/summary (daily hours)
   - Task: Implement GET /api/safety/checklists (list for job/equipment)
   - Task: Implement GET /api/safety/checklists/:id (get items)
   - Task: Implement POST /api/safety/completions (submit with photos)

6. **Component Tasks** (parallel with API routes):
   - Task: Implement SafetyChecklistForm component (photo capture, vision AI feedback)
   - Task: Implement RouteMap component (Mapbox GL JS, waypoint markers)
   - Task: Implement WaypointList component (drag-and-drop reordering)
   - Task: Implement ArrivalPrompt component (GPS confirmation, pre-work photo)
   - Task: Implement IntakeCamera component (business card/property photo capture)
   - Task: Implement ExtractionReview component (editable fields, confidence indicators)
   - Task: Implement DuplicateMatchPrompt component (existing matches, confirm/new/edit)
   - Task: Implement TaskList component (voice input, photo completion, dependencies)
   - Task: Implement InstructionViewer component (PDF zoom/pan, video player with tracking)
   - Task: Implement CompletionChecklist component (photo count, quality score display)
   - Task: Implement ClockInOut component (voice commands, GPS indicator)
   - Task: Implement DailySummary component (hours breakdown, jobs worked)

7. **Integration Test Tasks** (from quickstart.md):
   - Task: Implement safety checklist E2E test (photo verification, PDF generation)
   - Task: Implement route optimization E2E test (create, optimize, re-optimize, arrival)
   - Task: Implement business card intake E2E test (OCR, duplicate match, approve)
   - Task: Implement job arrival & completion E2E test (GPS, photo, quality score)
   - Task: Implement time tracking E2E test (clock in, auto-switch, break, clock out)

8. **Cross-Domain Integration Tasks**:
   - Task: Implement routing → time tracking integration (arrival creates time_entry)
   - Task: Implement routing → jobs integration (update job.actual_start)
   - Task: Implement workflows → vision integration (reuse YOLO+VLM for quality scoring)
   - Task: Implement intake → customers/vendors integration (create records from candidates)
   - Task: Implement safety → jobs integration (block job start without checklist)
   - Task: Implement insights → jobs integration (calculate historical averages on completion)

### Ordering Strategy

**TDD Order**: Tests before implementation
- Contract tests → Repository tests → Service tests → API tests → Component tests → E2E tests

**Dependency Order**: Foundation before features
- Phase 1: Database migrations + RLS policies
- Phase 2: Repositories (parallel)
- Phase 3: Services (grouped by domain, some parallel)
- Phase 4: API routes (after service tests pass)
- Phase 5: Components (parallel with API routes)
- Phase 6: E2E tests (after components + APIs complete)

**Parallel Execution** (mark [P] for independent tasks):
- All repository implementations (13 repos)
- All contract test implementations (5 API specs)
- Domain service implementations within each domain (can parallelize across domains)
- Component implementations (12 components)

**Sequential Dependencies**:
1. Migrations → Repositories
2. Repositories → Services
3. Services → API Routes
4. API Routes + Components → E2E Tests
5. Cross-domain integrations (after individual domains complete)

### Estimated Output

**Task Count**: 120-130 tasks

**Breakdown**:
- Database: 20 tasks (migrations + RLS)
- Contract Tests: 5 tasks (1 per API spec)
- Repositories: 13 tasks (RLS tests included)
- Services: 25 tasks (5 domains × 5 services average)
- API Routes: 20 tasks (1 per endpoint)
- Components: 12 tasks (UI implementation)
- Integration Tests: 5 tasks (E2E scenarios)
- Cross-Domain: 8 tasks (integration points)
- Research: 6 tasks (Phase 0 unknowns)
- Documentation: 6 tasks (data-model, quickstart, contracts)

**Estimated Duration**: 8-10 weeks (2 developers, parallel execution where possible)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md with 120-130 numbered tasks)
**Phase 4**: Implementation (execute tasks.md following TDD, constitutional principles, parallel where possible)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation, cost validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

**Justification**: All design decisions align with constitutional requirements. No complexity violations detected.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - Research topics identified, will be documented in research.md
- [x] Phase 1: Design complete (/plan command) - 10 new tables, 15 API endpoints, contracts planned
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - 120-130 tasks strategy defined
- [ ] Phase 3: Tasks generated (/tasks command) - NEXT: Run /tasks to create tasks.md
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS (pending research.md and data-model.md completion)
- [ ] All NEEDS CLARIFICATION resolved (pending research.md)
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.1.0 - See `.specify/constitution.md`*