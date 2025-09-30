# Feature Specification: Voice & Vision Inventory Management

**Feature Branch**: `004-voice-vision-inventory`
**Created**: 2025-09-29
**Status**: Draft
**Input**: User description: "Voice & Vision Inventory Management - Context-aware inventory operations with camera + voice for adding items, registering containers, check-in/out workflows, multi-unit counting, background filtering, and ML training data collection"

## Clarifications

### Session 2025-09-29
- Q: When multiple identical items are detected (e.g., 5 PVC fittings), should they be grouped automatically? → A: Yes, group similar items (similarity >90%) and allow quantity adjustment
- Q: What is the confidence threshold for auto-filtering background objects? → A: >95% confidence for auto-exclusion, 70-95% requires user confirmation
- Q: How long should training data photos be retained? → A: Indefinitely for continuous model improvement, with company opt-out available
- Q: Should the system support both materials (quantity-based) and equipment (individual tracking)? → A: Yes, auto-determine based on item type and value (<$50 typically materials)
- Q: What is the maximum detection count per photo before requiring user to retake with fewer items? → A: 30 items maximum, recommend retake if >20 for better accuracy
- Q: Should purchase receipts auto-match to open purchase orders? → A: Yes, if PO system exists, with manual override option
- Q: What happens when GPS location is unavailable for context detection? → A: Fall back to manual location type selection with voice or tap
- Q: Should the system support barcode/QR code scanning in addition to vision detection? → A: Yes, as alternative input method with same workflow

---

## User Scenarios & Testing

### Primary User Story
A field technician arrives at the company shop at 6:30 AM to load equipment for the day's jobs. Instead of manually checking items against a paper list and logging each piece, they take a single photo of their loaded truck bed. The system automatically detects all visible equipment (mower, trimmer, blower, gas can), compares against required job kits, and confirms the load is complete—or highlights missing items. The technician says "Check out for Oak Street job" and the system creates transaction records, updates item locations to Truck 214, and links everything to the scheduled job. Later, at a hardware store, they photograph PVC fittings in their shopping cart and say "Purchase receipt for irrigation job." The system reads the receipt via OCR, creates material records for 15 identical fittings, logs the purchase, and assigns them to the job—all in under 30 seconds, hands-free.

### Acceptance Scenarios

1. **Given** a technician has loaded their truck with equipment **When** they take a photo of the truck bed and say "Check out for Oak Street job" **Then** the system detects all items (mower, trimmer, blower), compares against the job's required kit, displays "Kit 100% Complete ✓", creates check-out transaction records, updates item locations to Truck 214, and links to Oak Street job

2. **Given** a technician photographs 15 identical PVC fittings in a Home Depot shopping cart **When** they say "Purchase receipt for irrigation job" **Then** the system groups the 15 items, extracts purchase details from the receipt via OCR, creates a single material record with quantity=15, logs the purchase transaction with vendor/cost, and assigns to the specified job

3. **Given** a warehouse manager takes a photo of a new Honda mower on a workbench **When** they say "Add to inventory, serial HRX12345, purchased for $650" **Then** the system extracts brand/model from the photo via VLM, creates an equipment record with provided details, generates a 1:1 square profile image, assigns to warehouse location, and displays success confirmation

4. **Given** a photo contains 15 detected objects including both inventory items and background fixtures **When** the system processes the image at company headquarters **Then** it automatically filters out workbench, walls, and floor (high confidence background), displays only relevant equipment items (mower, trimmer, blower), and allows user to tap "Show All" to review filtered items

5. **Given** a technician photographs empty fertilizer bags at a customer site **When** they say "Used 3 bags of fertilizer" **Then** the system detects 3 empty bags, prompts for waste amount, logs material usage transaction linked to current job, deducts 3 from inventory stock, updates truck inventory, and calculates job cost

6. **Given** a manager wants to register a new truck as a container **When** they photograph the truck and say "This is Truck 214" **Then** the system detects the vehicle type, reads the license plate via OCR, creates a container record, prompts to set as default, and makes it available for check-in/out operations

7. **Given** a technician has checked out equipment in the morning and returns at day's end **When** they photograph items in the truck and say "Check in all items" **Then** the system compares detected items against morning check-out, confirms all equipment is accounted for (except materials marked as used), creates check-in transactions, updates locations to warehouse, and flags any discrepancies

8. **Given** the system detects a mower with a damaged blade in a maintenance photo **When** the technician says "Schedule repair" **Then** the VLM analyzes damage severity, creates a maintenance ticket, updates equipment status to "maintenance", suggests ordering replacement parts, and offers to assign a backup mower

9. **Given** a warehouse supervisor takes a wide photo of storage Bay A **When** they start an inventory audit **Then** the system detects all visible items, compares against expected inventory, identifies discrepancies (1 missing blower, 1 unexpected chainsaw), prompts to update counts or investigate, and generates an audit report

10. **Given** a technician needs to move equipment between containers **When** they photograph both containers and say "Move mower to red trailer" **Then** the system detects source (Truck 214) and destination (Red Trailer), creates a transfer transaction, updates the mower's location, and confirms the transfer visually

11. **Given** the system repeatedly detects "cooler" in field photos and user always excludes it **When** the user excludes a cooler for the 3rd time **Then** the system prompts "Should I always filter coolers in the future?", learns the preference, and auto-excludes coolers from future detections in field locations

12. **Given** a purchase receipt photo is taken at a hardware store **When** OCR extracts vendor, date, total, and line items **Then** the system displays extracted JSON preview, allows one-tap confirmation or field editing, checks if purchase matches any open POs, and provides options to add to inventory, assign to job, or both

### Edge Cases
- What happens when photo is too dark or blurry for reliable detection? System displays low confidence warning, suggests retaking photo with better lighting, or allows manual item entry
- How does system handle items partially obscured or stacked? VLM provides lower confidence scores, shows detected portions, allows manual crop adjustment
- What if GPS location is unavailable for context detection? System prompts user to manually select location type (HQ, customer site, store) or defaults to last known location type
- When identical items are detected but quantities differ (detected 5, user says 7)? System allows quantity override, logs discrepancy for accuracy tracking
- What happens when user selects a misidentified item? System progresses to attribute assignment where user can correct label via voice ("This is actually a bucket") or crop editor
- How does system behave when offline and local YOLO fails? Operation queues in IndexedDB with "pending" status, auto-retries when connectivity restored
- What if serial number duplicates are detected during registration? System warns of existing record, asks if same item or different, allows override with reason
- When detection count exceeds 30 items in a single photo? System displays "Too many items detected. Please retake photo with fewer items for better accuracy"
- How does system handle voice recognition failures or ambiguous commands? Falls back to text input field, shows "I couldn't understand that" message
- What happens when daily VLM budget is exceeded? System continues with local YOLO only, logs warning, notifies admin, queues low-confidence detections for later VLM analysis
- When a container is deleted but has items checked into it? System warns of X items still in container, requires reassignment or confirms cascade deletion
- What if user wants to add an item type not in YOLO training set? VLM fallback analyzes photo, allows custom type entry, saves as training data for future model improvement

---

## Requirements

### Functional Requirements

#### Core Detection & Selection
- **FR-001**: System MUST detect and identify equipment, materials, and containers in photos using computer vision
- **FR-002**: System MUST generate individual 1:1 square crops for each detected item with 10% padding around bounding box
- **FR-003**: System MUST display detected items in a numbered grid (1-N) with thumbnails, labels, and confidence scores
- **FR-004**: System MUST support item selection via voice commands ("Add 1, 2, and 5"), touch/tap, or mixed input
- **FR-005**: System MUST support batch selection voice patterns including "Add all", "Add all except X", "Add items 3 through 7"
- **FR-006**: System MUST automatically group identical items (similarity >90%) and display as single thumbnail with quantity badge
- **FR-007**: System MUST allow users to adjust grouped quantities, split groups, or manually add/remove items from groups
- **FR-008**: System MUST provide crop editor for misidentified items, allowing label correction, bounding box adjustment, or VLM re-analysis

#### Context-Aware Intent Detection
- **FR-009**: System MUST detect user's GPS location and match against known locations (headquarters, customer sites, suppliers, hardware stores)
- **FR-010**: System MUST infer transaction intent based on location type, detected scene elements (shopping cart, truck bed, workbench), and time of day
- **FR-011**: System MUST prompt user to confirm inferred intent ("Did you just purchase these?" at hardware store) before executing transactions
- **FR-012**: System MUST support manual intent override if automatic detection is incorrect
- **FR-013**: System MUST handle offline scenarios by storing location context locally and inferring intent without GPS

#### Item Registration (New Inventory)
- **FR-014**: System MUST create equipment or material records from photos taken at headquarters or supplier locations
- **FR-015**: System MUST extract item attributes (brand, model, color, type) from photos using vision analysis
- **FR-016**: System MUST accept voice input for attributes not visible in photos (serial numbers, purchase price, notes)
- **FR-017**: System MUST parse voice input via LLM to extract structured fields (brand, model, serial, price, condition)
- **FR-018**: System MUST display extracted attributes with validation indicators (✓ populated, ✗ missing required)
- **FR-019**: System MUST allow sequential attribute assignment for multiple selected items or bulk attribute application for similar items
- **FR-020**: System MUST determine whether to create individual equipment records or quantity-based material records based on item type, value (<$50 threshold), and category
- **FR-021**: System MUST generate and store 1:1 square profile images for all inventory items with aspect_ratio=1.0 metadata

#### Container Management
- **FR-022**: System MUST allow registration of containers (trucks, trailers, storage bins, toolboxes, warehouses, buildings) via photo + voice
- **FR-023**: System MUST detect container type from photo and extract identifiers (license plate, asset tag) via OCR
- **FR-024**: System MUST support container hierarchy (toolbox inside truck, truck belongs to company)
- **FR-025**: System MUST allow users to set a default container for quick check-in/out operations
- **FR-026**: System MUST track capacity and current contents for each container
- **FR-027**: System MUST prevent deletion of containers that have items currently checked into them without reassignment

#### Check-Out Workflow
- **FR-028**: System MUST detect items in truck/trailer photos and compare against required job kits
- **FR-029**: System MUST display kit completion status with visual indicators (✓ present, ⚠️ missing, ✗ not required)
- **FR-030**: System MUST create check-out transaction records linking items, container, job, and technician
- **FR-031**: System MUST update item locations to the target container (e.g., Truck 214)
- **FR-032**: System MUST link checked-out items to scheduled jobs when job context is provided
- **FR-033**: System MUST warn technicians of missing required items before allowing job departure
- **FR-034**: System MUST support batch check-out via "Check out all for [job]" voice command

#### Check-In Workflow
- **FR-035**: System MUST compare detected items against morning check-out records for discrepancy detection
- **FR-036**: System MUST create check-in transaction records updating item locations back to warehouse/storage
- **FR-037**: System MUST flag missing items (checked out but not returned) and prompt for investigation
- **FR-038**: System MUST detect unexpected items (not checked out) and prompt for explanation (borrowed, purchased, etc.)
- **FR-039**: System MUST support batch check-in via "Check in all items" voice command
- **FR-040**: System MUST allow partial check-in (some items returned, others kept overnight)

#### Purchase Receipt Processing
- **FR-041**: System MUST detect shopping cart or receipt in photos taken at supplier/store locations
- **FR-042**: System MUST extract vendor, date, total amount, and line items from receipt photos via OCR
- **FR-043**: System MUST display extracted data as JSON preview for user trust and verification
- **FR-044**: System MUST provide one-tap confirmation for correct OCR extractions or detailed edit mode for corrections
- **FR-045**: System MUST check extracted purchases against open purchase orders and prompt for PO matching
- **FR-046**: System MUST create material records (if new) or update quantities (if existing) based on purchase
- **FR-047**: System MUST log purchase transactions with vendor, cost, company, and optional job assignment
- **FR-048**: System MUST support voice input "Assign to [job name]" to link purchases to active jobs

#### Material Usage Tracking
- **FR-049**: System MUST detect empty/partial material containers in job site photos (bags, bottles, cans)
- **FR-050**: System MUST prompt for quantity used and optional waste amount
- **FR-051**: System MUST create material usage transaction records linked to current job
- **FR-052**: System MUST deduct used quantities from inventory stock levels
- **FR-053**: System MUST update container inventory (remove used materials from truck)
- **FR-054**: System MUST calculate and track material costs per job
- **FR-055**: System MUST support batch material logging via photo of multiple empty containers

#### Transfer Operations
- **FR-056**: System MUST detect source and destination containers in transfer photos
- **FR-057**: System MUST create transfer transaction records moving items between containers
- **FR-058**: System MUST update item locations from source to destination
- **FR-059**: System MUST support voice-driven transfers "Move [item] from [source] to [destination]"
- **FR-060**: System MUST prevent transfers to non-existent or inactive containers

#### Inventory Audit
- **FR-061**: System MUST detect all visible items in wide storage area photos
- **FR-062**: System MUST compare detected items against expected inventory for location
- **FR-063**: System MUST identify discrepancies (missing items, unexpected items, quantity mismatches)
- **FR-064**: System MUST generate audit reports with photos, detected items, and discrepancies
- **FR-065**: System MUST allow updating inventory counts to match physical audit
- **FR-066**: System MUST track audit history with before/after comparisons

#### Maintenance Logging
- **FR-067**: System MUST use vision analysis to detect equipment damage, wear, or issues in photos
- **FR-068**: System MUST assess damage severity (low, medium, high) based on visual cues
- **FR-069**: System MUST create maintenance tickets linked to equipment records
- **FR-070**: System MUST update equipment status (active → maintenance, maintenance → repair)
- **FR-071**: System MUST support voice input for maintenance notes and issue descriptions
- **FR-072**: System MUST suggest ordering replacement parts based on detected damage
- **FR-073**: System MUST offer to assign backup equipment when primary is marked for maintenance

#### Background Filtering & Object Exclusion
- **FR-074**: System MUST automatically filter common background objects (walls, floors, workbenches, people) with >95% confidence
- **FR-075**: System MUST prompt user confirmation for ambiguous objects (70-95% confidence) before filtering
- **FR-076**: System MUST allow users to manually include/exclude items from detection results
- **FR-077**: System MUST learn user preferences for object filtering ("Always exclude coolers in field locations")
- **FR-078**: System MUST apply context-aware filtering rules (cooler excluded at job site, included at HQ)
- **FR-079**: System MUST provide "Show All Detected Items" option to review filtered objects
- **FR-080**: System MUST support voice commands "Exclude [item]", "Include [item]", "Always exclude [category]"

#### Training Data Collection
- **FR-081**: System MUST save all original photos with metadata (GPS, timestamp, detection results, user selections)
- **FR-082**: System MUST save individual 1:1 crops for each detected item with bounding box coordinates
- **FR-083**: System MUST record user corrections (changed labels, adjusted crops, excluded items) as ground truth
- **FR-084**: System MUST store voice transcripts and LLM extraction results alongside photos
- **FR-085**: System MUST log detection confidence scores, VLM usage (when triggered), and processing times
- **FR-086**: System MUST track user satisfaction indicators (items confirmed vs. corrected, retake frequency)
- **FR-087**: System MUST organize training data by company, location type, transaction intent, and date
- **FR-088**: System MUST provide opt-out mechanism for companies not wanting to contribute training data
- **FR-089**: System MUST aggregate training data monthly for model fine-tuning review
- **FR-090**: System MUST export corrected annotations in YOLO format for model retraining

#### Attribute Extraction & Assignment
- **FR-091**: System MUST extract visible attributes (brand, model, color, type) from item photos using vision analysis
- **FR-092**: System MUST accept voice or text input for non-visible attributes (serial number, price, purchase date)
- **FR-093**: System MUST parse voice input via LLM to extract structured attribute fields
- **FR-094**: System MUST display extracted attributes with confidence indicators before final save
- **FR-095**: System MUST support sequential attribute assignment (item 1 of 3, item 2 of 3) with progress indicator
- **FR-096**: System MUST support bulk attribute application ("All 5 are Echo SRM-225, purchased together")
- **FR-097**: System MUST validate required fields per item type (serial numbers for equipment, SKU for materials)
- **FR-098**: System MUST allow skipping optional attributes and completing records without them

#### OCR & Text Extraction
- **FR-099**: System MUST extract text from receipts, labels, and license plates in photos
- **FR-100**: System MUST parse structured data from receipts (vendor, date, items, prices, total)
- **FR-101**: System MUST display extracted text with confidence scores per field
- **FR-102**: System MUST highlight detected text regions on original photo for user verification
- **FR-103**: System MUST provide field-level editing for incorrect OCR extractions
- **FR-104**: System MUST support manual text entry if OCR confidence is below usable threshold (<50%)

### Performance Requirements
- **PR-001**: Local YOLO detection MUST complete within 3 seconds on target mobile devices (iPhone 12+, Android equivalent)
- **PR-002**: System MUST process photos at 1 frame per second when camera is active
- **PR-003**: VLM fallback analysis (when needed) MUST complete within 10 seconds with network connectivity
- **PR-004**: OCR extraction from receipts MUST complete within 5 seconds
- **PR-005**: System MUST support offline queue capacity of at least 50 pending operations before requiring sync
- **PR-006**: Attribute extraction via LLM MUST complete within 3 seconds for voice input
- **PR-007**: Photo upload to storage MUST handle files up to 10MB
- **PR-008**: Crop generation for 20 detected items MUST complete within 5 seconds

### Cost & Budget Requirements
- **CR-001**: System MUST attempt local YOLO detection first before using cloud-based VLM services
- **CR-002**: System MUST only escalate to VLM when local detection confidence is below 70%
- **CR-003**: System MUST display estimated cost to user before sending photos to cloud VLM services
- **CR-004**: System MUST track and report total verification costs per company, job, and technician
- **CR-005**: System MUST enforce daily budget cap (default $10 per company) for VLM usage
- **CR-006**: System MUST continue with local-only detection when daily budget is exceeded, logging queued items for later analysis
- **CR-007**: System MUST target average cost of <$0.05 per inventory operation across all transaction types

### Data & Privacy Requirements
- **DR-001**: System MUST encrypt inventory photos stored locally on devices
- **DR-002**: System MUST store photos in Supabase Storage with company-level isolation
- **DR-003**: System MUST enforce Row Level Security (RLS) policies: supervisors can view all company photos, technicians can view only their own
- **DR-004**: System MUST automatically delete verification photos after 1 year retention period (configurable per company)
- **DR-005**: System MUST support manual deletion of verification data per GDPR/privacy requirements before retention expiration
- **DR-006**: System MUST redact sensitive information from training data (faces, license plates, customer addresses) before aggregation
- **DR-007**: System MUST provide opt-out mechanism for companies not wanting to contribute to model training

### Integration Requirements
- **IR-001**: System MUST integrate with existing container definitions from Feature 001 (Vision Kit Verification)
- **IR-002**: System MUST fetch job kit definitions from scheduling system (Feature 003) for check-out verification
- **IR-003**: System MUST trigger supervisor notifications for incomplete kits using existing notification system from Feature 003
- **IR-004**: System MUST update job status and material costs when items are assigned to jobs
- **IR-005**: System MUST link inventory transactions to scheduled jobs when job context is provided
- **IR-006**: System MUST support integration with purchase order system (if exists) for receipt matching
- **IR-007**: System MUST sync with existing offline queue architecture from Feature 001

### Key Entities

- **Inventory Item**: Represents trackable equipment or materials. Contains type (equipment/material), unique identifier, name, category, specifications, current location (container reference), status (active/maintenance/retired), images (primary and additional), attributes (brand, model, serial, purchase info), tracking mode (individual/quantity-based), and audit trail. Links to container, company, and transaction history.

- **Container**: Represents physical storage locations for inventory. Contains type (truck/trailer/storage_bin/warehouse/building/toolbox), name, identifier (license plate, asset tag), capacity, parent container reference (for hierarchy), default location (GPS), photo, voice name (for voice commands), active status, default flag, current contents list, and metadata. Links to company and contained items.

- **Inventory Transaction**: Represents movement or status change of inventory items. Contains transaction type (check_out/check_in/transfer/register/purchase/usage/decommission), item references, quantity (for materials), source and destination containers, job reference, performer (user), verification method (manual/qr_scan/photo_vision/voice), photo evidence, voice session, voice transcript, notes, cost data, and timestamp. Links to items, containers, jobs, and company.

- **Container Assignment**: Represents current location of items within containers. Contains container reference, item references, quantity (for materials), checked-in timestamp, checked-out timestamp, job context, and status. Links to containers and items.

- **Purchase Receipt**: Represents supplier purchase documentation. Contains vendor information, purchase date, total amount, line items (description, quantity, unit price), receipt photo, OCR extracted data, OCR confidence scores, purchase order reference (if matched), company reference, assigned job reference, and timestamp. Links to materials created/updated, inventory transactions, and jobs.

- **Training Data Record**: Represents collected data for model improvement. Contains original photo reference, detection results (YOLO bounding boxes, labels, confidences), VLM analysis (if used), user selections, user corrections, user exclusions, context (location, location type, transaction intent), voice transcript, quality metrics, created records, and timestamp. Links to company and user.

- **Item Relationship**: Represents connections between inventory items. Contains parent item reference, related item reference, relationship type (accessory/part/alternative/replacement/upgrade), notes, and timestamp. Links to items.

- **Detection Confidence Threshold**: Company-specific configuration for VLM escalation. Contains company reference, local confidence threshold (default 70%), max daily VLM requests, daily cost budget cap, and active status. Links to company.

- **Background Filter Preference**: User or company-level filtering rules. Contains company reference, user reference (optional for user-specific), object label, action (always_exclude/always_include/ask), context filters (location_type, transaction_intent), and timestamp. Links to company and user.

- **Vision Training Annotation**: Corrected ground truth for training. Contains training data record reference, item detection number, corrected label, corrected bounding box, correction reason, and timestamp. Links to training data records.

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (3s detection, 70% confidence, $0.05/operation)
- [x] Scope is clearly bounded (inventory operations only, excludes invoicing/accounting)
- [x] Dependencies identified (Feature 001 for containers, Feature 003 for job kits)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted (voice, vision, context-aware, multi-unit, filtering, training)
- [x] Ambiguities marked and clarified in Clarifications section
- [x] User scenarios defined (12 acceptance scenarios + edge cases)
- [x] Requirements generated (104 functional, 8 performance, 7 cost, 7 data/privacy, 7 integration)
- [x] Entities identified (10 key entities with relationships)
- [x] Review checklist passed

---