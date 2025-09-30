# Tasks: Field Intelligence - Safety, Routing & Smart Intake

**Input**: Design documents from `/specs/005-field-intelligence-safety/`
**Prerequisites**: plan.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: Next.js 14, TypeScript, Supabase, Mapbox, Tesseract.js
   → Structure: Web app (src/domains/, src/app/api/)
2. Load optional design documents:
   → data-model.md: 10 new tables, 5 extensions (to be created)
   → contracts/: 5 API specs (to be created)
   → research.md: 6 research topics (to be created)
3. Generate tasks by category ✓
   → Setup: DB precheck, dependencies, research
   → Tests: Contract tests (20), RLS tests (13), E2E tests (5)
   → Core: Repositories (13), Services (25), API routes (20), Components (12)
   → Integration: Cross-domain (8)
   → Polish: Unit tests, performance, documentation
4. Apply task rules ✓
   → Repositories = [P] (different files)
   → Services within domain = sequential (shared dependencies)
   → API routes = sequential (shared middleware)
   → Components = [P] (different files)
5. Number tasks sequentially (T001-T125) ✓
6. Return: SUCCESS (tasks ready for execution) ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app structure**: `src/domains/{domain}/`, `src/app/api/{domain}/`
- **Tests**: `tests/contract/`, `tests/integration/`, `src/domains/{domain}/__tests__/`

---

## Phase 3.1: Setup & Prerequisites (T001-T010)

- [ ] **T001** **CRITICAL: Run database precheck script**
  - Execute: `npx tsx scripts/check-actual-db.ts`
  - Verify: Tables exist, check migration state, document findings
  - Output: Create `specs/005-field-intelligence-safety/DB_PRECHECK_RESULTS.md`
  - Rationale: Constitution RULE 1 - must check actual DB before any migration decisions

- [ ] **T002** Install new dependencies
  - Add to `package.json`: `mapbox-gl@^3.0.0`, `@mapbox/mapbox-sdk@^0.15.0`, `tesseract.js@^5.0.0`, `idb@^8.0.0`
  - Run: `npm install`
  - Verify: No conflicts with existing deps

- [ ] **T003 [P]** Research Mapbox Optimization API patterns
  - Create: `specs/005-field-intelligence-safety/research.md` (Mapbox section)
  - Document: Request construction, caching strategies, error handling, free tier limits
  - Decision: Mapbox GL JS vs Static API for route display

- [ ] **T004 [P]** Research GPS geofencing best practices
  - Append to: `specs/005-field-intelligence-safety/research.md` (GPS section)
  - Document: Geolocation API reliability, battery-efficient polling, haversine vs geodesic
  - Decision: Continuous GPS tracking vs event-based

- [ ] **T005 [P]** Research OCR technology comparison
  - Append to: `specs/005-field-intelligence-safety/research.md` (OCR section)
  - Benchmark: Tesseract.js performance on mobile, cloud OCR fallback options
  - Decision: Client-side only vs hybrid

- [ ] **T006 [P]** Research IndexedDB offline patterns
  - Append to: `specs/005-field-intelligence-safety/research.md` (Offline section)
  - Document: iOS Safari capacity limits, Background Sync API support, conflict resolution
  - Decision: Optimistic vs pessimistic UI updates

- [ ] **T007 [P]** Research time tracking automation patterns
  - Append to: `specs/005-field-intelligence-safety/research.md` (Time Tracking section)
  - Document: GPS arrival false positive rates, auto-clock-out triggers, supervisor review UX
  - Decision: Auto-create vs user confirmation

- [ ] **T008 [P]** Research cost optimization strategies
  - Append to: `specs/005-field-intelligence-safety/research.md` (Cost section)
  - Document: Mapbox rate limits, Vision AI cost per photo, OCR cost comparison
  - Decision: Hard stop vs soft warning for budget enforcement

- [ ] **T009** Create data model documentation
  - Create: `specs/005-field-intelligence-safety/data-model.md`
  - Document: 10 new tables with full schema, 5 table extensions, relationships, RLS policies
  - Include: `safety_checklists`, `safety_checklist_completions`, `daily_routes`, `route_waypoints`, `route_events`, `route_optimizations`, `intake_sessions`, `intake_extractions`, `contact_candidates`, `property_candidates`, `job_tasks`, `task_templates`, `instruction_documents`, `job_instructions`, `job_history_insights`

- [ ] **T010** Create API contracts
  - Create directory: `specs/005-field-intelligence-safety/contracts/`
  - Generate 5 OpenAPI YAML files: `routing.openapi.yaml`, `intake.openapi.yaml`, `workflows.openapi.yaml`, `time-tracking.openapi.yaml`, `safety.openapi.yaml`
  - Include: Request/response schemas, validation rules, error codes

---

## Phase 3.2: Database Migrations (T011-T030) ⚠️ IDEMPOTENT REQUIRED

**CRITICAL**: All migrations must use `CREATE TABLE IF NOT EXISTS`, single statements, no DO $$ blocks

- [ ] **T011** Create migration script for `safety_checklists` table
  - Create: `scripts/migrations/005-safety-checklists.ts`
  - Schema: `id UUID PRIMARY KEY, company_id UUID NOT NULL, name TEXT, description TEXT, required_for JSONB, items JSONB, frequency TEXT, active BOOLEAN, created_at TIMESTAMPTZ`
  - RLS Policy: `request.jwt.claims -> 'app_metadata' ->> 'company_id'` pattern
  - Execute via: `client.rpc('exec_sql', { sql: 'CREATE TABLE IF NOT EXISTS...' })`

- [ ] **T012** Create migration script for `safety_checklist_completions` table
  - Create: `scripts/migrations/005-safety-completions.ts`
  - Schema: `id UUID, checklist_id UUID REFERENCES safety_checklists(id), job_id UUID REFERENCES jobs(id), user_id UUID REFERENCES users(id), completed_at TIMESTAMPTZ, items_completed JSONB, location JSONB, signature TEXT, notes TEXT`
  - RLS Policy: Tenant isolation + user access control

- [ ] **T013** Create migration script for `daily_routes` table
  - Create: `scripts/migrations/005-daily-routes.ts`
  - Schema: `id UUID, company_id UUID, route_date DATE, assigned_to UUID, vehicle_id UUID, status TEXT, optimization_params JSONB, total_distance_km NUMERIC, estimated_duration_min INT, actual_duration_min INT, mapbox_route_id TEXT, created_at TIMESTAMPTZ, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ`
  - RLS Policy: Tenant isolation

- [ ] **T014** Create migration script for `route_waypoints` table
  - Create: `scripts/migrations/005-route-waypoints.ts`
  - Schema: `id UUID, route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE, waypoint_type TEXT, sequence_order INT, job_id UUID REFERENCES jobs(id), location JSONB, scheduled_arrival TIMESTAMPTZ, actual_arrival TIMESTAMPTZ, scheduled_departure TIMESTAMPTZ, actual_departure TIMESTAMPTZ, estimated_duration_min INT, notes TEXT, skipped BOOLEAN, skip_reason TEXT`
  - RLS Policy: Tenant isolation via route_id

- [ ] **T015** Create migration script for `route_events` table
  - Create: `scripts/migrations/005-route-events.ts`
  - Schema: `id UUID, route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE, event_type TEXT, waypoint_id UUID REFERENCES route_waypoints(id), event_time TIMESTAMPTZ DEFAULT NOW(), location JSONB, metadata JSONB`
  - RLS Policy: Tenant isolation via route_id

- [ ] **T016** Create migration script for `route_optimizations` table
  - Create: `scripts/migrations/005-route-optimizations.ts`
  - Schema: `id UUID, route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE, optimization_time TIMESTAMPTZ DEFAULT NOW(), trigger TEXT, before_waypoints JSONB, after_waypoints JSONB, distance_saved_km NUMERIC, time_saved_min INT, mapbox_request_id TEXT, cost_usd NUMERIC(10,4)`
  - RLS Policy: Tenant isolation via route_id

- [ ] **T017** Create migration script for `intake_sessions` table
  - Create: `scripts/migrations/005-intake-sessions.ts`
  - Schema: `id UUID, company_id UUID, user_id UUID REFERENCES users(id), session_type TEXT, media_id UUID REFERENCES media_assets(id), location JSONB, context JSONB, created_at TIMESTAMPTZ DEFAULT NOW()`
  - RLS Policy: Tenant isolation

- [ ] **T018** Create migration script for `intake_extractions` table
  - Create: `scripts/migrations/005-intake-extractions.ts`
  - Schema: `id UUID, session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE, extraction_method TEXT, provider TEXT, raw_text TEXT, structured_data JSONB, confidence_scores JSONB, cost_usd NUMERIC(10,4), processing_time_ms INT, created_at TIMESTAMPTZ DEFAULT NOW()`
  - RLS Policy: Tenant isolation via session_id

- [ ] **T019** Create migration script for `contact_candidates` table
  - Create: `scripts/migrations/005-contact-candidates.ts`
  - Schema: `id UUID, intake_session_id UUID REFERENCES intake_sessions(id), candidate_type TEXT, extracted_data JSONB, match_confidence NUMERIC, existing_customer_id UUID REFERENCES customers(id), existing_vendor_id UUID REFERENCES vendors(id), status TEXT DEFAULT 'pending', approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ, rejection_reason TEXT, created_record_id UUID`
  - RLS Policy: Tenant isolation via session_id

- [ ] **T020** Create migration script for `property_candidates` table
  - Create: `scripts/migrations/005-property-candidates.ts`
  - Schema: `id UUID, intake_session_id UUID REFERENCES intake_sessions(id), extracted_data JSONB, match_confidence NUMERIC, existing_property_id UUID REFERENCES properties(id), status TEXT DEFAULT 'pending', approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ, created_property_id UUID REFERENCES properties(id)`
  - RLS Policy: Tenant isolation via session_id

- [ ] **T021** Create migration script for `job_tasks` table
  - Create: `scripts/migrations/005-job-tasks.ts`
  - Schema: `id UUID, job_id UUID REFERENCES jobs(id) ON DELETE CASCADE, template_task_id UUID, task_name TEXT, description TEXT, assigned_to UUID REFERENCES users(id), status TEXT DEFAULT 'pending', sequence_order INT, required BOOLEAN DEFAULT TRUE, depends_on_task_id UUID REFERENCES job_tasks(id), estimated_duration_min INT, actual_duration_min INT, completion_method TEXT, completion_photo_id UUID REFERENCES media_assets(id), completion_evidence JSONB, completed_at TIMESTAMPTZ, completed_by UUID REFERENCES users(id), voice_transcript_id UUID REFERENCES voice_transcripts(id), created_from TEXT, created_at TIMESTAMPTZ DEFAULT NOW()`
  - RLS Policy: Tenant isolation via job_id

- [ ] **T022** Create migration script for `task_templates` table
  - Create: `scripts/migrations/005-task-templates.ts`
  - Schema: `id UUID, company_id UUID, name TEXT, description TEXT, job_type TEXT, default_tasks JSONB, tags TEXT[], usage_count INT DEFAULT 0, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW()`
  - RLS Policy: Tenant isolation

- [ ] **T023** Create migration script for `instruction_documents` table
  - Create: `scripts/migrations/005-instruction-documents.ts`
  - Schema: `id UUID, company_id UUID, title TEXT, document_type TEXT, media_id UUID REFERENCES media_assets(id), required_viewing BOOLEAN DEFAULT FALSE, category TEXT, tags TEXT[], created_at TIMESTAMPTZ DEFAULT NOW()`
  - RLS Policy: Tenant isolation

- [ ] **T024** Create migration script for `job_instructions` table
  - Create: `scripts/migrations/005-job-instructions.ts`
  - Schema: `id UUID, job_id UUID REFERENCES jobs(id) ON DELETE CASCADE, instruction_id UUID REFERENCES instruction_documents(id), required BOOLEAN DEFAULT FALSE, viewed_by JSONB, created_at TIMESTAMPTZ DEFAULT NOW()`
  - RLS Policy: Tenant isolation via job_id

- [ ] **T025** Create migration script for `job_history_insights` table
  - Create: `scripts/migrations/005-job-history-insights.ts`
  - Schema: `id UUID, company_id UUID, property_id UUID REFERENCES properties(id), customer_id UUID REFERENCES customers(id), job_type TEXT, insight_type TEXT, insight_key TEXT, insight_value JSONB, confidence NUMERIC, sample_size INT, last_updated TIMESTAMPTZ DEFAULT NOW(), UNIQUE(property_id, job_type, insight_type, insight_key)`
  - RLS Policy: Tenant isolation

- [ ] **T026** Extend `jobs` table with workflow fields
  - Create: `scripts/migrations/005-extend-jobs.ts`
  - Add columns: `arrival_photo_id UUID REFERENCES media_assets(id)`, `arrival_confirmed_at TIMESTAMPTZ`, `completion_quality_score INT`, `requires_supervisor_review BOOLEAN DEFAULT FALSE`, `supervisor_reviewed_by UUID REFERENCES users(id)`, `supervisor_reviewed_at TIMESTAMPTZ`
  - Use: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ...`

- [ ] **T027** Extend `time_entries` table with GPS and type fields
  - Create: `scripts/migrations/005-extend-time-entries.ts`
  - Add columns: `type TEXT`, `job_id UUID REFERENCES jobs(id)`, `start_location JSONB`, `end_location JSONB`, `auto_created BOOLEAN DEFAULT FALSE`
  - Use: `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ...`

- [ ] **T028** Extend `properties` table with intake fields
  - Create: `scripts/migrations/005-extend-properties.ts`
  - Add columns: `intake_session_id UUID REFERENCES intake_sessions(id)`, `reference_image_id UUID REFERENCES media_assets(id)`
  - Use: `ALTER TABLE properties ADD COLUMN IF NOT EXISTS ...`

- [ ] **T029** Extend `customers` and `vendors` tables with intake fields
  - Create: `scripts/migrations/005-extend-customers-vendors.ts`
  - Add to both: `intake_session_id UUID REFERENCES intake_sessions(id)`
  - For `vendor_locations`: Add `coordinates JSONB`, `geofence_radius_m INT DEFAULT 100`
  - Use: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`

- [ ] **T030** Execute all migrations in order
  - Run scripts T011-T029 via `npx tsx scripts/migrations/005-*.ts`
  - Verify: Check `check-actual-db.ts` output after each migration
  - Document: Any errors or conflicts encountered

---

## Phase 3.3: Contract Tests (T031-T050) ⚠️ MUST COMPLETE BEFORE IMPLEMENTATION

**CRITICAL**: These tests MUST be written and MUST FAIL before ANY implementation

- [ ] **T031 [P]** Contract test POST /api/routing/routes
  - Create: `tests/contract/routing-create.contract.test.ts`
  - Assert: Request schema validation (jobs[], optimization_params)
  - Assert: Response schema (route_id, waypoints[], total_distance, estimated_duration)
  - Must fail: "Route not found" or implementation missing

- [ ] **T032 [P]** Contract test GET /api/routing/routes/:id
  - Create: `tests/contract/routing-get.contract.test.ts`
  - Assert: Response schema matches route with waypoints, events
  - Must fail: Endpoint not implemented

- [ ] **T033 [P]** Contract test PATCH /api/routing/routes/:id
  - Create: `tests/contract/routing-update.contract.test.ts`
  - Assert: Waypoint update schema, sequence reordering
  - Must fail: Endpoint not implemented

- [ ] **T034 [P]** Contract test POST /api/routing/routes/:id/optimize
  - Create: `tests/contract/routing-optimize.contract.test.ts`
  - Assert: Re-optimization triggers, updated waypoints response
  - Must fail: Endpoint not implemented

- [ ] **T035 [P]** Contract test POST /api/routing/arrival
  - Create: `tests/contract/routing-arrival.contract.test.ts`
  - Assert: GPS coordinates, property_id, arrival confirmation response
  - Must fail: Endpoint not implemented

- [ ] **T036 [P]** Contract test POST /api/intake/sessions
  - Create: `tests/contract/intake-session.contract.test.ts`
  - Assert: Session creation with photo, OCR extraction response
  - Must fail: Endpoint not implemented

- [ ] **T037 [P]** Contract test GET /api/intake/candidates
  - Create: `tests/contract/intake-candidates-list.contract.test.ts`
  - Assert: Pending candidates list schema, filtering
  - Must fail: Endpoint not implemented

- [ ] **T038 [P]** Contract test POST /api/intake/candidates/:id/approve
  - Create: `tests/contract/intake-approve.contract.test.ts`
  - Assert: Approval/rejection request, created record response
  - Must fail: Endpoint not implemented

- [ ] **T039 [P]** Contract test POST /api/workflows/tasks
  - Create: `tests/contract/workflows-task-create.contract.test.ts`
  - Assert: Voice/OCR task creation schema, task_id response
  - Must fail: Endpoint not implemented

- [ ] **T040 [P]** Contract test PATCH /api/workflows/tasks/:id
  - Create: `tests/contract/workflows-task-update.contract.test.ts`
  - Assert: Completion/skip request schema, updated task response
  - Must fail: Endpoint not implemented

- [ ] **T041 [P]** Contract test POST /api/workflows/completion
  - Create: `tests/contract/workflows-completion.contract.test.ts`
  - Assert: Photo analysis request, quality score response
  - Must fail: Endpoint not implemented

- [ ] **T042 [P]** Contract test GET /api/workflows/instructions/:id
  - Create: `tests/contract/workflows-instruction-get.contract.test.ts`
  - Assert: Instruction document schema (PDF/video metadata)
  - Must fail: Endpoint not implemented

- [ ] **T043 [P]** Contract test POST /api/workflows/instructions/:id/view
  - Create: `tests/contract/workflows-instruction-view.contract.test.ts`
  - Assert: View tracking request, acknowledgment response
  - Must fail: Endpoint not implemented

- [ ] **T044 [P]** Contract test POST /api/time/clock-in
  - Create: `tests/contract/time-clock-in.contract.test.ts`
  - Assert: GPS location, job_id optional, time_entry_id response
  - Must fail: Endpoint not implemented

- [ ] **T045 [P]** Contract test POST /api/time/clock-out
  - Create: `tests/contract/time-clock-out.contract.test.ts`
  - Assert: Time entry completion, duration calculation
  - Must fail: Endpoint not implemented

- [ ] **T046 [P]** Contract test POST /api/time/break
  - Create: `tests/contract/time-break.contract.test.ts`
  - Assert: Break start/end request, time entry response
  - Must fail: Endpoint not implemented

- [ ] **T047 [P]** Contract test GET /api/time/summary
  - Create: `tests/contract/time-summary.contract.test.ts`
  - Assert: Daily hours summary schema (work, travel, break breakdown)
  - Must fail: Endpoint not implemented

- [ ] **T048 [P]** Contract test GET /api/safety/checklists
  - Create: `tests/contract/safety-checklists-list.contract.test.ts`
  - Assert: Checklist list schema filtered by job/equipment
  - Must fail: Endpoint not implemented

- [ ] **T049 [P]** Contract test GET /api/safety/checklists/:id
  - Create: `tests/contract/safety-checklist-get.contract.test.ts`
  - Assert: Checklist items schema with photo requirements
  - Must fail: Endpoint not implemented

- [ ] **T050 [P]** Contract test POST /api/safety/completions
  - Create: `tests/contract/safety-completion.contract.test.ts`
  - Assert: Completion submission with photos, PDF generation
  - Must fail: Endpoint not implemented

---

## Phase 3.4: Repository Layer (T051-T063) [P] ALL PARALLEL

**CRITICAL**: Include RLS tests for each repository

- [ ] **T051 [P]** Implement SafetyChecklistRepository
  - Create: `src/domains/safety/repositories/safety-checklist.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `delete`, `findByJobType`, `findByEquipmentType`
  - RLS Test: Cross-tenant access denial in `src/domains/safety/__tests__/integration/safety-checklist-rls.test.ts`

- [ ] **T052 [P]** Implement SafetyCompletionRepository
  - Create: `src/domains/safety/repositories/safety-completion.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `findByJobId`, `findByChecklistId`
  - RLS Test: Cross-tenant access denial, user access control

- [ ] **T053 [P]** Implement DailyRouteRepository
  - Create: `src/domains/routing/repositories/daily-route.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `delete`, `findByDate`, `findByUser`
  - RLS Test: Cross-tenant access denial

- [ ] **T054 [P]** Implement RouteWaypointRepository
  - Create: `src/domains/routing/repositories/route-waypoint.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `delete`, `findByRouteId`, `reorderSequence`
  - RLS Test: Tenant isolation via route_id

- [ ] **T055 [P]** Implement RouteEventRepository
  - Create: `src/domains/routing/repositories/route-event.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `findByRouteId`, `findByWaypointId`
  - RLS Test: Tenant isolation via route_id

- [ ] **T056 [P]** Implement IntakeSessionRepository
  - Create: `src/domains/intake/repositories/intake-session.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `findBySessionType`, `findByUser`
  - RLS Test: Cross-tenant access denial

- [ ] **T057 [P]** Implement IntakeExtractionRepository
  - Create: `src/domains/intake/repositories/intake-extraction.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `findBySessionId`
  - RLS Test: Tenant isolation via session_id

- [ ] **T058 [P]** Implement ContactCandidateRepository
  - Create: `src/domains/intake/repositories/contact-candidate.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `findPending`, `approve`, `reject`
  - RLS Test: Tenant isolation via session_id

- [ ] **T059 [P]** Implement PropertyCandidateRepository
  - Create: `src/domains/intake/repositories/property-candidate.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `findPending`, `approve`, `reject`
  - RLS Test: Tenant isolation via session_id

- [ ] **T060 [P]** Implement JobTaskRepository
  - Create: `src/domains/job-workflows/repositories/job-task.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `delete`, `findByJobId`, `findByStatus`, `updateStatus`
  - RLS Test: Tenant isolation via job_id

- [ ] **T061 [P]** Implement TaskTemplateRepository
  - Create: `src/domains/job-workflows/repositories/task-template.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `delete`, `findByJobType`, `incrementUsageCount`
  - RLS Test: Cross-tenant access denial

- [ ] **T062 [P]** Implement InstructionDocumentRepository
  - Create: `src/domains/job-workflows/repositories/instruction-document.repository.ts`
  - Methods: `findById`, `findAll`, `create`, `update`, `delete`, `findByCategory`, `findByTags`
  - RLS Test: Cross-tenant access denial

- [ ] **T063 [P]** Extend TimeEntryRepository with GPS methods
  - Update: `src/domains/time-tracking/repositories/time-entry.repository.ts`
  - Add methods: `createWithGPS`, `findByJobId`, `findByType`, `findByDate`, `calculateDailyHours`
  - RLS Test: Cross-tenant access denial, existing tests still pass

---

## Phase 3.5: Service Layer - Safety Domain (T064-T066)

- [ ] **T064** Implement SafetyVerificationService
  - Create: `src/domains/safety/services/safety-verification.service.ts`
  - Methods: `verifyPhotoWithVision(photo, checklistItem)` - reuse Feature 001 YOLO + VLM
  - Returns: `{ confidence: number, passes: boolean, detected: string[] }`
  - Unit test: `src/domains/safety/__tests__/unit/safety-verification.test.ts`

- [ ] **T065** Implement SafetyPdfExportService
  - Create: `src/domains/safety/services/safety-pdf-export.service.ts`
  - Methods: `generateAuditPdf(completion)` - PDF with checklist, photos, GPS, timestamp
  - Uses: `jsPDF` or similar
  - Unit test: PDF structure validation

- [ ] **T066** Add safety checklist unit tests
  - Create: `src/domains/safety/__tests__/unit/safety-checklist.test.ts`
  - Test: Blocking behavior, photo requirements, expiration logic

---

## Phase 3.6: Service Layer - Routing Domain (T067-T071)

- [ ] **T067** Implement MapboxClient wrapper
  - Create: `src/domains/routing/lib/mapbox-client.ts`
  - Methods: `optimizeRoute(waypoints, options)`, `getDirections(from, to)`, `geocode(address)`
  - Error handling: API failures, rate limits, timeout (5s)
  - Config: `MAPBOX_ACCESS_TOKEN` from env
  - Unit test: Mock Mapbox API responses

- [ ] **T068** Implement GeofenceCalculator utility
  - Create: `src/domains/routing/lib/geofence-calculator.ts`
  - Methods: `haversineDistance(lat1, lon1, lat2, lon2)`, `isWithinGeofence(current, target, radiusMeters)`
  - Returns: Distance in meters, boolean for geofence check
  - Unit test: Known coordinate pairs

- [ ] **T069** Implement RouteOptimizationService
  - Create: `src/domains/routing/services/route-optimization.service.ts`
  - Methods: `createRoute(jobs)`, `optimizeRoute(routeId)`, `reOptimizeRoute(routeId, trigger)`, `insertEmergencyJob(routeId, job)`
  - Uses: MapboxClient, DailyRouteRepository, RouteWaypointRepository, RouteOptimizationRepository
  - Business logic: Time windows, lunch breaks, 3 auto-optimize limit, cost tracking
  - Unit test: Route creation, waypoint optimization scenarios

- [ ] **T070** Implement GpsArrivalDetectionService
  - Create: `src/domains/routing/services/gps-arrival-detection.service.ts`
  - Methods: `detectArrival(currentLocation, waypoints)`, `confirmArrival(waypointId, location)`
  - Uses: GeofenceCalculator (100m radius), RouteWaypointRepository, RouteEventRepository
  - Returns: Nearest waypoint when within geofence
  - Unit test: Geofence detection, false positive prevention

- [ ] **T071** Implement RouteNotificationService
  - Create: `src/domains/routing/services/route-notification.service.ts`
  - Methods: `notifyCustomerETA(jobId, newETA)`, `notifyDelays(routeId)`
  - Uses: Existing notification infrastructure
  - Trigger: When ETA changes >15 minutes
  - Unit test: Notification payload construction

---

## Phase 3.7: Service Layer - Intake Domain (T072-T076)

- [ ] **T072** Implement TesseractClient wrapper
  - Create: `src/domains/intake/lib/tesseract-client.ts`
  - Methods: `extractText(imageBlob, options)` - configure Tesseract.js
  - Preprocessing: Grayscale, contrast adjustment
  - Returns: `{ text: string, confidence: number }`
  - Unit test: Mock business card image

- [ ] **T073** Implement FuzzyMatcher utility
  - Create: `src/domains/intake/lib/fuzzy-match.ts`
  - Methods: `calculateSimilarity(str1, str2)`, `findMatches(query, candidates, threshold)`
  - Algorithm: Levenshtein distance or similar
  - Returns: Confidence score 0-1
  - Unit test: Known string pairs

- [ ] **T074** Implement BusinessCardOcrService
  - Create: `src/domains/intake/services/business-card-ocr.service.ts`
  - Methods: `extractContact(imageBlob)` - Tesseract → parse → VLM fallback if confidence <60%
  - Returns: `{ name, company, phone, email, address, confidence }`
  - Uses: TesseractClient, OpenAI Vision API for fallback
  - Unit test: Business card extraction, low confidence handling

- [ ] **T075** Implement PropertyVisionService
  - Create: `src/domains/intake/services/property-vision.service.ts`
  - Methods: `extractProperty(imageBlob, gps)` - building detection, house number OCR
  - Returns: `{ address, building_type, features, reference_image_id }`
  - Uses: Feature 001 YOLO for building detection, Tesseract for number OCR
  - Unit test: Building facade extraction

- [ ] **T076** Implement DuplicateMatcherService
  - Create: `src/domains/intake/services/duplicate-matcher.service.ts`
  - Methods: `findSimilarCustomers(candidateData)`, `findSimilarVendors(candidateData)`, `findSimilarProperties(candidateData)`
  - Uses: FuzzyMatcher, CustomerRepository, VendorRepository, PropertyRepository
  - Returns: Matches sorted by confidence
  - Unit test: Duplicate detection scenarios

---

## Phase 3.8: Service Layer - Workflows Domain (T077-T081)

- [ ] **T077** Implement ArrivalWorkflowService
  - Create: `src/domains/job-workflows/services/arrival-workflow.service.ts`
  - Methods: `processArrival(jobId, location, photo)` - orchestrate GPS → photo → time entry → job update
  - Uses: JobRepository, TimeEntryRepository, MediaAssetRepository, NotificationService
  - Sequence: Confirm arrival, require pre-work photo, create time_entry (type='job_work'), end travel time_entry, update job.actual_start, notify customer
  - Unit test: Arrival sequence, photo requirement enforcement

- [ ] **T078** Implement TaskVoiceParserService
  - Create: `src/domains/job-workflows/services/task-voice-parser.service.ts`
  - Methods: `parseVoiceTask(transcript)` - LLM extraction of task name, equipment, duration
  - Uses: OpenAI API for structured extraction
  - Returns: `{ task_name, description, estimated_duration, equipment_needed }`
  - Unit test: Voice command parsing

- [ ] **T079** Implement TaskOcrParserService
  - Create: `src/domains/job-workflows/services/task-ocr-parser.service.ts`
  - Methods: `parseHandwrittenTasks(imageBlob)` - OCR → parse lines → structured tasks
  - Uses: TesseractClient (from intake domain)
  - Returns: Array of `{ task_name, notes }`
  - Unit test: Handwritten note parsing

- [ ] **T080** Implement CompletionWorkflowService
  - Create: `src/domains/job-workflows/services/completion-workflow.service.ts`
  - Methods: `analyzeCompletionPhotos(jobId, photos)` - vision AI quality scoring, before/after comparison
  - Uses: Feature 001 YOLO + VLM pipeline for quality analysis
  - Returns: `{ quality_score: number, issues: string[], suggestions: string[] }`
  - Business logic: <70% requires supervisor review, >$500 requires signature
  - Unit test: Quality scoring scenarios

- [ ] **T081** Implement InstructionTrackerService
  - Create: `src/domains/job-workflows/services/instruction-tracker.service.ts`
  - Methods: `trackViewing(instructionId, userId, duration)`, `requireAcknowledgment(instructionId, userId)`, `checkRequirements(jobId)`
  - Uses: InstructionDocumentRepository, JobInstructionRepository
  - Logic: 80% watch time for videos, acknowledgment tracking
  - Unit test: Viewing enforcement, acknowledgment tracking

---

## Phase 3.9: Service Layer - Time Tracking Domain (T082-T084)

- [ ] **T082** Implement TimeTrackingService
  - Create: `src/domains/time-tracking/services/time-tracking.service.ts`
  - Methods: `clockIn(userId, location, jobId?)`, `clockOut(userId, location)`, `startBreak(userId)`, `endBreak(userId)`
  - Uses: TimeEntryRepository
  - Logic: Create time_entry with GPS, auto-switch types (travel → job_work), prevent double clock-in
  - Unit test: Clock in/out, type switching, validation

- [ ] **T083** Implement AutoClockDetectionService
  - Create: `src/domains/time-tracking/services/auto-clock-detection.service.ts`
  - Methods: `detectForgotClockOut(userId)`, `suggestClockOut(timeEntryId, suggestedTime)`
  - Triggers: >500m from last job + after 5pm + 30min no activity
  - Returns: Prompt with suggested time, flags for supervisor review
  - Unit test: Detection scenarios, edge cases

- [ ] **T084** Implement TimeSummaryService
  - Create: `src/domains/time-tracking/services/time-summary.service.ts`
  - Methods: `calculateDailyHours(userId, date)`, `breakdownByType(userId, date)`, `exportForPayroll(userId, startDate, endDate)`
  - Uses: TimeEntryRepository
  - Returns: `{ total_hours, work_hours, travel_hours, break_hours, jobs_worked }`
  - Unit test: Hours calculation, midnight split handling

---

## Phase 3.10: API Routes - Routing (T085-T089)

- [ ] **T085** Implement POST /api/routing/routes (create + optimize)
  - Create: `src/app/api/routing/routes/route.ts`
  - Handler: Accept jobs[], optimization_params → call RouteOptimizationService.createRoute → return route with waypoints
  - Validation: Jobs array not empty, valid optimization criteria
  - Response: Route ID, optimized waypoints, total distance, estimated duration
  - Test: Contract test T031 should now pass

- [ ] **T086** Implement GET /api/routing/routes/:id (get route details)
  - Create: `src/app/api/routing/routes/[id]/route.ts` (GET handler)
  - Handler: Load route with waypoints and events from repositories
  - Response: Full route object with nested waypoints[], events[]
  - Test: Contract test T032 should now pass

- [ ] **T087** Implement PATCH /api/routing/routes/:id (update waypoints)
  - Update: `src/app/api/routing/routes/[id]/route.ts` (PATCH handler)
  - Handler: Update waypoint order, add/remove waypoints → trigger auto re-optimize if within limit
  - Response: Updated route with new waypoint sequence
  - Test: Contract test T033 should now pass

- [ ] **T088** Implement POST /api/routing/routes/:id/optimize (manual re-optimize)
  - Create: `src/app/api/routing/routes/[id]/optimize/route.ts`
  - Handler: Force re-optimization (bypass daily limit) → call RouteOptimizationService.reOptimizeRoute
  - Response: Re-optimized route, distance saved, time saved
  - Test: Contract test T034 should now pass

- [ ] **T089** Implement POST /api/routing/arrival (GPS arrival confirmation)
  - Create: `src/app/api/routing/arrival/route.ts`
  - Handler: Receive GPS coordinates → call GpsArrivalDetectionService.confirmArrival → trigger ArrivalWorkflowService
  - Response: Arrival confirmed, time entry created, customer notified
  - Test: Contract test T035 should now pass

---

## Phase 3.11: API Routes - Intake (T090-T092)

- [ ] **T090** Implement POST /api/intake/sessions (create session + extract)
  - Create: `src/app/api/intake/sessions/route.ts`
  - Handler: Upload photo → create intake_session → call appropriate OCR service (BusinessCardOcrService or PropertyVisionService) → create extraction record → create candidate
  - Response: Session ID, extracted data, confidence scores, candidate ID
  - Test: Contract test T036 should now pass

- [ ] **T091** Implement GET /api/intake/candidates (list pending)
  - Create: `src/app/api/intake/candidates/route.ts` (GET handler)
  - Handler: List pending contact_candidates and property_candidates with filtering
  - Response: Array of candidates with extracted data, match suggestions
  - Test: Contract test T037 should now pass

- [ ] **T092** Implement POST /api/intake/candidates/:id/approve (approve/reject)
  - Create: `src/app/api/intake/candidates/[id]/approve/route.ts`
  - Handler: Approve → create customer/vendor/property record, link to intake session → update candidate status | Reject → update candidate with reason
  - Response: Created record ID or rejection confirmation
  - Test: Contract test T038 should now pass

---

## Phase 3.12: API Routes - Workflows (T093-T097)

- [ ] **T093** Implement POST /api/workflows/tasks (create task via voice/OCR)
  - Create: `src/app/api/workflows/tasks/route.ts` (POST handler)
  - Handler: Accept transcript or image → call TaskVoiceParserService or TaskOcrParserService → create job_task
  - Response: Task ID, parsed task data
  - Test: Contract test T039 should now pass

- [ ] **T094** Implement PATCH /api/workflows/tasks/:id (complete/skip)
  - Create: `src/app/api/workflows/tasks/[id]/route.ts` (PATCH handler)
  - Handler: Update task status, capture completion method (voice/photo/manual), handle dependencies
  - Response: Updated task with completion timestamp
  - Test: Contract test T040 should now pass

- [ ] **T095** Implement POST /api/workflows/completion (analyze completion photos)
  - Create: `src/app/api/workflows/completion/route.ts`
  - Handler: Accept job ID + photos → call CompletionWorkflowService.analyzeCompletionPhotos → update job quality score
  - Response: Quality score, detected issues, suggestions, supervisor review flag
  - Test: Contract test T041 should now pass

- [ ] **T096** Implement GET /api/workflows/instructions/:id (get document)
  - Create: `src/app/api/workflows/instructions/[id]/route.ts` (GET handler)
  - Handler: Load instruction document with media URL
  - Response: Document metadata, media URL, required viewing flag
  - Test: Contract test T042 should now pass

- [ ] **T097** Implement POST /api/workflows/instructions/:id/view (track viewing)
  - Create: `src/app/api/workflows/instructions/[id]/view/route.ts`
  - Handler: Record viewing event → call InstructionTrackerService.trackViewing
  - Response: Viewing recorded, acknowledgment status
  - Test: Contract test T043 should now pass

---

## Phase 3.13: API Routes - Time Tracking (T098-T101)

- [ ] **T098** Implement POST /api/time/clock-in (with GPS)
  - Create: `src/app/api/time/clock-in/route.ts`
  - Handler: Accept user ID, GPS location, optional job ID → call TimeTrackingService.clockIn
  - Response: Time entry ID, clock-in confirmation
  - Test: Contract test T044 should now pass

- [ ] **T099** Implement POST /api/time/clock-out (with GPS)
  - Create: `src/app/api/time/clock-out/route.ts`
  - Handler: Accept user ID, GPS location → call TimeTrackingService.clockOut → calculate duration
  - Response: Time entry completed, total duration
  - Test: Contract test T045 should now pass

- [ ] **T100** Implement POST /api/time/break (start/end)
  - Create: `src/app/api/time/break/route.ts`
  - Handler: Accept action ('start' or 'end') → call TimeTrackingService.startBreak or endBreak
  - Response: Break time entry ID or completion confirmation
  - Test: Contract test T046 should now pass

- [ ] **T101** Implement GET /api/time/summary (daily hours)
  - Create: `src/app/api/time/summary/route.ts` (GET handler)
  - Handler: Accept user ID, date → call TimeSummaryService.calculateDailyHours
  - Response: Total hours, breakdown by type (work, travel, break), jobs worked
  - Test: Contract test T047 should now pass

---

## Phase 3.14: API Routes - Safety (T102-T104)

- [ ] **T102** Implement GET /api/safety/checklists (list for job/equipment)
  - Create: `src/app/api/safety/checklists/route.ts` (GET handler)
  - Handler: Filter checklists by job type or equipment type
  - Response: Array of applicable checklists
  - Test: Contract test T048 should now pass

- [ ] **T103** Implement GET /api/safety/checklists/:id (get items)
  - Create: `src/app/api/safety/checklists/[id]/route.ts` (GET handler)
  - Handler: Load checklist with items array
  - Response: Checklist with items, photo requirements, critical flags
  - Test: Contract test T049 should now pass

- [ ] **T104** Implement POST /api/safety/completions (submit with photos)
  - Create: `src/app/api/safety/completions/route.ts`
  - Handler: Accept checklist ID, items completed with photos → call SafetyVerificationService for vision AI → generate PDF via SafetyPdfExportService
  - Response: Completion ID, verification results, PDF URL
  - Test: Contract test T050 should now pass

---

## Phase 3.15: React Components - Safety (T105-T107) [P] ALL PARALLEL

- [ ] **T105 [P]** Implement SafetyChecklistForm component
  - Create: `src/domains/safety/components/SafetyChecklistForm.tsx`
  - Features: Display checklist items, camera integration for photo capture, vision AI feedback (confidence display), blocking behavior for required items
  - Props: `checklistId`, `jobId`, `onComplete`
  - Uses: SafetyChecklistRepository, SafetyVerificationService

- [ ] **T106 [P]** Implement SafetyPhotoCapture component
  - Create: `src/domains/safety/components/SafetyPhotoCapture.tsx`
  - Features: Camera activation, photo preview, retake option, vision AI analysis indicator
  - Props: `checklistItemId`, `onPhotoCapture`
  - Uses: Camera API, MediaAssetRepository

- [ ] **T107 [P]** Implement SafetyCompletionSummary component
  - Create: `src/domains/safety/components/SafetyCompletionSummary.tsx`
  - Features: Display completed items, photo thumbnails, PDF download button
  - Props: `completionId`
  - Uses: SafetyCompletionRepository

---

## Phase 3.16: React Components - Routing (T108-T111) [P] ALL PARALLEL

- [ ] **T108 [P]** Implement RouteMap component
  - Create: `src/domains/routing/components/RouteMap.tsx`
  - Features: Mapbox GL JS integration, waypoint markers, route lines, current location indicator, ETA labels
  - Props: `routeId`, `onWaypointClick`
  - Uses: Mapbox GL JS, DailyRouteRepository, RouteWaypointRepository

- [ ] **T109 [P]** Implement WaypointList component
  - Create: `src/domains/routing/components/WaypointList.tsx`
  - Features: Drag-and-drop reordering, skip job button, ETA display, status indicators
  - Props: `routeId`, `onWaypointsReorder`, `onJobSkip`
  - Uses: RouteWaypointRepository

- [ ] **T110 [P]** Implement RouteOptimizer component
  - Create: `src/domains/routing/components/RouteOptimizer.tsx`
  - Features: Optimization criteria selection, manual optimize button, optimization result display (distance saved, time saved)
  - Props: `routeId`, `onOptimize`
  - Uses: RouteOptimizationService

- [ ] **T111 [P]** Implement ArrivalPrompt component
  - Create: `src/domains/routing/components/ArrivalPrompt.tsx`
  - Features: GPS confirmation prompt, property name/address display, pre-work photo capture, arrival confirmation button
  - Props: `waypointId`, `propertyName`, `onConfirm`
  - Uses: GpsArrivalDetectionService, ArrivalWorkflowService

---

## Phase 3.17: React Components - Intake (T112-T115) [P] ALL PARALLEL

- [ ] **T112 [P]** Implement IntakeCamera component
  - Create: `src/domains/intake/components/IntakeCamera.tsx`
  - Features: Camera activation, capture modes (business card, property, vehicle), photo preview, OCR processing indicator
  - Props: `sessionType`, `onCapture`
  - Uses: Camera API, IntakeSessionRepository

- [ ] **T113 [P]** Implement ExtractionReview component
  - Create: `src/domains/intake/components/ExtractionReview.tsx`
  - Features: Display extracted fields (editable), confidence indicators (color-coded), retake photo option, confirm button
  - Props: `extractionId`, `onConfirm`
  - Uses: IntakeExtractionRepository

- [ ] **T114 [P]** Implement DuplicateMatchPrompt component
  - Create: `src/domains/intake/components/DuplicateMatchPrompt.tsx`
  - Features: Display similar existing records with confidence scores, match options (Confirm, Create New, Edit), context display (distance, last interaction)
  - Props: `candidateId`, `matches`, `onSelect`
  - Uses: DuplicateMatcherService

- [ ] **T115 [P]** Implement IntakeApprovalDashboard component
  - Create: `src/domains/intake/components/IntakeApprovalDashboard.tsx`
  - Features: List pending candidates, bulk approval, rejection with reason, search/filter
  - Props: `onApprove`, `onReject`
  - Uses: ContactCandidateRepository, PropertyCandidateRepository

---

## Phase 3.18: React Components - Workflows (T116-T119) [P] ALL PARALLEL

- [ ] **T116 [P]** Implement TaskList component
  - Create: `src/domains/job-workflows/components/TaskList.tsx`
  - Features: Display tasks with sequence, status indicators, voice input for task creation, photo completion button, dependency indicators, skip with reason
  - Props: `jobId`, `onTaskComplete`, `onTaskSkip`
  - Uses: JobTaskRepository, TaskVoiceParserService

- [ ] **T117 [P]** Implement InstructionViewer component
  - Create: `src/domains/job-workflows/components/InstructionViewer.tsx`
  - Features: PDF renderer with zoom/pan/download, video player with progress tracking, 80% watch time enforcement, acknowledgment checkbox
  - Props: `instructionId`, `onViewed`
  - Uses: InstructionDocumentRepository, InstructionTrackerService

- [ ] **T118 [P]** Implement CompletionChecklist component
  - Create: `src/domains/job-workflows/components/CompletionChecklist.tsx`
  - Features: Display required items (photos, materials, equipment), photo count indicator, completion button, blocking for incomplete items
  - Props: `jobId`, `onComplete`
  - Uses: JobRepository

- [ ] **T119 [P]** Implement QualityScoreDisplay component
  - Create: `src/domains/job-workflows/components/QualityScoreDisplay.tsx`
  - Features: Quality score visualization (0-100), detected issues list, suggestions, supervisor review prompt
  - Props: `qualityScore`, `issues`, `suggestions`

---

## Phase 3.19: React Components - Time Tracking (T120-T122) [P] ALL PARALLEL

- [ ] **T120 [P]** Implement ClockInOut component
  - Create: `src/domains/time-tracking/components/ClockInOut.tsx`
  - Features: Clock in/out buttons, voice command support, GPS indicator, current status display, job selection for clock-in
  - Props: `userId`, `onClockIn`, `onClockOut`
  - Uses: TimeTrackingService

- [ ] **T121 [P]** Implement TimeEntryStatus component
  - Create: `src/domains/time-tracking/components/TimeEntryStatus.tsx`
  - Features: Display current time entry type (work/travel/break), elapsed time, switch buttons (start break, end break)
  - Props: `userId`
  - Uses: TimeEntryRepository

- [ ] **T122 [P]** Implement DailySummary component
  - Create: `src/domains/time-tracking/components/DailySummary.tsx`
  - Features: Hours breakdown (work, travel, break), jobs worked list, date selector, export to payroll button
  - Props: `userId`, `date`
  - Uses: TimeSummaryService

---

## Phase 3.20: E2E Integration Tests (T123-T127) [P] ALL PARALLEL

- [ ] **T123 [P]** E2E test: Safety checklist flow
  - Create: `tests/e2e/safety-checklist-flow.spec.ts`
  - Scenario: Open app → job requires trailer safety → display checklist → take photos → vision AI verifies → PDF generated
  - Verify: Checklist completion, photo uploads, PDF generation
  - Uses: Playwright, SafetyChecklistForm component

- [ ] **T124 [P]** E2E test: Route optimization flow
  - Create: `tests/e2e/route-optimization-flow.spec.ts`
  - Scenario: Dispatcher creates route → optimize via Mapbox → emergency job added → re-optimize → customer notifications sent
  - Verify: Route creation, waypoint optimization, re-optimization, ETA updates
  - Uses: Playwright, RouteMap, RouteOptimizer components

- [ ] **T125 [P]** E2E test: Business card intake flow
  - Create: `tests/e2e/intake-business-card-flow.spec.ts`
  - Scenario: Technician photographs business card → OCR extracts → fuzzy match finds similar vendor → confirm match → vendor added
  - Verify: OCR extraction, duplicate detection, vendor creation
  - Uses: Playwright, IntakeCamera, ExtractionReview, DuplicateMatchPrompt components

- [ ] **T126 [P]** E2E test: Job arrival & completion flow
  - Create: `tests/e2e/job-arrival-completion-flow.spec.ts`
  - Scenario: GPS detects arrival → confirm → take pre-work photo → complete tasks → take after photos → vision AI scores quality → completion verified
  - Verify: Arrival detection, photo capture, quality scoring, time entry creation
  - Uses: Playwright, ArrivalPrompt, TaskList, CompletionChecklist components

- [ ] **T127 [P]** E2E test: Time tracking flow
  - Create: `tests/e2e/time-tracking-flow.spec.ts`
  - Scenario: Clock in → GPS captured → drive to job → auto-switch to travel → arrive → auto-switch to work → start break → forgot to end → auto-ended after 60min → clock out → daily summary
  - Verify: Clock in/out, type switching, break management, daily summary
  - Uses: Playwright, ClockInOut, TimeEntryStatus, DailySummary components

---

## Dependencies

### Critical Path
1. **T001 (DB Precheck)** must complete before T011-T030 (Migrations)
2. **T011-T030 (Migrations)** must complete before T051-T063 (Repositories)
3. **T031-T050 (Contract Tests)** must complete before T085-T104 (API Routes)
4. **T051-T063 (Repositories)** must complete before T064-T084 (Services)
5. **T064-T084 (Services)** must complete before T085-T104 (API Routes)
6. **T085-T104 (API Routes)** must complete before T123-T127 (E2E Tests)

### Within-Domain Dependencies
- **Safety**: T051, T052 → T064, T065 → T102, T103, T104
- **Routing**: T053, T054, T055 → T067, T068, T069, T070, T071 → T085-T089
- **Intake**: T056, T057, T058, T059 → T072, T073, T074, T075, T076 → T090-T092
- **Workflows**: T060, T061, T062 → T077, T078, T079, T080, T081 → T093-T097
- **Time Tracking**: T063 → T082, T083, T084 → T098-T101

### Parallel Execution Groups

**Group 1: Research (T003-T008)** - All parallel
```
Task: "Research Mapbox Optimization API patterns"
Task: "Research GPS geofencing best practices"
Task: "Research OCR technology comparison"
Task: "Research IndexedDB offline patterns"
Task: "Research time tracking automation patterns"
Task: "Research cost optimization strategies"
```

**Group 2: Contract Tests (T031-T050)** - All parallel (20 tests, different files)
```
# Can launch all 20 contract tests simultaneously
Task: "Contract test POST /api/routing/routes"
Task: "Contract test GET /api/routing/routes/:id"
...
Task: "Contract test POST /api/safety/completions"
```

**Group 3: Repositories (T051-T063)** - All parallel (13 repos, different files)
```
Task: "Implement SafetyChecklistRepository"
Task: "Implement SafetyCompletionRepository"
...
Task: "Extend TimeEntryRepository with GPS methods"
```

**Group 4: Components (T105-T122)** - All parallel (18 components, different files)
```
Task: "Implement SafetyChecklistForm component"
Task: "Implement RouteMap component"
...
Task: "Implement DailySummary component"
```

**Group 5: E2E Tests (T123-T127)** - All parallel (5 test files)
```
Task: "E2E test: Safety checklist flow"
Task: "E2E test: Route optimization flow"
Task: "E2E test: Business card intake flow"
Task: "E2E test: Job arrival & completion flow"
Task: "E2E test: Time tracking flow"
```

---

## Notes

- **TDD Enforced**: Contract tests (T031-T050) MUST be written and failing before implementing API routes (T085-T104)
- **RLS Testing**: Each repository task (T051-T063) includes RLS cross-tenant access denial tests
- **Idempotent Migrations**: All database migrations (T011-T030) use `CREATE TABLE IF NOT EXISTS`, single statements, no DO $$ blocks
- **Constitutional Compliance**: All tasks follow JobEye Constitution v1.1.0 requirements
- **Commit After Each Task**: Git commit after completing each task for traceability
- **Total Tasks**: 127 tasks
- **Estimated Duration**: 8-10 weeks (2 developers, parallel execution where possible)

---

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T031-T050 cover all 20 API endpoints)
- [x] All entities have repository tasks (T051-T063 cover 10 new + 3 extended tables)
- [x] All tests come before implementation (Contract tests T031-T050 before API routes T085-T104)
- [x] Parallel tasks truly independent (Group 1-5 verified: different files, no dependencies)
- [x] Each task specifies exact file path (All tasks include `Create:` or `Update:` paths)
- [x] No task modifies same file as another [P] task (Verified: Repositories, Components, Tests all separate files)

---

**END OF TASKS.MD**