# Feature Specification: MVP Intent-Driven Mobile App

**Feature Branch**: `007-mvp-intent-driven`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "MVP intent-driven mobile app with camera-based inventory management, job assignment, and crew workflows"

## Execution Flow (main)
```
1. Parse user description from Input
   → ✓ Identified: camera-based intent recognition, inventory, jobs, crew workflows
2. Extract key concepts from description
   → Actors: Supervisors, Crew Members
   → Actions: inventory management, job creation/assignment, load verification
   → Data: items, jobs, users, receipts, maintenance events
   → Constraints: MVP scope, camera-driven interactions
3. For each unclear aspect:
   → Marked with [NEEDS CLARIFICATION] tags throughout
4. Fill User Scenarios & Testing section
   → ✓ Primary flows defined for both user types
5. Generate Functional Requirements
   → ✓ 44 core requirements defined, all testable
6. Identify Key Entities
   → ✓ 12 primary entities identified
7. Run Review Checklist
   → WARN "Spec has uncertainties" - multiple clarifications needed
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-01-27
- Q: Authentication method for user registration? → A: Email + Password only
- Q: Maximum jobs per crew member daily limit? → A: 6 jobs per day maximum
- Q: Offline mode capabilities? → A: Limited offline - view jobs, check items (no AI)
- Q: Square thumbnail dimensions? → A: 512x512 pixels (balanced quality/size)
- Q: Multi-company support requirements? → A: Single company now, multi-company later

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Field service companies need a mobile app where supervisors can manage inventory, create jobs, and assign work to crew members. Crew members need to efficiently verify equipment loads using their phone camera and report job status back to supervisors. The system should intelligently understand user intent when they point their camera at items, receipts, or equipment issues. All interactions should be possible through voice commands or simple button choices (max 4 per screen) with AI assistance throughout.

### Acceptance Scenarios

**User Onboarding & Admin:**

1. **Given** a new user signs up, **When** they complete registration, **Then** they are assigned Crew role by default
2. **Given** Super Admin (Mr TopHand) is logged in, **When** they view user management, **Then** they can change any user's role between Crew and Supervisor
3. **Given** user interacts with any screen, **When** making choices, **Then** maximum 4 action buttons are displayed

**Supervisor Workflows:**

4. **Given** supervisor is logged in, **When** they speak "Create new customer", **Then** STT→LLM→TTS pipeline guides them through customer creation
5. **Given** supervisor points camera at a new tool, **When** system detects it's not in inventory, **Then** it offers to add with VLM assistance
6. **Given** supervisor creates entities (property, vehicle, building), **When** capturing images, **Then** system generates square thumbnails
7. **Given** supervisor has added items to inventory, **When** they create a new job, **Then** they can assign inventory items or predefined kits
8. **Given** supervisor assigns job to crew, **When** assignment completes, **Then** crew member receives notification
9. **Given** jobs are active, **When** supervisor asks "Show job status", **Then** voice response provides real-time updates

**Crew Member Workflows:**

10. **Given** crew member logs in, **When** they view dashboard, **Then** they see assigned jobs with details (time, location, special instructions)
11. **Given** crew member has pending job, **When** they point camera at equipment, **Then** VLM assists with load verification
12. **Given** crew member is on job, **When** they speak "Check off task", **Then** STT→LLM guides them through task completion
13. **Given** load list is verified, **When** crew confirms completion, **Then** supervisor receives real-time notification
14. **Given** crew encounters equipment issue, **When** they capture image, **Then** system recognizes maintenance event with voice note option

**General Intent Recognition:**

15. **Given** any user points camera at paper receipt, **When** system detects receipt format, **Then** it offers to scan and record expense
16. **Given** camera is active, **When** user presses Start button, **Then** system begins 1fps capture and intent analysis

**Vehicle/Container Management:**

17. **Given** supervisor points camera at company vehicle, **When** system detects vehicle, **Then** it offers to add to vehicle inventory with square thumbnail
18. **Given** items are in inventory, **When** supervisor assigns them to containers, **Then** system tracks item location hierarchy
19. **Given** job requires specific vehicle, **When** supervisor creates job, **Then** they can assign required vehicles/containers
20. **Given** supervisor has container "Storage Box 3", **When** they assign it to "Truck Bed 2" on "Truck 1", **Then** system maintains full hierarchy path
21. **Given** user searches for an item, **When** item is in nested container, **Then** system shows complete location path (e.g., "Wrench → Box 3 → Truck Bed 2 → Truck 1")

**Data Capture for Analytics:**

22. **Given** any AI interaction occurs, **When** system processes request, **Then** it logs prompt, image, response, timing, and cost
23. **Given** new entity is created, **When** image is captured, **Then** system generates and stores square thumbnail for display

### Edge Cases
- What happens when camera can't identify intent after [NEEDS CLARIFICATION: timeout period]?
- How does system handle poor lighting or blurry images during verification?
- What if crew member doesn't have assigned job but scans inventory items?
- How does app handle offline mode transitions (manual checkbox vs AI verification)?
- What if multiple intents are possible (e.g., item could be inventory add OR job verification)?
- What if user tries to create circular container references (e.g., Box A → Box B → Box A)?
- How does system handle moving items between containers with different hierarchies?
- What happens when a parent container is deleted but has child containers?

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & User Management:**
- **FR-001**: System MUST allow users to create accounts with email and password
- **FR-002**: System MUST support three user roles: Super Admin, Supervisor, and Crew Member (default)
- **FR-003**: System MUST have one default Super Admin user (Mr TopHand, travis@evergold.tech, Shiner2025!)
- **FR-004**: Super Admin MUST be able to change user roles between Crew and Supervisor
- **FR-005**: Supervisors MUST be able to invite new users (defaulting to Crew role)

**Camera Intent Recognition:**
- **FR-006**: System MUST capture images at 1fps when camera mode is active
- **FR-007**: System MUST automatically classify camera input into intents: inventory add, job load verification, receipt scan, or maintenance event
- **FR-008**: System MUST provide visual feedback showing recognized intent within [NEEDS CLARIFICATION: response time target?]

**Inventory Management:**
- **FR-007**: Supervisors MUST be able to add new items to inventory via camera capture
- **FR-008**: System MUST capture and store profile images for all inventory items
- **FR-009**: System MUST detect when shown items are not in existing inventory

**Job Management:**
- **FR-010**: Supervisors MUST be able to create jobs and assign inventory items or kits
- **FR-011**: Supervisors MUST be able to assign jobs to specific crew members
- **FR-012**: System MUST limit jobs per crew member to 6 jobs per day maximum
- **FR-013**: Supervisors MUST be able to reschedule jobs and edit details

**Load Verification:**
- **FR-014**: Crew members MUST be able to verify job load lists using camera
- **FR-015**: System MUST automatically check off detected items from load list
- **FR-016**: System MUST notify supervisor when load verification is complete

**Additional Capabilities:**
- **FR-017**: System MUST store all captured images for [NEEDS CLARIFICATION: retention period?]
- **FR-018**: Users MUST be able to add context via voice or text selection
- **FR-019**: System MUST support customer and property management for job assignment

**Data Capture & Analytics:**
- **FR-020**: System MUST store ALL LLM/VLM interactions including prompts sent, images processed, and responses received
- **FR-021**: System MUST capture performance metrics for each AI interaction (response time, cost, model used)
- **FR-022**: System MUST generate and store 512x512 pixel square thumbnail images for all entities
- **FR-023**: Every entity (items, customers, properties, vehicles, jobs) MUST have a primary display image

**Vehicle/Container Management:**
- **FR-024**: System MUST allow adding vehicles/containers via camera capture
- **FR-025**: System MUST support assigning vehicles to jobs
- **FR-026**: System MUST support assigning items to containers (truck, trailer, building bins)
- **FR-027**: System MUST track item location hierarchy (item → container → vehicle/location)
- **FR-028**: System MUST support nested containers with parent-child relationships (e.g., Box → Truck Bed → Truck, or Bin → Shelf → Building)
- **FR-029**: System MUST distinguish between mobile containers (vehicles) and stationary containers (buildings, storage areas)

**Voice & UI Interaction:**
- **FR-030**: System MUST provide STT (Speech-to-Text) → LLM → TTS (Text-to-Speech) pipeline for voice interactions
- **FR-031**: Mobile interface MUST limit choices to maximum 4 buttons per screen
- **FR-032**: All entity creation and editing MUST be possible via voice or camera guidance
- **FR-033**: System MUST provide voice feedback for all major actions

**Supervisor Capabilities:**
- **FR-034**: Supervisors MUST be able to create all entity types (item, property, customer, vehicle, container, building, job)
- **FR-035**: Supervisors MUST be able to view real-time status of all jobs and load lists
- **FR-036**: Supervisors MUST be able to edit any entity via voice or camera

**Crew Member Capabilities:**
- **FR-037**: Crew members MUST be able to view their assigned jobs
- **FR-038**: Crew members MUST be able to check off job tasks
- **FR-039**: System MUST show job details including operations/steps, scheduled time, and special instructions
- **FR-040**: Crew members MUST receive notifications for new job assignments

**Offline Capabilities:**
- **FR-041**: System MUST allow viewing assigned jobs and job details while offline
- **FR-042**: System MUST allow manual checking of load list items offline (without AI verification)
- **FR-043**: System MUST sync offline changes when connectivity is restored

**System Constraints:**
- **FR-044**: System MUST support single company operations for MVP (multi-company architecture deferred)

### Key Entities *(include if feature involves data)*

- **User**: Represents system users with role (Super Admin/Supervisor/Crew), authentication credentials, profile info, square profile image
- **Inventory Item**: Physical equipment/tools with name, square thumbnail, category, container assignment, availability
- **Job**: Work assignment with customer, property, scheduled time, duration, assigned items/vehicles, special instructions, job image
- **Job Assignment**: Links jobs to crew members with status tracking
- **Load Verification**: Records camera-based verification of job items with timestamps and completion status
- **Receipt**: Scanned expense receipts with OCR data, amount, date, category
- **Maintenance Event**: Equipment issues captured via camera with severity, notes, resolution status
- **Vehicle/Container**: Hierarchical storage entities with name, type (mobile/stationary), capacity, parent container reference, square image, current location
- **Customer**: Client information with contact details, square profile image, associated properties
- **Property**: Service locations with address, access notes, square image, assigned customer
- **AI Interaction Log**: Complete record of LLM/VLM calls with prompts, images, responses, performance metrics, costs
- **Job Task**: Individual steps/operations within a job that crew members check off, with description and completion status

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain (6 items need clarification)
- [ ] Requirements are testable and unambiguous  
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

**Items Needing Clarification:**
1. Authentication method (email, phone, or both)
2. Camera intent recognition timeout period
3. Response time targets for intent detection
4. Maximum jobs per crew member per day
5. Image retention period for audit/analysis
6. Offline mode capabilities and limitations
7. Multi-company support requirements
8. AI interaction log retention period
9. Square thumbnail dimensions (e.g., 256x256, 512x512)
10. Container hierarchy depth limits (e.g., item → bin → shelf → trailer)
11. Vehicle capacity tracking requirements

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed (with warnings)

---