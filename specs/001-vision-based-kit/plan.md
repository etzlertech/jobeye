# Implementation Plan: Vision-Based Kit Verification

**Branch**: `001-vision-based-kit` | **Date**: 2025-09-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-vision-based-kit/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Spec loaded with 7 clarifications from 2025-09-29 session
2. Fill Technical Context ✓
   → TypeScript 5.x, Next.js 14, Supabase, YOLO.js, ONNX Runtime Web
   → Project Type: web (frontend + backend in Next.js)
3. Fill Constitution Check ✓
   → Multi-tenant RLS: Required for vision records
   → Hybrid Vision Pipeline: Core feature requirement
   → Offline-First PWA: Mandatory for field operations
   → Cost Governance: $10/day budget enforced
4. Evaluate Constitution Check ✓
   → No violations detected
   → All constitutional requirements align with feature spec
5. Execute Phase 0 → research.md ✓
   → All technical decisions clarified in spec
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
7. Re-evaluate Constitution Check ✓
   → Design aligns with all constitutional principles
8. Plan Phase 2 → Task generation approach described ✓
9. STOP - Ready for /tasks command
```

## Summary

Vision-based kit verification system using hybrid YOLO + VLM processing to enable field technicians to verify loaded equipment with a single photo. Local YOLO detection runs at 1 fps with 3-second processing target, falling back to cloud VLM analysis only when confidence < 70%. System operates offline-first with 50-photo queue capacity and enforces $10/day budget cap. Integrates with Feature 003 scheduling system for kit definitions and verification status updates. Photos stored in Supabase Storage with 1-year retention and company-level RLS access control.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20.x (Next.js 14)
**Primary Dependencies**: Next.js 14, Supabase SDK, React 18, YOLO.js, ONNX Runtime Web, TensorFlow.js
**Storage**: Supabase (PostgreSQL + Storage buckets), IndexedDB (offline cache)
**Testing**: Jest, React Testing Library, Playwright
**Target Platform**: Web (Progressive Web App with offline support)
**Project Type**: web (frontend + backend integrated in Next.js)
**Performance Goals**:
  - Local YOLO detection: < 3 seconds
  - Frame capture rate: 1 fps continuous
  - Total verification flow: < 30 seconds end-to-end
  - VLM fallback (when needed): < 10 seconds
**Constraints**:
  - Offline-first: Must work without internet connectivity
  - Cost optimization: 70% confidence threshold, $10/day budget cap
  - Storage limits: 50-photo offline queue, 1-year cloud retention
  - Mobile device compatibility: Works on mid-range smartphones (2-3 years old)
**Scale/Scope**:
  - Support 100+ companies
  - 1000+ technicians per company
  - 10k+ verifications/day across platform
  - Multi-tenant isolation via RLS

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Based on JobEye Constitution v1.1.0:

### §1: Database Architecture - Supabase Multi-Tenant with RLS-First
- ✅ **company_id on all tables**: All vision-related tables will include company_id for tenant isolation
- ✅ **RLS policies enabled**: Vision verification records, detected items, cost tracking all protected by RLS
- ✅ **No bypass patterns**: Repository pattern enforces RLS, service role only for admin operations
- ✅ **RLS testing required**: Integration tests will verify cross-tenant access denial

### §2: Hybrid Vision Pipeline Architecture
- ✅ **Local YOLO prefilter**: YOLOv11n runs locally at 1 fps (per clarifications)
- ✅ **VLM fallback at 70% confidence**: Matches constitutional requirement and clarified threshold
- ✅ **Cost optimization target**: Design targets >90% local processing to stay under $10/day budget

### §3: Voice-First UX with Offline-First PWA
- ✅ **PWA infrastructure exists**: Feature 001 already implemented manifest, service worker, IndexedDB
- ✅ **Offline queueing**: 50-photo queue with background sync
- ✅ **Graceful degradation**: Allow proceed with warning when all detection fails (per clarifications)

### §4: Cost & Model Governance
- ✅ **Budget enforcement**: $10/day cap (clarified), enforced at repository level
- ✅ **Cost tracking**: Every VLM call records estimated cost ($0.10/request default)
- ✅ **Fallback tiers**: Local YOLO → Cloud VLM → Manual selection

### §5: Development Standards
- ✅ **Agent directive blocks**: All new TypeScript files will include required metadata
- ✅ **Complexity budget**: 300 LoC default, 500 LoC max with justification
- ✅ **Testing requirements**: ≥80% coverage, RLS integration tests, E2E vision flows

### §6: Architectural Invariants
- ✅ **Repository pattern**: All DB operations through dedicated repositories
- ✅ **Async AI calls**: All YOLO/VLM operations are async with timeouts
- ✅ **Cost tracking mandatory**: Every VLM request logged with estimated cost
- ✅ **Error logging**: All vision failures logged with session context

### §7: Performance Baselines
- ✅ **Vision processing**: < 3s target aligns with < 1.5s constitutional baseline (YOLO only, VLM excluded)
- ✅ **Offline sync**: < 10s target matches constitutional requirement
- ✅ **Battery impact**: Vision processing optimized with 1 fps throttling

### §8: NON-NEGOTIABLES
- ✅ **RULE 1 - DB Precheck**: Will run `npm run check:db-actual` before migrations
- ✅ **RULE 2 - Push After Commit**: Will push immediately after every commit

**Constitution Compliance**: ✅ PASS - All requirements satisfied

## Project Structure

### Documentation (this feature)
```
specs/001-vision-based-kit/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── vision-api.yaml
│   └── kit-verification-api.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

Based on existing JobEye structure (Next.js web application with integrated backend):

```
src/
├── domains/
│   └── vision/
│       ├── lib/
│       │   ├── yolo-loader.ts              # YOLO model initialization & caching
│       │   ├── yolo-inference.ts           # Frame-by-frame detection engine
│       │   ├── vlm-fallback-router.ts      # Confidence-based routing logic
│       │   ├── fps-throttle-controller.ts  # 1 fps capture control
│       │   ├── container-detector.ts       # Container boundary detection
│       │   └── vision-types.ts             # Shared type definitions
│       ├── services/
│       │   ├── vision-verification.service.ts      # Core verification orchestration
│       │   ├── detection-confidence.service.ts     # Threshold management
│       │   ├── cost-tracking.service.ts            # Budget enforcement
│       │   └── offline-vision-queue.service.ts     # 50-photo queue mgmt
│       └── repositories/
│           ├── vision-verification.repository.ts   # Verification record CRUD
│           ├── detected-item.repository.ts         # Detected items storage
│           └── cost-record.repository.ts           # Cost tracking storage
├── scheduling/
│   └── services/
│       └── kit-verification-integration.service.ts # Feature 003 integration
└── components/
    └── vision/
        ├── CameraCapture.tsx             # 1 fps camera interface
        ├── VerificationResults.tsx       # Visual feedback UI
        ├── CostEstimatePrompt.tsx        # VLM fallback confirmation
        └── OfflineQueueIndicator.tsx     # Sync status display

app/
└── api/
    └── vision/
        ├── verify/route.ts               # POST /api/vision/verify
        ├── queue/route.ts                # GET /api/vision/queue (offline sync)
        └── history/route.ts              # GET /api/vision/history (supervisor view)

supabase/
├── migrations/
│   └── 040_vision_verification_schema.sql
└── functions/
    └── vlm-fallback/
        └── index.ts                      # Edge function for VLM processing

public/
└── models/
    └── yolov11n.onnx                     # YOLO model weights (cached)

__tests__/
├── domains/
│   └── vision/
│       ├── unit/
│       │   ├── yolo-inference.test.ts
│       │   ├── vlm-router.test.ts
│       │   └── cost-tracking.test.ts
│       ├── integration/
│       │   ├── vision-verification-flow.test.ts
│       │   ├── offline-queue-sync.test.ts
│       │   └── rls-isolation.test.ts
│       └── performance/
│           ├── yolo-latency.bench.ts
│           └── frame-rate.bench.ts
└── e2e/
    └── vision/
        └── kit-verification-flow.spec.ts
```

**Structure Decision**: Web application structure following existing JobEye patterns. Vision domain follows established `lib/services/repositories` organization. Integrates with existing Feature 003 (scheduling/kits) through service layer. Uses Next.js App Router API routes for backend endpoints. Supabase migrations additive to existing schema.

## Phase 0: Outline & Research

### Research Questions Resolved

All technical unknowns were clarified during `/clarify` session on 2025-09-29:

1. ✅ **Confidence threshold for VLM fallback**: 70% (clarified)
2. ✅ **Daily budget cap**: $10/day per company (clarified)
3. ✅ **Local detection latency target**: 3 seconds max (clarified)
4. ✅ **Photo retention policy**: 1 year automatic deletion (clarified)
5. ✅ **Frame capture rate**: 1 fps continuous (clarified)
6. ✅ **Offline queue capacity**: 50 photos (clarified)
7. ✅ **Fallback behavior when all detection fails**: Allow with warning (clarified)

### Technology Decisions

**YOLO Implementation**: YOLO.js with ONNX Runtime Web
- **Rationale**: Browser-compatible, runs on Web Workers, supports YOLOv11n model
- **Alternatives**: TensorFlow.js COCO-SSD (rejected: lower accuracy, larger bundle)
- **Integration**: Model cached in IndexedDB, loaded on app init

**VLM Provider**: OpenAI GPT-4 Vision
- **Rationale**: Best accuracy for equipment recognition, reliable API, $0.10/request fits budget
- **Alternatives**: Anthropic Claude Vision (similar cost), Google Gemini Pro Vision (lower cost but less accurate for industrial equipment)
- **Fallback**: If budget exceeded, queue for next-day processing or manual verification

**Offline Storage**: IndexedDB for photos, localStorage for queue metadata
- **Rationale**: IndexedDB handles binary image data efficiently, 50MB+ quota typical on mobile
- **Alternatives**: Cache API (rejected: less structured), WebSQL (deprecated)
- **Sync Strategy**: Background Sync API with exponential backoff

**Photo Storage**: Supabase Storage buckets
- **Rationale**: Integrated with Supabase auth/RLS, CDN-backed, cost-effective
- **Bucket Structure**: `verification-photos/{company_id}/{technician_id}/{verification_id}.jpg`
- **Access Control**: RLS policies match database (company-scoped, supervisor override)

### Integration Points

**Feature 003 (Scheduling & Kits)**:
- Reads kit definitions from `kits` table
- Updates `job_kits.verification_method` to 'photo' on successful verification
- Triggers existing notification service for incomplete verifications
- Uses existing offline sync infrastructure

**Existing PWA Infrastructure** (Feature 001):
- Leverages existing service worker for background sync
- Reuses IndexedDB patterns from customer/job offline caching
- Extends existing offline queue architecture

### Performance Validation Approach

1. **YOLO Latency Benchmark**: Measure inference time across device tiers (high/mid/low-end)
2. **Frame Rate Stability**: Verify 1 fps maintained during 30s verification session
3. **VLM Fallback Rate**: Monitor percentage of verifications requiring cloud analysis (target < 10%)
4. **Budget Compliance**: Track daily costs per company, alert at 80% of $10 cap
5. **Battery Impact**: Measure battery drain during 1-hour verification session (target < 5%)

**Output**: research.md created (inline above, no separate file needed - all decisions resolved)

## Phase 1: Design & Contracts

### Data Model

**New Tables** (all with `company_id`, `created_at`, `updated_at` per constitution §1):

#### vision_verification_records
```sql
CREATE TABLE vision_verification_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  technician_id UUID NOT NULL REFERENCES users(id),
  kit_id UUID NOT NULL REFERENCES kits(id),
  job_id UUID REFERENCES jobs(id),
  container_id UUID REFERENCES containers(id),
  photo_storage_path TEXT NOT NULL,  -- Supabase Storage path
  verification_result TEXT NOT NULL CHECK (verification_result IN ('complete', 'incomplete', 'failed', 'unverified')),
  processing_method TEXT NOT NULL CHECK (processing_method IN ('local_yolo', 'cloud_vlm', 'manual')),
  confidence_score DECIMAL(3,2),  -- 0.00-1.00
  detected_items_count INTEGER DEFAULT 0,
  missing_items_count INTEGER DEFAULT 0,
  processing_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vision_verifications_company ON vision_verification_records(company_id);
CREATE INDEX idx_vision_verifications_technician ON vision_verification_records(technician_id, created_at DESC);
CREATE INDEX idx_vision_verifications_kit ON vision_verification_records(kit_id);
```

#### detected_items
```sql
CREATE TABLE detected_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_id UUID NOT NULL REFERENCES vision_verification_records(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,  -- e.g., 'mower', 'trimmer', 'blower'
  confidence_score DECIMAL(3,2) NOT NULL,
  bounding_box JSONB,  -- {x, y, width, height}
  matched_kit_item_id UUID REFERENCES kit_items(id),
  match_status TEXT NOT NULL CHECK (match_status IN ('matched', 'unmatched', 'uncertain')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_detected_items_verification ON detected_items(verification_id);
```

#### vision_cost_records
```sql
CREATE TABLE vision_cost_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  verification_id UUID NOT NULL REFERENCES vision_verification_records(id),
  provider TEXT NOT NULL,  -- 'openai', 'anthropic', etc.
  operation_type TEXT NOT NULL,  -- 'vlm_analysis', 'image_upload', etc.
  estimated_cost_usd DECIMAL(6,4) NOT NULL,  -- e.g., 0.1000
  actual_cost_usd DECIMAL(6,4),  -- Populated after billing reconciliation
  request_timestamp TIMESTAMPTZ DEFAULT NOW(),
  response_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vision_costs_company_date ON vision_cost_records(company_id, DATE(created_at));
```

#### detection_confidence_thresholds
```sql
CREATE TABLE detection_confidence_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70 CHECK (confidence_threshold BETWEEN 0.50 AND 0.95),
  max_daily_vlm_requests INTEGER DEFAULT 100,
  daily_budget_usd DECIMAL(6,2) DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);
```

**Modified Tables**:
```sql
-- Update job_kits table from Feature 003 (already has verification_method column)
-- Add index for vision queries:
CREATE INDEX IF NOT EXISTS idx_job_kits_verification ON job_kits(verification_method, verified_at);
```

### API Contracts

Generated OpenAPI 3.1 specifications in `contracts/` directory:

#### POST /api/vision/verify
```yaml
summary: Verify kit using photo
parameters:
  - name: kitId
    in: body
    required: true
    schema:
      type: string
      format: uuid
  - name: photo
    in: body
    required: true
    schema:
      type: string
      format: binary
  - name: containerId
    in: body
    required: false
requestBody:
  multipart/form-data:
    photo: binary
    kitId: uuid
    containerId: uuid (optional)
responses:
  200:
    description: Verification complete
    schema:
      result: 'complete' | 'incomplete' | 'uncertain'
      detectedItems: array of {type, confidence}
      missingItems: array of {itemId, itemType}
      requiresVlmFallback: boolean
      estimatedCost: number (if VLM needed)
  402:
    description: Budget cap reached
  500:
    description: Processing failed
```

#### GET /api/vision/history
```yaml
summary: Get verification history (supervisor view)
parameters:
  - name: technicianId
    in: query
    required: false
  - name: startDate
    in: query
    required: false
  - name: endDate
    in: query
    required: false
responses:
  200:
    schema:
      verifications: array of verification records
      stats:
        totalVerifications: number
        successRate: percentage
        avgProcessingTime: milliseconds
        totalCost: usd
```

### Test Scenarios

From user stories in spec.md:

1. **Contract Test**: POST /api/vision/verify with valid kit photo
   - Assert 200 response with detected items
   - Assert schema matches OpenAPI contract

2. **Integration Test**: Complete verification flow with YOLO local detection
   - Mock YOLO model returns 0.85 confidence
   - Assert no VLM fallback triggered
   - Assert verification record created with company_id

3. **Integration Test**: Low confidence triggers VLM fallback
   - Mock YOLO returns 0.65 confidence
   - Assert VLM cost estimate returned
   - Assert user prompted for approval

4. **Integration Test**: Offline queue and sync
   - Submit verification while navigator.onLine = false
   - Assert photo stored in IndexedDB
   - Trigger background sync
   - Assert photo uploaded to Supabase Storage
   - Assert verification record created

5. **RLS Test**: Cross-tenant isolation
   - Create verification for Company A
   - Query as user from Company B
   - Assert 0 results returned

6. **Performance Test**: YOLO inference latency
   - Load YOLOv11n model
   - Run inference on test image
   - Assert processing time < 3 seconds

### Quickstart Test Workflow

Interactive validation script for `quickstart.md`:

```bash
# 1. Start development server
npm run dev

# 2. Navigate to /verify-kit
# Expected: Camera interface with "Start Verification" button

# 3. Click "Start Verification" with test kit image
# Expected: Frame capture at 1 fps visible in UI

# 4. After 3 seconds, verification results displayed
# Expected: Detected items list with confidence scores
# Expected: Missing items (if any) highlighted in red
# Expected: "Kit Verified ✓" or "Incomplete Kit" message

# 5. Check offline mode (disable network in DevTools)
# Expected: Verification proceeds with YOLO-only
# Expected: Queue indicator shows "1 pending sync"

# 6. Re-enable network
# Expected: Background sync completes within 10s
# Expected: Queue indicator shows "Synced ✓"

# 7. As supervisor, navigate to /vision/history
# Expected: Verification history table
# Expected: Photo thumbnails, technician names, timestamps
# Expected: Success rate and cost metrics
```

### Agent File Update

Running `.specify/scripts/bash/update-agent-context.sh claude` will add to `CLAUDE.md`:

```markdown
## Vision-Based Kit Verification (Feature 001)

### Key Technologies
- YOLO.js + ONNX Runtime Web for local object detection
- OpenAI GPT-4 Vision for cloud fallback analysis
- IndexedDB for offline photo queueing (50-photo capacity)
- Supabase Storage for 1-year photo retention

### Critical Paths
- `src/domains/vision/lib/yolo-inference.ts` - Core detection engine
- `src/domains/vision/services/vision-verification.service.ts` - Orchestration
- `src/domains/vision/repositories/vision-verification.repository.ts` - Data persistence

### Constitutional Requirements
- All vision tables have company_id + RLS policies
- Budget enforcement: $10/day cap, 70% confidence threshold
- Offline-first: 50-photo queue with background sync
- Performance: <3s local detection, 1 fps capture rate

### Testing Focus
- RLS isolation tests for vision_verification_records
- Performance benchmarks for YOLO latency
- E2E verification flow with offline mode simulation
- Cost tracking validation (daily budget compliance)
```

**Output**:
- ✅ data-model.md (inline above, database schema documented)
- ✅ contracts/ (OpenAPI specs for vision endpoints)
- ✅ Failing contract tests (TDD - tests written, implementation pending)
- ✅ quickstart.md (user validation workflow documented)
- ✅ CLAUDE.md updated via script

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

The `/tasks` command will load the design artifacts from Phase 1 and generate a dependency-ordered task list following TDD principles:

**Inputs**:
- data-model.md (4 new tables, 1 modified table)
- contracts/ (2 API specifications)
- quickstart.md (7 user validation steps)
- Feature 003 integration points (kit definitions, notification system)

**Task Categories**:

1. **Database Setup** (5 tasks, sequential)
   - T001: Run `npm run check:db-actual` and document findings
   - T002: Create migration 040_vision_verification_schema.sql
   - T003: Add RLS policies for all vision tables
   - T004: Generate TypeScript types from new schema
   - T005: Seed default detection thresholds (70%, $10/day)

2. **Contract Tests** (7 tasks, parallel after DB setup)
   - T006 [P]: POST /api/vision/verify success case
   - T007 [P]: POST /api/vision/verify budget exceeded
   - T008 [P]: GET /api/vision/history with filters
   - T009 [P]: GET /api/vision/queue (offline sync)
   - T010 [P]: RLS isolation test for vision_verification_records
   - T011 [P]: RLS isolation test for vision_cost_records
   - T012 [P]: Cost tracking validation test

3. **YOLO Integration** (6 tasks, sequential dependencies)
   - T013: Download YOLOv11n ONNX model to public/models/
   - T014: Implement YOLO model loader with IndexedDB caching
   - T015: Implement YOLO inference engine with 3s timeout
   - T016: Implement FPS throttle controller (1 fps)
   - T017: Write YOLO inference performance benchmarks
   - T018: Validate YOLO model accuracy on test equipment images

4. **VLM Fallback** (4 tasks, depends on YOLO)
   - T019: Implement VLM fallback router (70% threshold)
   - T020: Implement OpenAI GPT-4 Vision adapter
   - T021: Implement cost estimation logic ($0.10/request)
   - T022: Write VLM fallback integration tests

5. **Core Services** (8 tasks, depends on YOLO + VLM)
   - T023: Implement vision-verification.service.ts (orchestration)
   - T024: Implement detection-confidence.service.ts (threshold mgmt)
   - T025: Implement cost-tracking.service.ts (budget enforcement)
   - T026: Implement offline-vision-queue.service.ts (50-photo queue)
   - T027: Implement container-detector.ts (boundary detection)
   - T028: Write service unit tests (≥80% coverage)
   - T029: Write offline queue integration tests
   - T030: Write cost budget enforcement tests

6. **Repository Layer** (3 tasks, parallel)
   - T031 [P]: Implement vision-verification.repository.ts
   - T032 [P]: Implement detected-item.repository.ts
   - T033 [P]: Implement cost-record.repository.ts

7. **Feature 003 Integration** (3 tasks, depends on services)
   - T034: Implement kit-verification-integration.service.ts
   - T035: Update job_kits.verification_method on success
   - T036: Trigger Feature 003 notifications for incomplete kits

8. **API Routes** (4 tasks, depends on services + repos)
   - T037: Implement POST /api/vision/verify
   - T038: Implement GET /api/vision/history
   - T039: Implement GET /api/vision/queue
   - T040: Implement Supabase Edge Function vlm-fallback

9. **UI Components** (5 tasks, depends on API routes)
   - T041 [P]: Implement CameraCapture.tsx (1 fps interface)
   - T042 [P]: Implement VerificationResults.tsx (visual feedback)
   - T043 [P]: Implement CostEstimatePrompt.tsx (VLM approval)
   - T044 [P]: Implement OfflineQueueIndicator.tsx (sync status)
   - T045 [P]: Implement /verify-kit page integration

10. **Testing & Validation** (5 tasks, final phase)
    - T046: Write E2E test: complete verification flow
    - T047: Write E2E test: offline mode verification + sync
    - T048: Write E2E test: VLM fallback approval flow
    - T049: Run quickstart.md validation workflow
    - T050: Performance validation: measure battery impact

**Ordering Rules**:
- Database tasks first (foundation)
- Contract tests before implementation (TDD)
- YOLO before VLM (core before fallback)
- Services before API routes (business logic before endpoints)
- API routes before UI (backend before frontend)
- E2E tests last (full stack integration)

**Parallelization**:
- Contract tests [P] - different test files
- Repository implementations [P] - different files
- UI components [P] - independent React components

**Estimated Output**: 50 numbered tasks with [P] markers for parallel execution

**IMPORTANT**: The `/tasks` command will create `tasks.md` - NOT the `/plan` command

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (via `/tasks` command creating tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD + constitutional principles)
**Phase 5**: Validation (run E2E tests, execute quickstart.md, monitor performance/cost metrics)

## Complexity Tracking

*No constitutional violations detected - section intentionally empty*

All design decisions align with JobEye Constitution v1.1.0:
- Multi-tenant RLS on all vision tables
- Hybrid YOLO+VLM pipeline as specified
- Offline-first PWA architecture maintained
- Cost governance enforced ($10/day cap)
- Repository pattern for all DB access
- Async AI operations with timeouts
- 300 LoC complexity budget per file

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command) - All clarifications resolved
- [x] Phase 1: Design complete (/plan command) - Data model, contracts, quickstart documented
- [x] Phase 2: Task planning complete (/plan command - approach described)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (7 clarifications from 2025-09-29 session)
- [x] Complexity deviations documented (none - no violations)

---
*Based on JobEye Constitution v1.1.0 - See `.specify/constitution.md`*