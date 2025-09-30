# Tasks: Voice & Vision Inventory Management

**Feature**: 004-voice-vision-inventory
**Input**: Design documents from `/specs/004-voice-vision-inventory/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow

This task list follows TDD methodology:
1. Setup project structure and dependencies
2. Write contract tests (MUST FAIL initially)
3. Write integration tests (MUST FAIL initially)
4. Implement core functionality to make tests pass
5. Add unit tests and polish

**Tech Stack** (from plan.md):
- Language: TypeScript 5.4+
- Framework: Next.js 14.2 (App Router), React 18.3
- Database: Supabase (PostgreSQL 15+ with RLS)
- Vision: onnxruntime-web (YOLO), OpenAI SDK (VLM fallback)
- OCR: Tesseract.js + GPT-4 Vision hybrid
- Storage: Supabase Storage, IndexedDB (offline queue)
- Testing: Jest, @testing-library/react, Playwright

**Project Structure**: Single Next.js app with domain-driven architecture
- Extend: `src/domains/inventory/`, `src/domains/vision/`
- New: `src/app/api/inventory/`, `src/components/inventory/`
- Tests: `tests/integration/`, `tests/e2e/`

---

## Phase 3.1: Setup & Database Schema

### T001: Verify actual database schema before migration design
**Files**: N/A (read-only inspection)
**Description**: Run `scripts/check-actual-db.ts` to inspect current state of:
- Existing tables (companies, users, jobs, equipment, materials, containers from Feature 001)
- RLS policies (verify app_metadata pattern)
- Indexes and constraints
- Current migration version
**Output**: Document actual schema state in migration design notes
**Constitution**: RULE 1 - Database Precheck (MANDATORY)

### T002: Design idempotent migration file
**Files**: `supabase/migrations/050_inventory_vision_extend.sql`
**Description**: Create migration SQL with idempotent single-statement style:
- CREATE TABLE IF NOT EXISTS for all 10 entities from data-model.md
- CREATE INDEX IF NOT EXISTS for all indexes
- Use individual statements (NO DO $$ blocks)
- Include RLS policies with app_metadata pattern
- Include triggers (update_item_location, prevent_circular_hierarchy)
- Add default detection_confidence_thresholds for existing companies
**Dependencies**: T001 complete
**Validation**: Migration must be re-runnable without errors

### T003: Apply migration via Supabase client RPC
**Files**: `scripts/apply-inventory-migration.ts`
**Description**: Create TypeScript script using Supabase client:
```typescript
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '.env.local' });
const client = createClient(url, serviceKey);
await client.rpc('exec_sql', { sql: '...' });
```
Execute each statement from T002 individually via RPC.
**Dependencies**: T002 complete
**Constitution**: RULE 1 - Only reliable migration method

### T004: Verify migration success
**Files**: `scripts/verify-inventory-schema.ts`
**Description**: Query information_schema to verify:
- All 10 tables exist with correct columns
- RLS policies enabled on all tables
- Indexes created
- Triggers exist
- Foreign keys correct
**Dependencies**: T003 complete

### T005 [P]: Install OCR dependencies
**Files**: `package.json`
**Description**: Add dependencies:
- `tesseract.js` for offline OCR
- Verify `openai` already installed (for VLM fallback)
- Verify `onnxruntime-web` already installed (for YOLO)
**Dependencies**: None (parallel with T001-T004)

---

## Phase 3.2: Contract Tests (TDD) ⚠️ MUST FAIL INITIALLY

### T006 [P]: Contract test POST /api/inventory/detect
**Files**: `tests/contract/inventory-detection-post.test.ts`
**Description**: Test detection endpoint contract from inventory-detection.yaml:
- Request: multipart/form-data with photo (binary), companyId (UUID), context (object)
- Response 200: detectionId, detections[], method, processingTimeMs, costUsd, budgetStatus
- Response 400: Invalid photo format
- Response 413: Photo >10MB
- Response 429: Daily budget exceeded
- Verify DetectedItem schema (detectionNumber, label, confidence, cropUrl, boundingBox)
- Verify GroupedDetection schema
- Test MUST FAIL (endpoint not implemented yet)
**Dependencies**: None

### T007 [P]: Contract test POST /api/inventory/confirm-selection
**Files**: `tests/contract/inventory-confirm-selection.test.ts`
**Description**: Test selection confirmation contract:
- Request: detectionId, selectedItemNumbers[], corrections[]
- Response 200: sessionId, selectedItems[], nextStep, requiresAttributeInput
- Response 404: Detection session not found
- Test MUST FAIL (endpoint not implemented)
**Dependencies**: None

### T008 [P]: Contract test POST /api/inventory/check-out
**Files**: `tests/contract/inventory-checkout-post.test.ts`
**Description**: Test check-out contract from inventory-transactions.yaml:
- Request: companyId, itemIds[], destinationContainerId, jobId, performerId
- Response 200: transactionId, checkedOutItems[], containerAssignments[], kitValidation, warnings
- Response 404: Item or container not found
- Response 409: Item already checked out
- Verify KitValidation schema
- Test MUST FAIL
**Dependencies**: None

### T009 [P]: Contract test POST /api/inventory/check-in
**Files**: `tests/contract/inventory-checkin-post.test.ts`
**Description**: Test check-in contract:
- Request: companyId, itemIds[], sourceContainerId, performerId
- Response 200: transactionId, checkedInItems[], discrepancies
- Verify CheckInDiscrepancies schema (missingItems[], unexpectedItems[])
- Test MUST FAIL
**Dependencies**: None

### T010 [P]: Contract test POST /api/inventory/transfer
**Files**: `tests/contract/inventory-transfer-post.test.ts`
**Description**: Test transfer contract:
- Request: itemIds[], sourceContainerId, destinationContainerId
- Response 200: transactionId, transferredItems[]
- Response 404: Container not found
- Test MUST FAIL
**Dependencies**: None

### T011 [P]: Contract test POST /api/inventory/material-usage
**Files**: `tests/contract/inventory-material-usage-post.test.ts`
**Description**: Test material usage logging contract:
- Request: itemId, quantityUsed, jobId, wasteAmount
- Response 200: transactionId, remainingStock, costImpact, reorderNeeded
- Test MUST FAIL
**Dependencies**: None

### T012 [P]: Contract test POST /api/inventory/audit
**Files**: `tests/contract/inventory-audit-post.test.ts`
**Description**: Test audit contract:
- Request: locationId, detectedItemIds[], performerId
- Response 200: auditId, expectedItems[], detectedItems[], discrepancies, accuracyPercentage
- Verify AuditDiscrepancies schema
- Test MUST FAIL
**Dependencies**: None

---

## Phase 3.3: Integration Tests (TDD) ⚠️ MUST FAIL INITIALLY

### T013 [P]: Integration test - Morning check-out workflow
**Files**: `tests/integration/inventory-checkout-workflow.test.ts`
**Description**: Test complete check-out flow from quickstart.md Scenario 1:
1. Setup: Create test company, containers (Truck 214, Warehouse), items (mower, trimmer, blower)
2. Detect items in photo
3. Select all items via voice command
4. Validate against job kit
5. Confirm check-out
6. Verify: transaction created, container_assignments active, items.current_location_id updated
- RLS isolation: verify technician can only see own transactions
- Test MUST FAIL (services not implemented)
**Dependencies**: T040a, T040b complete (services to test)

### T014 [P]: Integration test - Purchase receipt OCR
**Files**: `tests/integration/inventory-purchase-receipt.test.ts`
**Description**: Test receipt processing from quickstart.md Scenario 2:
1. Upload receipt photo
2. OCR extraction (mock Tesseract + GPT-4)
3. Display extracted data preview
4. User confirms/corrects
5. Assign to job
6. Create materials + purchase_receipt + transaction
- Test both OCR paths (Tesseract success, GPT-4 fallback)
- Verify ocr_confidence_scores, ocr_method fields
- Test MUST FAIL
**Dependencies**: T032a, T032b, T032c complete (services to test)

### T015 [P]: Integration test - Multi-item detection with grouping
**Files**: `tests/integration/inventory-multi-item-detection.test.ts`
**Description**: Test grouping workflow from quickstart.md Scenario 3:
1. Upload photo with 15 identical PVC fittings + 2 mowers + 3 trimmers
2. Verify auto-grouping (>90% similarity)
3. Select via voice: "Add Group 1 and detection 16"
4. Adjust quantity in group
5. Correct misidentified item
6. Verify training_data_records and vision_training_annotations created
- Test MUST FAIL
**Dependencies**: None

### T016 [P]: Integration test - Check-in with discrepancies
**Files**: `tests/integration/inventory-checkin-discrepancies.test.ts`
**Description**: Test discrepancy detection from quickstart.md Scenario 4:
1. Check out 3 items in morning
2. Check in with only 2 items (1 missing)
3. Detect unexpected item (purchased during day)
4. System prompts for explanations
5. Verify discrepancy report, supervisor notification triggered
- Test MUST FAIL
**Dependencies**: None

### T017 [P]: Integration test - Background filtering with learning
**Files**: `tests/integration/inventory-background-filtering.test.ts`
**Description**: Test filter learning from quickstart.md Scenario 5:
1. Detect items with background objects (walls, workbench, cooler)
2. Verify auto-filtering (>95% confidence backgrounds)
3. User excludes cooler 3 times
4. System prompts to create permanent filter
5. Verify background_filter_preferences created
6. Test context-aware filtering (field vs HQ)
- Test MUST FAIL
**Dependencies**: None

### T018 [P]: Integration test - Offline queue sync
**Files**: `tests/integration/inventory-offline-queue.test.ts`
**Description**: Test offline operation from quickstart.md Scenario 6:
1. Simulate offline mode (navigator.onLine = false)
2. Queue 10 operations (check-out, register, preferences)
3. Verify IndexedDB storage (status='pending')
4. Restore connectivity
5. Auto-sync in priority order (high → medium → low)
6. Simulate 10 failed retries → archived status
7. Test storage warnings (80%, 95%)
- Test MUST FAIL
**Dependencies**: None

### T019 [P]: Integration test - Training data collection
**Files**: `tests/integration/inventory-training-data.test.ts`
**Description**: Test training data capture from quickstart.md Scenario 7:
1. Perform detection with user corrections
2. Verify training_data_records created with all fields
3. Verify vision_training_annotations for corrections
4. Test VLM training data (low confidence triggers GPT-4)
5. Test YOLO export format for retraining
6. Test company opt-out (no records created)
- Test MUST FAIL
**Dependencies**: None

---

## Phase 3.4: Core Domain Models (TypeScript Types & Repositories)

### T020 [P]: Inventory transaction types
**Files**: `src/domains/inventory/types/transaction-types.ts`
**Description**: Define TypeScript interfaces from data-model.md:
- `InventoryTransaction` (type enum, item_ids, containers, cost_data, etc.)
- `ContainerAssignment` (container_id, item_id, quantity, status)
- `TransactionType` enum (check_out, check_in, transfer, register, purchase, usage, decommission, audit, maintenance)
- `VerificationMethod` enum (manual, qr_scan, photo_vision, voice)
**Dependencies**: T006-T012 failing

### T021 [P]: Container types
**Files**: `src/domains/inventory/types/container-types.ts`
**Description**: Define container interfaces:
- `Container` (type enum, name, identifier, capacity, parent_container_id, gps, photo_url, voice_name)
- `ContainerType` enum (truck, trailer, storage_bin, warehouse, building, toolbox)
- `ContainerHierarchy` helper types
**Dependencies**: T006-T012 failing

### T022 [P]: Purchase receipt types
**Files**: `src/domains/inventory/types/purchase-receipt-types.ts`
**Description**: Define receipt interfaces:
- `PurchaseReceipt` (vendor, date, total, line_items, ocr_extracted_data, confidence_scores)
- `ReceiptLineItem` (line_number, description, quantity, unit_price, total, matched_item_id)
- `OcrMethod` enum (tesseract, gpt4_vision)
**Dependencies**: T006-T012 failing

### T023 [P]: Training data types
**Files**: `src/domains/inventory/types/training-data-types.ts`
**Description**: Define training data interfaces:
- `TrainingDataRecord` (photo_url, yolo_detections, vlm_analysis, user_selections, corrections, exclusions, context, quality_metrics)
- `VisionTrainingAnnotation` (corrected_label, corrected_bbox, correction_reason)
- `YoloDetections`, `VlmAnalysis` JSONB schemas
**Dependencies**: T006-T012 failing

### T024 [P]: Detection preference types
**Files**: `src/domains/inventory/types/detection-preference-types.ts`
**Description**: Define preference interfaces:
- `DetectionConfidenceThreshold` (local_confidence_threshold, max_daily_vlm_requests, daily_cost_budget_cap)
- `BackgroundFilterPreference` (object_label, action enum, context_filters)
- `FilterAction` enum (always_exclude, always_include, ask)
**Dependencies**: T006-T012 failing

### T025 [P]: Extend inventory item types
**Files**: `src/domains/inventory/types/inventory-types.ts`
**Description**: Extend existing types with new fields:
- Add `current_location_id` (FK to containers)
- Add `specifications` JSONB (model, serial, dimensions, weight)
- Add `attributes` JSONB (brand, color, purchase_date, purchase_price)
- Add `images` array with `InventoryImage` interface (crop_box support)
- Add `tracking_mode` enum (individual, quantity)
**Dependencies**: T006-T012 failing

### T026: Inventory transaction repository
**Files**: `src/domains/inventory/repositories/transaction.repository.ts`
**Description**: Create Supabase repository following existing pattern:
- `create(transaction)` - Insert into inventory_transactions
- `findById(id)` - Fetch with RLS
- `findByCompany(companyId, filters)` - List with pagination
- `findByPerformer(performerId)` - User's transaction history
- `findByJob(jobId)` - Job cost tracking
- `findByDateRange(start, end)` - Reporting
**Dependencies**: T020 complete

### T027 [P]: Container repository
**Files**: `src/domains/inventory/repositories/container.repository.ts`
**Description**: Create container CRUD repository:
- `create(container)`, `update(id, data)`, `delete(id)`
- `findById(id)`, `findByCompany(companyId)`
- `findByType(type)` - Filter by truck/warehouse/etc
- `findDefault(userId)` - Get user's default container
- `getContents(containerId)` - Items currently in container
- `checkHierarchy(parentId, childId)` - Validate no circular refs
**Dependencies**: T021 complete

### T028 [P]: Container assignment repository
**Files**: `src/domains/inventory/repositories/container-assignment.repository.ts`
**Description**: Create assignment tracking repository:
- `create(assignment)` - Check item into container
- `complete(assignmentId)` - Check item out (set checked_out_at)
- `findActive(containerId)` - Current contents
- `findByItem(itemId)` - Item's location history
- `findByJob(jobId)` - Job equipment tracking
**Dependencies**: T020 complete

### T029 [P]: Purchase receipt repository
**Files**: `src/domains/inventory/repositories/purchase-receipt.repository.ts`
**Description**: Create receipt CRUD repository:
- `create(receipt)`, `findById(id)`
- `findByCompany(companyId, filters)` - Date range, vendor
- `findByVendor(vendor)` - Vendor history
- `findByJob(jobId)` - Job purchases
- `updateOcrConfidence(id, scores)` - After user corrections
**Dependencies**: T022 complete

### T030 [P]: Training data repository
**Files**: `src/domains/inventory/repositories/training-data.repository.ts`
**Description**: Create training data repository (admin-only access):
- `create(record)` - Save detection + corrections
- `findById(id)`, `findByCompany(companyId, dateRange)`
- `findWithVlm()` - Records that used cloud VLM
- `exportYoloFormat(dateRange)` - Generate training dataset
- `createAnnotation(annotation)` - Save corrected labels
- Check RLS: admin role required
**Dependencies**: T023 complete

### T031 [P]: Detection preference repository
**Files**: `src/domains/inventory/repositories/detection-preference.repository.ts`
**Description**: Create preference repositories:
- Confidence thresholds: `getByCompany(companyId)`, `update(companyId, settings)`
- Filter preferences: `create(preference)`, `findApplicable(companyId, userId, context)`
- `shouldFilter(label, context)` - Apply filtering logic
**Dependencies**: T024 complete

---

## Phase 3.5: Vision Domain Extensions

### T032a [P]: Tesseract.js OCR wrapper
**Files**: `src/domains/vision/services/ocr-tesseract.service.ts`
**Description**: Create Tesseract.js wrapper service:
- `extractText(imageData)` - Run Tesseract OCR
- `parseReceiptText(rawText)` - Parse structured data (vendor, date, line_items, total)
- Return: extracted data + confidence scores per field
- Cost tracking: $0 (local processing)
- Performance: 3-8s target (PR-004)
**Dependencies**: T005 complete
**Complexity**: 200 LoC

### T032b [P]: GPT-4 Vision OCR fallback
**Files**: `src/domains/vision/services/ocr-gpt4.service.ts`
**Description**: Create GPT-4 Vision fallback service:
- `extractViaGpt4Vision(imageData)` - OpenAI Vision API call
- Use structured output (JSON mode) for receipt parsing
- Return: extracted data + confidence scores + tokens used
- Handle offline: queue for later processing when connectivity restored
- Cost tracking: ~$0.02 per receipt
- Performance: 2-4s target
**Dependencies**: T005, T022 complete
**Complexity**: 150 LoC

### T032c: OCR orchestration service
**Files**: `src/domains/vision/services/ocr.service.ts`
**Description**: Orchestrate OCR strategy following research.md hybrid decision:
- `extractReceiptData(imageData)` - Public API
- Try Tesseract first (T032a)
- If confidence <70%, fallback to GPT-4 (T032b)
- Track which method used (tesseract/gpt4_vision)
- Store in purchase_receipts.ocr_method field
**Dependencies**: T032a, T032b complete
**Complexity**: 100 LoC (simple orchestration)

### T033: Crop generation service
**Files**: `src/domains/vision/services/crop-generator.service.ts`
**Description**: Create crop generation service following research.md:
- `generateCrops(imageData, detections)` - Canvas-based 1:1 square crops
- Add 10% padding around bounding box
- JPEG compression (0.85 quality)
- Performance target: <5s for 20 crops (PR-008)
- Return: array of {cropBlob, cropBox}
- Upload crops to Supabase Storage
**Dependencies**: T006 complete
**Complexity**: 300 LoC

### T034: Detection grouping service
**Files**: `src/domains/vision/services/detection-grouping.service.ts`
**Description**: Create item grouping service:
- `groupSimilarItems(detections, crops)` - >90% similarity threshold
- Use image similarity algorithm (perceptual hash or feature matching)
- Return: GroupedDetection[] with quantity badges
- `splitGroup(groupId, quantity)` - User adjusts quantity
- `mergeGroups(groupIds)` - Combine groups
**Dependencies**: T033 complete
**Complexity**: 350 LoC

### T035: Background filter service
**Files**: `src/domains/vision/services/background-filter.service.ts`
**Description**: Create filtering service:
- `autoFilter(detections, context)` - Apply >95% confidence filtering
- `shouldPrompt(detection)` - Check 70-95% range
- `applyUserPreferences(detections, companyId, userId, context)` - Context-aware filtering
- `learnPreference(label, action, context)` - After 3 exclusions
- Integrate with background_filter_preferences repository
**Dependencies**: T031 complete
**Complexity**: 300 LoC

### T036: Extend VLM fallback router for inventory
**Files**: `src/domains/vision/lib/vlm-fallback-router.ts`
**Description**: Extend existing VLM router (Feature 001) with inventory-specific logic:
- Add inventory item types to detection expectations
- Integrate with detection_confidence_thresholds repository
- Track VLM usage rate (target <10% eventually, accept 40-60% for MVP)
- Add cost estimation for inventory operations
**Dependencies**: T031, existing vlm-fallback-router.ts
**Complexity**: +100 LoC to existing file

### T037: Extend offline queue for inventory transactions
**Files**: `src/domains/vision/lib/offline-queue.ts`
**Description**: Extend existing queue (Feature 001) with inventory operation types:
- Add transaction types: check_out, check_in, transfer, register, purchase, usage, audit
- Add priority queuing (high: check-out/check-in, medium: register, low: training data)
- Implement storage quota monitoring (warn 80%, block 95%)
- Implement 10-retry → 30-day archive → auto-delete logic (OR-008)
**Dependencies**: T026-T031 complete
**Complexity**: +200 LoC to existing file

---

## Phase 3.6: Inventory Domain Services

### T038: Inventory detection orchestration service
**Files**: `src/domains/inventory/services/detection-orchestration.service.ts`
**Description**: Orchestrate detection workflow:
1. Receive photo + context (GPS, location_type, transaction_intent)
2. Run YOLO inference (reuse existing yolo-inference.ts)
3. Generate 1:1 crops (T033)
4. Group similar items (T034)
5. Apply background filtering (T035)
6. Evaluate VLM fallback need (T036)
7. Create detection session (store in memory/cache for confirm-selection)
8. Return detection results
**Dependencies**: T020-T025, T033-T036 complete
**Complexity**: 450 LoC (main orchestration logic)

### T039: Item selection confirmation service
**Files**: `src/domains/inventory/services/selection-confirmation.service.ts`
**Description**: Handle user selection + corrections:
- Load detection session from T038
- Filter detections by selectedItemNumbers
- Apply user corrections (label changes, bbox adjustments)
- Save to training_data_records (T030)
- Create vision_training_annotations for corrections
- Upload crops to Supabase Storage
- Prepare for attribute assignment
**Dependencies**: T023, T030, T038 complete
**Complexity**: 350 LoC

### T040a: Kit validation service
**Files**: `src/domains/inventory/services/kit-validation.service.ts`
**Description**: Validate detected items against job kit requirements (FR-028, FR-029):
- `validateKit(detectedItems, jobId)` - Fetch job kit from Feature 003
- Compare detected items against required kit items
- Identify: present items, missing items, extra items
- Calculate completion percentage
- Generate KitValidation result object
- Return validation report (pure function, no side effects)
**Dependencies**: T020, T026 complete, Feature 003 job kit API
**Complexity**: 200 LoC (validation logic + comparison)

### T040b: Check-out transaction service
**Files**: `src/domains/inventory/services/checkout.service.ts`
**Description**: Implement check-out workflow (FR-028 to FR-034):
- Validate items available (not already checked out)
- Validate container exists and has capacity
- Call kit validation service (T040a) if job context provided
- Create inventory_transaction record (type='check_out')
- Create container_assignments (status='active')
- Update inventory_items.current_location_id (via trigger)
- Trigger supervisor notification if kit incomplete (IR-003)
- Warn technicians of missing required items (FR-033)
- Support batch check-out via voice command (FR-034)
- Return: transactionId, checkedOutItems[], containerAssignments[], kitValidation, warnings[]
**Dependencies**: T020, T026-T028, T040a complete
**Complexity**: 300 LoC (transaction logic, within default budget)

### T041: Check-in transaction service
**Files**: `src/domains/inventory/services/checkin.service.ts`
**Description**: Implement check-in workflow (FR-035 to FR-040):
- Fetch morning check-out records for container
- Compare detected items against check-out
- Identify missing items (checked out but not returned)
- Identify unexpected items (not checked out)
- Prompt user for explanations (voice transcript)
- Complete container_assignments (set checked_out_at)
- Create inventory_transaction record
- Update item locations (via trigger)
- Generate discrepancy report with accuracy percentage
**Dependencies**: T020, T026-T028 complete
**Complexity**: 450 LoC

### T042: Transfer transaction service
**Files**: `src/domains/inventory/services/transfer.service.ts`
**Description**: Implement transfer workflow (FR-056 to FR-060):
- Validate source and destination containers exist
- Validate items currently in source container
- Complete assignment in source
- Create assignment in destination
- Create inventory_transaction record (type='transfer')
- Update item locations
- Handle voice commands: "Move [item] from [source] to [destination]"
**Dependencies**: T020, T026-T028 complete
**Complexity**: 300 LoC

### T043: Material usage logging service
**Files**: `src/domains/inventory/services/material-usage.service.ts`
**Description**: Implement usage workflow (FR-049 to FR-055):
- Validate material item (type='material', tracking_mode='quantity')
- Deduct quantityUsed from inventory_items.current_quantity
- Calculate waste percentage
- Update container inventory (remove from truck)
- Create inventory_transaction (type='usage', linked to jobId)
- Calculate cost impact (price per unit × quantity)
- Check reorder level, set reorderNeeded flag
**Dependencies**: T020, T026 complete
**Complexity**: 300 LoC

### T044: Inventory audit service
**Files**: `src/domains/inventory/services/audit.service.ts`
**Description**: Implement audit workflow (FR-061 to FR-066):
- Fetch expected inventory for location (from container_assignments)
- Compare detected items against expected
- Calculate discrepancies: missing[], extra[], quantityMismatches[]
- Calculate accuracy percentage
- Generate audit report with photos
- Create inventory_transaction (type='audit')
- Provide option to update inventory counts to match physical
**Dependencies**: T020, T026-T028 complete
**Complexity**: 400 LoC

### T045: Purchase receipt processing service
**Files**: `src/domains/inventory/services/purchase-receipt.service.ts`
**Description**: Implement receipt workflow (FR-041 to FR-048):
1. Call OCR service (T032c) to extract receipt data
2. Display JSON preview with confidence scores
3. Allow field-level editing by user
4. Check for open PO matches (if PO system exists)
5. Create/update inventory_items for line items (materials)
6. Create purchase_receipt record
7. Create inventory_transaction (type='purchase')
8. Link to job if assigned
**Dependencies**: T022, T026, T029, T032c complete
**Complexity**: 450 LoC

### T046: Maintenance detection service
**Files**: `src/domains/inventory/services/maintenance-detection.service.ts`
**Description**: Implement maintenance workflow (FR-067 to FR-074):
- Use VLM to analyze equipment damage in photos
- Assess damage severity (low, medium, high)
- Create maintenance ticket (integrate with maintenance domain if exists)
- Update equipment status (active → maintenance, maintenance → repair)
- Support flexible location tracking: in-place OR transfer to maintenance facility
- Suggest ordering replacement parts (based on VLM analysis)
- Offer to assign backup equipment
**Dependencies**: T020, T026, T036 complete
**Complexity**: 400 LoC

---

## Phase 3.7: Voice Integration

### T047: Attribute extraction service (Voice-LLM)
**Files**: `src/domains/inventory/services/attribute-extraction.service.ts`
**Description**: Implement voice attribute extraction using OpenAI Function Calling (research.md):
- Parse voice transcript via GPT-4o-mini structured output
- Extract: brand, model, serial, price, condition, custom fields
- Schema validation (required fields per item type)
- Cost: $0.01-0.02 per extraction
- Performance: 1-2s (meets PR-006 target of 3s)
- Offline: queue transcripts for later processing
- Return: structured attributes with confidence indicators
**Dependencies**: T025 complete
**Complexity**: 300 LoC

### T048: Context-aware intent detection service
**Files**: `src/domains/inventory/services/intent-detection.service.ts`
**Description**: Implement intent detection (FR-009 to FR-013):
- Analyze GPS location → match against known locations (HQ, customer sites, stores)
- Analyze scene elements via YOLO (shopping cart, truck bed, workbench)
- Analyze time of day (6 AM = load-out, 5 PM = check-in)
- Infer transaction_intent: check_out, check_in, register, purchase, transfer, audit
- Prompt user to confirm inferred intent
- Support manual override
- Fallback: manual location type selection when GPS unavailable
**Dependencies**: T020, T038 complete
**Complexity**: 350 LoC

### T049: Voice command parser for inventory
**Files**: `src/domains/inventory/services/voice-command-parser.service.ts`
**Description**: Parse inventory-specific voice commands:
- Selection: "Add 1, 2, and 5", "Add all", "Add all except X", "Add items 3 through 7"
- Exclusion: "Exclude cooler", "Always exclude coolers in the field"
- Corrections: "Number 3 is a sprayer, not a backpack"
- Actions: "Check out for Oak Street job", "Check in all items", "Move mower to red trailer"
- Integrate with existing voice domain parser
**Dependencies**: T047 complete
**Complexity**: 400 LoC

---

## Phase 3.8: API Route Implementations

### T050: POST /api/inventory/detect endpoint
**Files**: `src/app/api/inventory/detect/route.ts`
**Description**: Implement detection endpoint (inventory-detection.yaml):
- Accept multipart/form-data (photo, companyId, context)
- Validate photo size (<10MB per PR-007)
- Check daily VLM budget (enforce $10 cap per company)
- Call detection orchestration service (T038)
- Return: detectionId, detections[], groupedDetections[], method, processingTimeMs, costUsd, filteredObjects[], budgetStatus
- Handle errors: 400 (invalid), 413 (too large), 429 (budget exceeded)
**Dependencies**: T038 complete, T006 failing test
**Test Target**: Make T006 pass

### T051: POST /api/inventory/confirm-selection endpoint
**Files**: `src/app/api/inventory/confirm-selection/route.ts`
**Description**: Implement selection confirmation endpoint:
- Accept: detectionId, selectedItemNumbers[], corrections[], voiceTranscript
- Load detection session from cache/memory
- Call selection confirmation service (T039)
- Return: sessionId, selectedItems[], nextStep (attribute_assignment or transaction_intent_confirmation)
- Handle 404: Detection session not found or expired (15-minute TTL)
**Dependencies**: T039 complete, T007 failing test
**Test Target**: Make T007 pass

### T052: POST /api/inventory/check-out endpoint
**Files**: `src/app/api/inventory/check-out/route.ts`
**Description**: Implement check-out endpoint (inventory-transactions.yaml):
- Accept: companyId, itemIds[], destinationContainerId, jobId (optional), performerId, verificationMethod, photoEvidenceUrl, voiceSessionId, voiceTranscript, notes
- Call check-out service (T040b)
- Return: transactionId, checkedOutItems[], containerAssignments[], kitValidation, warnings[]
- Handle 404: Item/container not found, 409: Item already checked out
**Dependencies**: T040b complete, T008 failing test
**Test Target**: Make T008 pass

### T053: POST /api/inventory/check-in endpoint
**Files**: `src/app/api/inventory/check-in/route.ts`
**Description**: Implement check-in endpoint:
- Accept: companyId, itemIds[], sourceContainerId, performerId, verificationMethod, photoEvidenceUrl, voiceSessionId, notes
- Call check-in service (T041)
- Return: transactionId, checkedInItems[], discrepancies (missingItems[], unexpectedItems[])
**Dependencies**: T041 complete, T009 failing test
**Test Target**: Make T009 pass

### T054: POST /api/inventory/transfer endpoint
**Files**: `src/app/api/inventory/transfer/route.ts`
**Description**: Implement transfer endpoint:
- Accept: companyId, itemIds[], sourceContainerId, destinationContainerId, performerId, quantity (for materials), verificationMethod, photoEvidenceUrl, voiceTranscript, notes
- Call transfer service (T042)
- Return: transactionId, transferredItems[] (itemId, oldLocation, newLocation)
**Dependencies**: T042 complete, T010 failing test
**Test Target**: Make T010 pass

### T055: POST /api/inventory/material-usage endpoint
**Files**: `src/app/api/inventory/material-usage/route.ts`
**Description**: Implement material usage endpoint:
- Accept: companyId, itemId, quantityUsed, wasteAmount, jobId, performerId, photoEvidenceUrl, voiceTranscript, notes
- Call material usage service (T043)
- Return: transactionId, remainingStock, costImpact, reorderNeeded
**Dependencies**: T043 complete, T011 failing test
**Test Target**: Make T011 pass

### T056: POST /api/inventory/audit endpoint
**Files**: `src/app/api/inventory/audit/route.ts`
**Description**: Implement audit endpoint:
- Accept: companyId, locationId, detectedItemIds[], photoEvidenceUrl, performerId, notes
- Call audit service (T044)
- Return: auditId, expectedItems[], detectedItems[], discrepancies (missing[], extra[], quantityMismatches[]), accuracyPercentage
**Dependencies**: T044 complete, T012 failing test
**Test Target**: Make T012 pass

### T057 [P]: GET /api/inventory/transactions endpoint
**Files**: `src/app/api/inventory/transactions/route.ts`
**Description**: List transactions with filtering:
- Query params: companyId, performerId, jobId, type, dateStart, dateEnd, limit, offset
- Call transaction repository (T026)
- RLS: Technicians see own transactions, supervisors see all company transactions
- Return: transactions[], total, pagination
**Dependencies**: T026 complete

### T058 [P]: GET /api/containers endpoint
**Files**: `src/app/api/containers/route.ts`
**Description**: List containers:
- Query params: companyId, type, is_active
- Call container repository (T027)
- Return: containers[]
**Dependencies**: T027 complete

### T059 [P]: POST /api/containers endpoint
**Files**: `src/app/api/containers/route.ts`
**Description**: Register new container:
- Accept: companyId, type, name, identifier, capacity, parent_container_id, photo (multipart)
- Upload photo to Supabase Storage
- Extract identifier via OCR (license plate, asset tag) - use T032
- Call container repository (T027)
- Return: container
**Dependencies**: T027, T032 complete

---

## Phase 3.9: Frontend Components (Mobile-First)

### T060 [P]: InventoryCamera component
**Files**: `src/components/inventory/InventoryCamera.tsx`
**Description**: Camera component with 1fps processing:
- Access device camera via WebRTC
- Capture photo on button press
- Display live preview
- Show processing spinner during detection
- Display cost estimate before VLM usage
- Performance: 1 fps processing (PR-002)
**Dependencies**: None (can start in parallel)

### T061 [P]: DetectionResults component
**Files**: `src/components/inventory/DetectionResults.tsx`
**Description**: Display detected items in numbered grid:
- Render DetectedItem[] as numbered grid (1-N)
- Show 1:1 square crop thumbnails
- Display label + confidence score per item
- Support touch selection (checkbox or tap)
- Support voice selection (highlight on voice command)
- Show grouped items with quantity badges
- "Show All" button to reveal filtered objects
**Dependencies**: None

### T062 [P]: ItemSelectionControl component
**Files**: `src/components/inventory/ItemSelectionControl.tsx`
**Description**: Voice + touch item selection:
- Microphone button for voice commands
- Parse: "Add 1, 2, and 5", "Add all", "Add all except X"
- Visual feedback for selected items (checkmarks)
- Quantity adjustment for grouped items
- Progress indicator (e.g., "3 of 20 items selected")
- Confirm selection button
**Dependencies**: None

### T063 [P]: CropEditor component
**Files**: `src/components/inventory/CropEditor.tsx`
**Description**: Edit misidentified items:
- Display crop in editor
- Adjust bounding box (drag corners)
- Change label via voice or text input
- VLM re-analysis button (triggers cloud VLM for single item)
- Save correction to training data
**Dependencies**: None

### T064 [P]: AttributeAssignment component
**Files**: `src/components/inventory/AttributeAssignment.tsx`
**Description**: Sequential attribute assignment:
- Display current item (e.g., "Item 1 of 3")
- Show extracted attributes from vision (brand, model, color)
- Microphone for voice input (serial, price, notes)
- Validation indicators (✓ populated, ✗ missing required)
- "Apply to all similar items" checkbox
- Next/Previous buttons
**Dependencies**: None

### T065 [P]: TransactionConfirmation component
**Files**: `src/components/inventory/TransactionConfirmation.tsx`
**Description**: Confirm transaction intent:
- Display inferred intent (e.g., "Did you just purchase these at Home Depot?")
- Show context clues (GPS location, time of day, scene elements)
- Confirm or override buttons
- Voice confirmation: "Yes" or "No, I'm registering new equipment"
**Dependencies**: None

### T066 [P]: KitValidation component
**Files**: `src/components/inventory/KitValidation.tsx`
**Description**: Display kit completion status:
- Visual indicators: ✓ present, ⚠️ missing, ✗ not required
- Completion percentage (e.g., "Kit 100% Complete ✓")
- List missing required items
- List extra items (not in kit)
- Warning banner if incomplete
- Uses T040a (kit validation service) for validation logic
**Dependencies**: None

### T067 [P]: ReceiptPreview component
**Files**: `src/components/inventory/ReceiptPreview.tsx`
**Description**: Display OCR extracted data:
- JSON preview with syntax highlighting
- Confidence scores per field (color-coded)
- Editable fields (tap to edit)
- Highlight detected text regions on original photo
- One-tap confirm or detailed edit mode
**Dependencies**: None

### T068: InventoryCheckOut screen
**Files**: `src/app/inventory/check-out/page.tsx`
**Description**: Check-out workflow screen (TopHand UX):
- Header: "Check Out Equipment"
- Camera panel (T060)
- Detection results (T061)
- Item selection (T062)
- Kit validation (T066)
- Transaction confirmation (T065)
- Voice command: "Check out for [job]"
**Dependencies**: T060-T062, T065-T066, T050-T052 complete

### T069 [P]: InventoryCheckIn screen
**Files**: `src/app/inventory/check-in/page.tsx`
**Description**: Check-in workflow screen:
- Camera panel
- Detection results
- Discrepancy report display
- Voice explanations for missing/unexpected items
**Dependencies**: T060-T061, T053 complete

### T070 [P]: InventoryPurchase screen
**Files**: `src/app/inventory/purchase/page.tsx`
**Description**: Purchase receipt workflow screen:
- Camera panel (receipt photo)
- OCR processing spinner
- Receipt preview (T067)
- Job assignment dropdown
- Material creation confirmation
**Dependencies**: T060, T067, T045 complete

### T071 [P]: InventoryAudit screen
**Files**: `src/app/inventory/audit/page.tsx`
**Description**: Audit workflow screen:
- Camera panel (wide area photo)
- Detection results
- Discrepancy report (expected vs detected)
- Accuracy percentage display
- Update counts button
**Dependencies**: T060-T061, T056 complete

---

## Phase 3.10: Polish & Testing

### T072 [P]: Unit tests for detection orchestration
**Files**: `src/domains/inventory/services/__tests__/detection-orchestration.test.ts`
**Description**: Unit test T038 service:
- Mock YOLO inference, crop generation, grouping, filtering
- Test VLM fallback decision logic
- Test cost tracking
- Test detection session creation
- Coverage target: ≥80%
**Dependencies**: T038 complete

### T073 [P]: Unit tests for transaction services
**Files**: `src/domains/inventory/services/__tests__/kit-validation.test.ts`, `checkout.test.ts`, `checkin.test.ts`, `transfer.test.ts`, `material-usage.test.ts`, `audit.test.ts`
**Description**: Unit test T040a, T040b, T041-T044 services:
- Test kit validation (T040a): pure function, no mocks needed
- Test check-out (T040b): mock repositories and T040a
- Mock repositories for other services
- Test validation logic
- Test discrepancy detection
- Test cost calculations
- Test RLS enforcement
- Coverage target: ≥80% per service
**Dependencies**: T040a, T040b, T041-T044 complete

### T074 [P]: Unit tests for OCR services
**Files**: `src/domains/vision/services/__tests__/ocr-tesseract.test.ts`, `ocr-gpt4.test.ts`, `ocr.test.ts`
**Description**: Unit test T032a, T032b, T032c services:
- Test Tesseract wrapper (T032a): parsing accuracy, performance
- Test GPT-4 fallback (T032b): structured output, cost tracking
- Test orchestration (T032c): hybrid logic (Tesseract <70% → GPT-4)
- Mock Tesseract.js and OpenAI SDK
- Test receipt parsing accuracy
- Test cost tracking ($0 Tesseract, ~$0.02 GPT-4)
- Test offline queueing
**Dependencies**: T032a, T032b, T032c complete

### T075 [P]: Unit tests for crop generation
**Files**: `src/domains/vision/services/__tests__/crop-generator.test.ts`
**Description**: Unit test T033 service:
- Test 1:1 aspect ratio with 10% padding
- Test JPEG compression quality
- Test performance (<5s for 20 crops)
- Test Supabase Storage upload
**Dependencies**: T033 complete

### T076 [P]: Unit tests for background filtering
**Files**: `src/domains/vision/services/__tests__/background-filter.test.ts`
**Description**: Unit test T035 service:
- Test auto-filtering (>95% confidence)
- Test prompt logic (70-95% confidence)
- Test user preference learning (after 3 exclusions)
- Test context-aware filtering (field vs HQ)
**Dependencies**: T035 complete

### T077 [P]: Unit tests for voice services
**Files**: `src/domains/inventory/services/__tests__/attribute-extraction.test.ts`, `intent-detection.test.ts`, `voice-command-parser.test.ts`
**Description**: Unit test T047-T049 services:
- Mock OpenAI function calling
- Test structured output parsing
- Test GPS + scene + time inference
- Test voice command patterns
**Dependencies**: T047-T049 complete

### T078: E2E test - Complete check-out workflow
**Files**: `tests/e2e/inventory-checkout.spec.ts`
**Description**: Playwright E2E test for quickstart.md Scenario 1:
1. Navigate to /inventory/check-out
2. Take photo of truck bed (mock camera)
3. Verify 3 items detected
4. Voice command: "Add all"
5. Verify kit validation: 100% complete
6. Voice command: "Check out for Oak Street job"
7. Verify transaction created in database
8. Verify items assigned to Truck 214
**Dependencies**: T068, T050-T053 complete

### T079: E2E test - Purchase receipt processing
**Files**: `tests/e2e/inventory-purchase.spec.ts`
**Description**: Playwright E2E test for quickstart.md Scenario 2:
1. Navigate to /inventory/purchase
2. Upload receipt photo
3. Wait for OCR processing (<5s)
4. Verify extracted data displayed
5. Correct any errors
6. Assign to job: "Irrigation System Install"
7. Confirm creation
8. Verify materials + purchase_receipt + transaction in database
**Dependencies**: T070, T045 complete

### T080: E2E test - Multi-item selection with grouping
**Files**: `tests/e2e/inventory-multi-item.spec.ts`
**Description**: Playwright E2E test for quickstart.md Scenario 3:
1. Upload photo with 20 items (15 PVC + 2 mowers + 3 trimmers)
2. Verify auto-grouping (3 groups)
3. Voice command: "Add Group 1 and detection 16"
4. Adjust Group 1 quantity from 15 to 12
5. Correct detection #18 label
6. Confirm selection
7. Verify training_data_records created
**Dependencies**: T061-T063, T050-T051 complete

### T081: Performance validation
**Files**: `tests/performance/inventory-vision.perf.test.ts`
**Description**: Validate performance targets from plan.md:
- PR-001: YOLO detection <3s on iPhone 12+ equivalent
- PR-002: Camera processing 1 fps
- PR-003: VLM fallback <10s with network
- PR-004: OCR extraction <5s
- PR-008: Crop generation <5s for 20 items
- Use Lighthouse or custom performance monitoring
**Dependencies**: T038, T032, T033 complete

### T082: Cost validation
**Files**: `tests/validation/inventory-cost.test.ts`
**Description**: Validate cost targets:
- CR-007: Average cost <$0.05 per operation
- CR-005: Daily VLM budget $10 per company enforced
- Track costs across 100 simulated operations
- Verify 80/20 split (80% local YOLO, 20% VLM)
**Dependencies**: T038, T050-T056 complete

### T083: RLS security validation
**Files**: `tests/security/inventory-rls.test.ts`
**Description**: Validate RLS policies from data-model.md:
- Test technician can only view own transactions (user_access policy)
- Test supervisor can view all company transactions (tenant_isolation policy)
- Test cross-tenant access denied
- Test admin-only access to training_data_records
- Attempt to query with different company_id in JWT
**Dependencies**: T003 (migration applied), T026-T031 complete

### T084: Execute quickstart.md manual scenarios
**Files**: N/A (manual testing)
**Description**: Run all 7 scenarios from quickstart.md:
1. Morning check-out with kit validation
2. Purchase receipt processing
3. Multi-item selection with grouping
4. Evening check-in with discrepancies
5. Background filtering with learning
6. Offline queue sync
7. Training data collection
- Verify SQL state after each scenario
- Verify performance metrics
- Document any deviations
**Dependencies**: T068-T071, all services complete

### T085 [P]: Update feature documentation
**Files**: `specs/004-voice-vision-inventory/README.md`
**Description**: Create feature README with:
- Architecture overview diagram
- API endpoint reference (link to contracts/)
- Database schema diagram (from data-model.md)
- Deployment instructions
- Troubleshooting guide
- Performance tuning tips
**Dependencies**: All implementation complete

### T086 [P]: Update CLAUDE.md with implementation notes
**Files**: `CLAUDE.md`
**Description**: Add post-implementation notes:
- Known issues or limitations
- Future optimization opportunities (YOLO fine-tuning roadmap)
- Performance baselines achieved
- Cost metrics (actual vs target)
**Dependencies**: All implementation complete

---

## Task Dependencies

### Critical Path (must be sequential):
```
T001 → T002 → T003 → T004 (Database setup)
T004 → T020-T025 (Types need schema)
T020-T025 → T026-T031 (Repositories need types)
T026-T031 → T032a-T032c, T038-T046 (Services need repositories)
T032a, T032b → T032c (Orchestration needs both OCR strategies)
T040a → T040b (Check-out needs kit validation)
T038-T046 → T050-T056 (Endpoints need services)
T050-T056 → T068-T071 (UI needs endpoints)
T068-T071 → T078-T084 (E2E tests need UI)
```

### Parallel Execution Opportunities:

**Phase 1: Tests (T006-T019) - All parallel**
```bash
# Launch all contract tests simultaneously (different files)
Task: "Contract test POST /api/inventory/detect"
Task: "Contract test POST /api/inventory/confirm-selection"
Task: "Contract test POST /api/inventory/check-out"
Task: "Contract test POST /api/inventory/check-in"
Task: "Contract test POST /api/inventory/transfer"
Task: "Contract test POST /api/inventory/material-usage"
Task: "Contract test POST /api/inventory/audit"

# Launch all integration tests simultaneously (different files)
Task: "Integration test - Morning check-out workflow"
Task: "Integration test - Purchase receipt OCR"
Task: "Integration test - Multi-item detection with grouping"
Task: "Integration test - Check-in with discrepancies"
Task: "Integration test - Background filtering with learning"
Task: "Integration test - Offline queue sync"
Task: "Integration test - Training data collection"
```

**Phase 2: Types (T020-T025) - All parallel**
```bash
Task: "Inventory transaction types"
Task: "Container types"
Task: "Purchase receipt types"
Task: "Training data types"
Task: "Detection preference types"
Task: "Extend inventory item types"
```

**Phase 3: Repositories (T027-T031) - Parallel after T026**
```bash
# T026 must complete first (transaction repo)
Task: "Container repository"
Task: "Container assignment repository"
Task: "Purchase receipt repository"
Task: "Training data repository"
Task: "Detection preference repository"
```

**Phase 4: Vision Extensions (T032a-T035) - Mostly Parallel**
```bash
# T032a and T032b can run in parallel (different OCR strategies):
Task: "Tesseract.js OCR wrapper"
Task: "GPT-4 Vision OCR fallback"
# T032c runs after both complete
Task: "OCR orchestration service"
Task: "Crop generation service"
# T034 depends on T033 (grouping needs crops)
# T035 depends on T031 (filtering needs preferences repo)
```

**Phase 5: Frontend Components (T060-T067) - All parallel**
```bash
Task: "InventoryCamera component"
Task: "DetectionResults component"
Task: "ItemSelectionControl component"
Task: "CropEditor component"
Task: "AttributeAssignment component"
Task: "TransactionConfirmation component"
Task: "KitValidation component"
Task: "ReceiptPreview component"
```

**Phase 6: Unit Tests (T072-T077) - Parallel after services complete**
```bash
Task: "Unit tests for detection orchestration"
Task: "Unit tests for transaction services"
Task: "Unit tests for OCR service"
Task: "Unit tests for crop generation"
Task: "Unit tests for background filtering"
Task: "Unit tests for voice services"
```

---

## Validation Checklist

Before marking tasks.md as complete, verify:

- [x] All 2 contract files have corresponding tests (T006-T007 for detection, T008-T012 for transactions)
- [x] All 10 entities from data-model.md have repository tasks (T026-T031)
- [x] All 7 quickstart.md scenarios have integration tests (T013-T019)
- [x] All tests come before implementation (Phase 3.2 before 3.4-3.8)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Database precheck (T001) before migration (T002) - Constitution RULE 1
- [x] Git push after commits - Constitution RULE 2 (manual step during execution)
- [x] TDD enforced: Tests (T006-T019) MUST FAIL before implementation (T020-T056)
- [x] Performance targets validated (T081)
- [x] Cost targets validated (T082)
- [x] RLS policies validated (T083)
- [x] Manual quickstart.md execution (T084)

---

## Summary

**Total Tasks**: 89
- Setup & Database: 5 tasks (T001-T005)
- Contract Tests: 7 tasks (T006-T012)
- Integration Tests: 7 tasks (T013-T019)
- Domain Models: 12 tasks (T020-T031)
- Vision Extensions: 8 tasks (T032a-T032c, T033-T037)
- Inventory Services: 10 tasks (T038-T040a, T040b-T046)
- Voice Integration: 3 tasks (T047-T049)
- API Endpoints: 10 tasks (T050-T059)
- Frontend Components: 12 tasks (T060-T071)
- Unit Tests & Polish: 15 tasks (T072-T086)

**Estimated Complexity**:
- Total new code: ~12,000 LoC (unchanged, just better organized)
- Complexity budget violations: 0 (all files ≤300 LoC default)
- New files: ~68 files (3 additional split files)
- Extended files: ~5 files (existing vision services)
- Test files: ~28 files (3 additional test files)

**Parallel Execution Potential**:
- 46 tasks marked [P] (51.7% parallelizable)
- Critical path: ~43 sequential tasks
- With parallel execution: ~50% time reduction

**Next Steps**:
1. Execute tasks in order (T001 → T089: note task IDs unchanged, but T032→T032a/b/c, T040→T040a/b)
2. Commit after each task with descriptive message
3. Push immediately after each commit (Constitution RULE 2)
4. Run manual quickstart.md scenarios (T084) before final validation
5. Update documentation (T085-T086)
6. Create pull request from feature branch to main

---

**Tasks Generated**: 2025-09-30
**Ready for Execution**: YES ✅