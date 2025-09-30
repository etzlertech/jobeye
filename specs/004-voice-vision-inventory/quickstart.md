# Quickstart: Voice & Vision Inventory Management

**Feature**: 004-voice-vision-inventory
**Date**: 2025-09-29
**Purpose**: Manual test scenarios to validate implementation against spec requirements

## Prerequisites

- Development environment running (`npm run dev`)
- Test company created with `company_id` in JWT app_metadata
- Test user with supervisor role
- Test equipment and material records in database
- Test containers (truck, warehouse) registered
- Mobile device or browser with camera access

## Setup Test Data

```sql
-- Create test company (if not exists)
INSERT INTO companies (id, name) VALUES
  ('123e4567-e89b-12d3-a456-426614174000', 'Test Landscaping Co');

-- Create test containers
INSERT INTO containers (id, company_id, type, name, identifier, is_active) VALUES
  ('c1111111-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'truck', 'Truck 214', 'ABC-1234', true),
  ('c2222222-2222-2222-2222-222222222222', '123e4567-e89b-12d3-a456-426614174000', 'warehouse', 'Main Warehouse', 'WAREHOUSE-01', true);

-- Create test equipment items
INSERT INTO inventory_items (id, company_id, type, name, category, status, tracking_mode, images) VALUES
  ('i1111111-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'equipment', 'Honda HRX Mower', 'mower', 'active', 'individual', '[{"url": "/test/mower.jpg", "aspect_ratio": 1.0, "is_primary": true}]'),
  ('i2222222-2222-2222-2222-222222222222', '123e4567-e89b-12d3-a456-426614174000', 'equipment', 'Echo SRM-225 Trimmer', 'trimmer', 'active', 'individual', '[{"url": "/test/trimmer.jpg", "aspect_ratio": 1.0, "is_primary": true}]');

-- Create test material items
INSERT INTO inventory_items (id, company_id, type, name, category, status, tracking_mode, current_quantity, reorder_level, images) VALUES
  ('i3333333-3333-3333-3333-333333333333', '123e4567-e89b-12d3-a456-426614174000', 'material', 'Fertilizer 24-0-4', 'fertilizer', 'active', 'quantity', 50, 10, '[{"url": "/test/fertilizer.jpg", "aspect_ratio": 1.0, "is_primary": true}]');
```

## Test Scenario 1: Morning Check-Out (FR-028 to FR-034)

**Objective**: Verify check-out workflow with kit validation

### Steps:

1. **Navigate to Inventory Check-Out Screen**
   ```
   URL: http://localhost:3000/inventory/check-out
   ```

2. **Take Photo of Loaded Truck**
   - Arrange mower, trimmer, and blower in truck bed
   - Ensure good lighting and clear visibility
   - Tap "Take Photo" button

3. **Verify Detection Results**
   - Expected: 3 detected items displayed in numbered grid (1-3)
   - Each thumbnail shows 1:1 square crop with 10% padding
   - Labels: "mower", "trimmer", "blower"
   - Confidence scores shown (>70% for local YOLO)

4. **Select Items via Voice**
   - Tap microphone icon
   - Say: "Add all"
   - Expected: All 3 items selected with checkmarks

5. **Confirm Kit Validation**
   - System compares against "Oak Street Job" kit requirements
   - Expected: Kit 100% Complete ✓ displayed
   - Green checkmarks next to detected items

6. **Voice Confirmation**
   - Say: "Check out for Oak Street job"
   - Expected: Transaction created, items assigned to Truck 214

7. **Verify Database State**
   ```sql
   -- Should show new transaction
   SELECT * FROM inventory_transactions
   WHERE type = 'check_out'
   ORDER BY created_at DESC LIMIT 1;

   -- Should show active container assignments
   SELECT * FROM container_assignments
   WHERE container_id = 'c1111111-1111-1111-1111-111111111111'
     AND checked_out_at IS NULL;

   -- Items should have updated location
   SELECT id, name, current_location_id
   FROM inventory_items
   WHERE id IN ('i1111111-1111-1111-1111-111111111111', 'i2222222-2222-2222-2222-222222222222');
   ```

**Expected Results**:
- ✅ Transaction record with `type='check_out'`, 3 item_ids, photo_evidence_url, voice_transcript
- ✅ 3 container_assignments with `status='active'`, `checked_out_at IS NULL`
- ✅ inventory_items.current_location_id updated to Truck 214 ID
- ✅ Processing time <3s for YOLO detection
- ✅ Cost = $0 (local YOLO only)

---

## Test Scenario 2: Purchase Receipt Processing (FR-041 to FR-048)

**Objective**: Verify OCR receipt extraction and material creation

### Steps:

1. **Navigate to Receipt Processing Screen**
   ```
   URL: http://localhost:3000/inventory/purchase
   ```

2. **Take Photo of Receipt**
   - Use test receipt from Home Depot
   - Ensure all text is legible
   - Include vendor name, date, items, and total

3. **Wait for OCR Processing**
   - Expected: "Extracting data..." spinner (3-8s)
   - OCR method displayed: "Tesseract" or "GPT-4 Vision"

4. **Verify Extracted Data Preview**
   ```json
   {
     "vendor": "Home Depot",
     "date": "2025-09-29",
     "total": 47.85,
     "lineItems": [
       {"description": "PVC Fitting 1/2in", "quantity": 15, "unitPrice": 2.99, "total": 44.85},
       {"description": "Teflon Tape", "quantity": 1, "unitPrice": 3.00, "total": 3.00}
     ]
   }
   ```
   - Confidence scores shown per field (vendor: 95%, date: 88%, total: 92%)

5. **Correct Any OCR Errors**
   - If quantity wrong, tap field and edit: "15" → "15"
   - If vendor wrong, correct via voice: "Vendor is Home Depot"

6. **Voice Assignment to Job**
   - Say: "Assign to irrigation job"
   - Expected: Job selection dropdown appears, "Irrigation System Install" highlighted

7. **Confirm Purchase**
   - Tap "Create Materials" button
   - Expected:
     - 2 material records created (PVC Fitting qty 15, Teflon Tape qty 1)
     - Purchase receipt record created
     - Transaction record created with type='purchase'

8. **Verify Database State**
   ```sql
   -- Should show new purchase receipt
   SELECT * FROM purchase_receipts
   ORDER BY created_at DESC LIMIT 1;

   -- Should show created materials
   SELECT * FROM inventory_items
   WHERE name IN ('PVC Fitting 1/2in', 'Teflon Tape')
     AND type = 'material';

   -- Should show purchase transaction
   SELECT * FROM inventory_transactions
   WHERE type = 'purchase'
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Results**:
- ✅ purchase_receipts record with ocr_extracted_data, confidence_scores, assigned_job_id
- ✅ 2 new inventory_items with type='material', tracking_mode='quantity', current_quantity set
- ✅ inventory_transactions record with type='purchase', item_ids[], cost_data
- ✅ OCR processing time <5s (PR-004)
- ✅ Cost <$0.02 if GPT-4 Vision used, $0 if Tesseract

---

## Test Scenario 3: Multi-Item Selection with Grouping (FR-002 to FR-008)

**Objective**: Verify auto-grouping and selective item addition

### Steps:

1. **Prepare Test Photo**
   - Arrange 15 identical PVC fittings + 2 mowers + 3 trimmers
   - Total: 20 detections expected

2. **Navigate to Detection Screen**
   ```
   URL: http://localhost:3000/inventory/detect
   ```

3. **Upload Photo**
   - Tap "Choose Photo" and select prepared image
   - Wait for detection (should take <5s per PR-008)

4. **Verify Grouped Detections**
   - Expected: 3 groups displayed
     - Group 1: "PVC Fitting" (15 items, detection numbers 1-15)
     - Group 2: "Mower" (2 items, detection numbers 16-17)
     - Group 3: "Trimmer" (3 items, detection numbers 18-20)
   - Each group shows single representative thumbnail with quantity badge

5. **Select Specific Items via Voice**
   - Say: "Add Group 1 and detection 16"
   - Expected:
     - All 15 PVC fittings selected (Group 1)
     - Only 1 mower selected (detection #16)
     - Total: 16 items selected

6. **Adjust Grouped Quantity**
   - Tap on Group 1 to expand
   - Change quantity from 15 to 12
   - Expected: System prompts to unselect 3 items or adjust

7. **Correct Misidentified Item**
   - Detection #18 labeled as "trimmer" but actually a blower
   - Tap detection #18 thumbnail
   - Crop editor opens
   - Say: "This is actually a blower"
   - Expected: Label changed to "blower", crop remains same

8. **Verify Selection Summary**
   ```
   Selected: 16 items
   - PVC Fitting × 12
   - Mower × 1
   - Blower × 1 (corrected)
   ```

9. **Confirm Selection**
   - Tap "Confirm Selection"
   - Expected: Redirected to attribute assignment screen

**Expected Results**:
- ✅ 20 detections generated within 5s (PR-008)
- ✅ Items grouped by >90% similarity
- ✅ Voice selection "Add Group 1 and detection 16" correctly interpreted
- ✅ User correction saved to training_data_records
- ✅ vision_training_annotations record created for corrected label

---

## Test Scenario 4: Evening Check-In with Discrepancies (FR-035 to FR-040)

**Objective**: Verify check-in discrepancy detection

### Steps:

1. **Simulate Morning Check-Out**
   ```sql
   -- Check out 3 items in morning
   INSERT INTO inventory_transactions (id, company_id, type, item_ids, destination_container_id, performer_id) VALUES
     ('t1111111-1111-1111-1111-111111111111', '123e4567-e89b-12d3-a456-426614174000', 'check_out',
      ARRAY['i1111111-1111-1111-1111-111111111111', 'i2222222-2222-2222-2222-222222222222', 'i3333333-3333-3333-3333-333333333333']::uuid[],
      'c1111111-1111-1111-1111-111111111111', auth.uid());
   ```

2. **Navigate to Check-In Screen**
   ```
   URL: http://localhost:3000/inventory/check-in
   ```

3. **Take Photo of Truck (Missing Trimmer)**
   - Only mower and blower visible
   - Trimmer missing (left at job site)

4. **Verify Detection Results**
   - Expected: 2 items detected (mower, blower)
   - System compares against morning check-out (3 items)

5. **Review Discrepancy Report**
   ```
   Check-In Summary:
   ✅ Mower - Honda HRX (returned)
   ✅ Blower - Echo PB-580T (returned)
   ⚠️ Trimmer - Echo SRM-225 (MISSING)

   Discrepancy Detected:
   - 1 item checked out but not returned
   - Prompt: "Where is the trimmer?"
   ```

6. **Voice Response**
   - Say: "Left at Oak Street job site"
   - Expected: System logs note, keeps assignment active, flags for follow-up

7. **Detect Unexpected Item**
   - New chainsaw visible in photo (purchased during day)
   - System shows: "⚠️ Chainsaw - Stihl MS 250 (NOT CHECKED OUT)"

8. **Explain Unexpected Item**
   - Say: "Purchased today"
   - Expected: System prompts to create purchase receipt or register as new item

9. **Complete Check-In**
   - Confirm partial check-in
   - Expected: 2 items returned, 1 flagged as missing, 1 flagged as unexpected

10. **Verify Database State**
    ```sql
    -- Check-in transaction
    SELECT * FROM inventory_transactions
    WHERE type = 'check_in'
    ORDER BY created_at DESC LIMIT 1;

    -- Trimmer should still be assigned to truck (not checked in)
    SELECT * FROM container_assignments
    WHERE item_id = 'i2222222-2222-2222-2222-222222222222'
      AND checked_out_at IS NULL;

    -- Mower/blower should have checked_out_at timestamp
    SELECT * FROM container_assignments
    WHERE item_id IN ('i1111111-1111-1111-1111-111111111111', 'i3333333-3333-3333-3333-333333333333')
      AND checked_out_at IS NOT NULL;
    ```

**Expected Results**:
- ✅ inventory_transactions record with type='check_in', notes about missing/unexpected items
- ✅ 2 container_assignments updated with checked_out_at timestamp
- ✅ 1 container_assignment remains active (trimmer still at job site)
- ✅ Supervisor notification triggered for missing item (IR-003)
- ✅ Discrepancy report generated with accuracy percentage

---

## Test Scenario 5: Background Filtering with Learning (FR-075 to FR-081)

**Objective**: Verify auto-filtering and preference learning

### Steps:

1. **Take Photo at Job Site (Many Background Objects)**
   - Scene includes: mower, trimmer, cooler, water bottle, workbench, wall, person
   - Expected: 7 detections initially

2. **Verify Auto-Filtered Objects**
   ```
   Detected 2 items:
   1. Mower (confidence: 95%)
   2. Trimmer (confidence: 88%)

   Auto-filtered (high confidence background):
   - Wall (confidence: 98%) ✓
   - Workbench (confidence: 96%) ✓

   Filtered (user preference):
   - Cooler (confidence: 85%) - "Always exclude coolers in field"
   - Water bottle (confidence: 78%) - "Low value item"
   ```

3. **Review Filtered Items**
   - Tap "Show All Detected Items"
   - Expected: All 7 detections shown, filtered ones grayed out

4. **Exclude Ambiguous Object**
   - System prompts: "Should I include 'person' (confidence: 72%)?"
   - Say: "Exclude"
   - Expected: Person removed from results

5. **Create Permanent Filter**
   - After excluding cooler 3 times in field locations
   - System prompts: "Should I always filter coolers in the future?"
   - Say: "Yes, always exclude coolers when I'm in the field"
   - Expected: background_filter_preferences record created

6. **Verify Next Detection Applies Preference**
   - Take another photo at field location with cooler visible
   - Expected: Cooler auto-filtered without prompt
   - Reason shown: "User preference: always exclude in field"

7. **Override Filter for Specific Case**
   - At headquarters, cooler should NOT be filtered (different context)
   - Take photo at HQ with cooler
   - Expected: Cooler included in detections
   - Context-aware rule: "Exclude coolers only in 'field' locations"

8. **Verify Database State**
   ```sql
   -- Should show filter preference
   SELECT * FROM background_filter_preferences
   WHERE company_id = '123e4567-e89b-12d3-a456-426614174000'
     AND object_label = 'cooler';

   -- context_filters should match
   -- {"location_type": "field", "transaction_intent": null}
   ```

**Expected Results**:
- ✅ Walls, workbenches auto-filtered at >95% confidence
- ✅ Ambiguous objects (70-95% confidence) prompt for confirmation
- ✅ After 3 exclusions, system prompts to create permanent filter
- ✅ background_filter_preferences record with context_filters JSONB
- ✅ Context-aware filtering (cooler excluded in field, included at HQ)
- ✅ "Show All" option displays all detections including filtered ones

---

## Test Scenario 6: Offline Queue Sync (PR-005, OR-007, OR-008)

**Objective**: Verify offline operation and sync retry logic

### Steps:

1. **Enable Offline Mode**
   - Open browser DevTools → Network tab
   - Set throttling to "Offline"
   - Verify: `navigator.onLine === false`

2. **Perform Check-Out Operation Offline**
   - Navigate to check-out screen
   - Take photo, select items, confirm
   - Expected: "Operation queued for sync" message

3. **Check IndexedDB Queue**
   ```javascript
   // Open IndexedDB in DevTools → Application → IndexedDB
   // Check inventoryQueue store
   // Expected: 1 pending record with status='pending'
   ```

4. **Perform Multiple Operations Offline**
   - Check-out: 5 operations
   - Register new item: 3 operations
   - Update preference: 2 operations
   - Total: 10 queued operations

5. **Verify Queue Storage Metrics**
   ```javascript
   // Check queueMetrics store
   // Expected:
   {
     companyId: '123e4567-...',
     totalOperations: 10,
     pendingCount: 10,
     failedCount: 0,
     totalStorageMB: ~20MB (10 ops × 2MB avg)
   }
   ```

6. **Restore Connectivity**
   - Set Network throttling to "Online"
   - Expected: Automatic background sync triggered

7. **Monitor Sync Progress**
   - Expected: Operations synced in priority order (high → medium → low)
   - Check-out operations (priority: high) sync first
   - Training data (priority: low) syncs last

8. **Simulate Sync Failure**
   - Mock API endpoint to return 500 error
   - Trigger sync
   - Expected:
     - Operation status changes to 'failed'
     - syncRetryCount incremented
     - syncErrors array updated with error message

9. **Simulate 10 Failed Retry Attempts**
   ```javascript
   // Manually update IndexedDB record
   db.inventoryQueue.update(itemId, {
     syncRetryCount: 10,
     status: 'pending'
   });
   ```

10. **Trigger Sync Again**
    - Expected:
      - Operation moved to 'archived' status
      - alert displayed: "Operation failed after 10 attempts. Archived for 30 days."
      - Item visible in "Failed Operations" screen

11. **Verify Database State After Successful Sync**
    ```sql
    -- All operations should have transaction records
    SELECT COUNT(*) FROM inventory_transactions
    WHERE created_at > NOW() - INTERVAL '10 minutes';
    -- Expected: 10 records

    -- Queue should be empty
    -- Check IndexedDB inventoryQueue store
    -- Expected: 0 pending records
    ```

12. **Test Storage Quota Warning**
    ```javascript
    // Fill queue to 80% device storage
    // Expected: Warning banner displayed
    // "Storage 80% full. Clear offline queue to continue."

    // Fill to 95%
    // Expected: New operations blocked
    // "Cannot queue operation. Storage full. Sync or clear queue."
    ```

**Expected Results**:
- ✅ Operations queue to IndexedDB when offline
- ✅ Auto-sync triggers when connectivity restored
- ✅ Sync respects priority order (high → medium → low)
- ✅ Failed syncs retry up to 10 times
- ✅ After 10 failures, operation archived for 30 days (OR-008)
- ✅ Storage warnings at 80%, blocks at 95% (PR-005)
- ✅ All sync attempts logged with success/failure status (OR-007)

---

## Test Scenario 7: Training Data Collection (FR-082 to FR-091)

**Objective**: Verify comprehensive training data capture

### Steps:

1. **Perform Detection with Corrections**
   - Take photo with 5 items
   - YOLO detects: "mower", "trimmer", "backpack", "bottle", "chair"
   - User corrects: "backpack" → "sprayer", exclude "bottle" and "chair"

2. **Verify Training Data Record Created**
   ```sql
   SELECT * FROM training_data_records
   ORDER BY created_at DESC LIMIT 1;
   ```

   Expected fields populated:
   - `original_photo_url`: Link to full-resolution photo
   - `yolo_detections`: JSONB with all 5 detections, bounding boxes, confidences
   - `vlm_analysis`: NULL (YOLO confidence was >70%)
   - `user_selections`: [1, 2, 3] (mower, trimmer, corrected sprayer)
   - `user_corrections`: [{"detection_num": 3, "original_label": "backpack", "corrected_label": "sprayer"}]
   - `user_exclusions`: [{"detection_num": 4, "label": "bottle"}, {"detection_num": 5, "label": "chair"}]
   - `context`: {gps_lat, gps_lng, location_type: "field", transaction_intent: "register"}
   - `voice_transcript`: "Add 1, 2, and 3. Number 3 is a sprayer, not a backpack."

3. **Verify Training Annotation Created**
   ```sql
   SELECT * FROM vision_training_annotations
   WHERE training_record_id = (SELECT id FROM training_data_records ORDER BY created_at DESC LIMIT 1);
   ```

   Expected:
   - `item_detection_number`: 3
   - `corrected_label`: "sprayer"
   - `corrected_bbox`: {x, y, width, height} (normalized 0-1)
   - `correction_reason`: "YOLO misidentified as backpack"

4. **Verify Quality Metrics Logged**
   ```json
   {
     "retake_count": 0,
     "correction_count": 1,
     "exclusion_count": 2,
     "user_satisfaction_rating": null
   }
   ```

5. **Verify Created Record Linkage**
   - Check `training_data_records.created_record_ids`
   - Expected: Array of 3 UUIDs (mower, trimmer, sprayer inventory_items)

6. **Test VLM Training Data Capture**
   - Take low-light photo (YOLO confidence <70%)
   - VLM fallback triggers
   - Expected: `training_data_records.vlm_analysis` populated with GPT-4 Vision response

7. **Test Training Data Export (Admin Only)**
   - Navigate to: `/admin/training-data/export`
   - Select date range: Last 30 days
   - Click "Export YOLO Format"
   - Expected: ZIP file with:
     - `images/` directory with all photos
     - `labels/` directory with `.txt` files (YOLO format)
     - `classes.txt` with unique labels
     - `metadata.json` with export stats

8. **Verify Company Opt-Out**
   - Navigate to: `/settings/privacy`
   - Toggle "Contribute to model training" → OFF
   - Perform detection
   - Expected: No training_data_records created, message: "Training data collection disabled"

**Expected Results**:
- ✅ training_data_records created for all detections
- ✅ All corrections, exclusions, and voice transcripts saved
- ✅ Context (GPS, location type, intent) captured
- ✅ vision_training_annotations created for corrected labels
- ✅ Quality metrics tracked (retakes, corrections)
- ✅ VLM analysis saved when used
- ✅ created_record_ids links to inventory_items
- ✅ YOLO export format works for model retraining (FR-091)
- ✅ Company opt-out respected (DR-007)

---

## Performance Validation

### Test YOLO Inference Time (PR-001)
```javascript
// In browser console
const start = performance.now();
await detectItems(photo);
const elapsed = performance.now() - start;
console.log(`YOLO inference: ${elapsed}ms`);
// Expected: <3000ms on iPhone 12+ equivalent
```

### Test Camera Frame Rate (PR-002)
```javascript
// Monitor camera feed FPS
let frameCount = 0;
setInterval(() => {
  console.log(`Camera FPS: ${frameCount}`);
  frameCount = 0;
}, 1000);
// Expected: ~1 FPS processing
```

### Test Crop Generation Time (PR-008)
```javascript
const start = performance.now();
await generateCrops(imageData, 20); // 20 detections
const elapsed = performance.now() - start;
console.log(`Crop generation: ${elapsed}ms`);
// Expected: <5000ms
```

### Test Average Operation Cost (CR-007)
```sql
-- Calculate average cost per operation over last 30 days
SELECT AVG(
  COALESCE((cost_data->>'estimated_vlm_cost')::decimal, 0) +
  COALESCE((cost_data->>'estimated_llm_cost')::decimal, 0)
) as avg_cost_usd
FROM inventory_transactions
WHERE created_at > NOW() - INTERVAL '30 days';
-- Expected: <$0.05
```

---

## Success Criteria

This feature is ready for production when:

- ✅ All 7 test scenarios pass without errors
- ✅ Performance metrics meet targets (PR-001 to PR-009)
- ✅ Cost metrics meet budget constraints (CR-001 to CR-007)
- ✅ RLS policies block cross-tenant access
- ✅ Offline queue handles 50+ operations
- ✅ Training data export works for model retraining
- ✅ Background filtering learns user preferences
- ✅ Voice commands correctly interpreted (90%+ accuracy)
- ✅ Mobile UX responsive on iOS Safari and Chrome Android
- ✅ E2E tests pass in CI/CD pipeline

---

**Quickstart Complete**: 2025-09-29
**Next Step**: Run `/tasks` command to generate implementation tasks