# Feature Specification: Vision-Based Kit Verification

**Feature Branch**: `001-vision-based-kit`
**Created**: 2025-09-29
**Status**: Draft
**Input**: User description: "Vision-based kit verification with hybrid YOLO + VLM pipeline for single-photo load verification, offline-capable detection, and container-aware tracking"

## Clarifications

### Session 2025-09-29
- Q: When local detection fails completely AND there's no internet connectivity for cloud fallback, how should the system behave? → A: Allow with warning - technician can proceed but system logs unverified kit and flags for supervisor review
- Q: What is the confidence threshold percentage for escalating from local detection to cloud analysis? → A: 70%
- Q: What is the daily budget cap for cloud vision analysis per company? → A: $10/day
- Q: What is the target maximum time for local detection processing on mobile devices? → A: 3 seconds
- Q: How long should verification photos be retained before automatic deletion? → A: 1 year
- Q: What is the photo capture frame rate when camera is active? → A: 1 frame per second, continues until user intent and all objects detected
- Q: What is the offline photo queue capacity? → A: 50 photos before requiring sync

---

## User Scenarios & Testing

### Primary User Story
A field technician preparing for the day's jobs needs to verify they have loaded all required equipment and materials for their assigned kit. Instead of manually checking each item against a paper checklist (which takes 5-10 minutes and is error-prone), they open the mobile app, point their camera at the loaded truck bed, and take a single photo. The system automatically identifies all visible items, compares them against the required kit definition, and confirms whether the load is complete or highlights missing items. This verification happens instantly even without internet connectivity, with results saved for supervisor review.

### Acceptance Scenarios

1. **Given** a technician has loaded their truck with a "Small Yard Kit" **When** they take a photo of the truck bed **Then** the system identifies all visible items (mower, trimmer, blower) and displays "Kit Verified ✓" with a green confirmation

2. **Given** a technician is missing a required item (chainsaw) from their kit **When** they take a verification photo **Then** the system highlights "Missing: Chainsaw" in red and prompts them to either load the item or log an override reason

3. **Given** the technician is in an area with no internet connectivity **When** they take a verification photo **Then** the system processes the image locally, provides immediate feedback, and queues the result for later sync

4. **Given** the local detection system has low confidence in its results (unclear image, poor lighting) **When** verification completes **Then** the system requests permission to send the photo to a cloud service for enhanced analysis, showing the estimated cost before proceeding

5. **Given** a technician has items split across multiple containers (truck bed, trailer, storage bins) **When** they take photos of each container **Then** the system associates detected items with their respective containers and shows which container holds which equipment

6. **Given** a supervisor reviewing end-of-day reports **When** they open the verification history **Then** they see all kit verification attempts, success rates, frequently missing items, and photos of incomplete loads for coaching opportunities

### Edge Cases
- What happens when the photo is too dark or blurry to process reliably?
- How does the system handle items that look similar (different models of the same equipment type)?
- What if the technician takes a photo before the truck is fully loaded?
- How does the system behave when the kit definition changes mid-day (seasonal variant switch)?
- When offline detection fails and there's no connectivity for cloud fallback, technician can proceed with warning and system flags for supervisor review
- How does the system handle items that are partially visible or stacked on top of each other?

## Requirements

### Functional Requirements

#### Core Verification
- **FR-001**: System MUST allow technicians to initiate kit verification by taking a photo through the mobile app camera
- **FR-002**: System MUST automatically detect and identify equipment/materials visible in verification photos
- **FR-003**: System MUST compare detected items against the assigned kit definition for that job/day
- **FR-004**: System MUST display clear visual feedback showing which required items are present and which are missing
- **FR-005**: System MUST complete verification and display results within 30 seconds of photo capture

#### Offline Operation
- **FR-006**: System MUST perform item detection locally on the device without requiring internet connectivity
- **FR-007**: System MUST queue verification results for sync when connectivity is unavailable
- **FR-008**: System MUST provide the same verification workflow whether online or offline
- **FR-009**: System MUST cache kit definitions locally so technicians can verify loads without connectivity

#### Cost Optimization
- **FR-010**: System MUST attempt local detection first before using cloud-based analysis services
- **FR-011**: System MUST only escalate to cloud analysis when local detection confidence is below 70%
- **FR-012**: System MUST display estimated cost to the user before sending photos to cloud services
- **FR-013**: System MUST track and report total verification costs per company/job/technician
- **FR-014**: System MUST prevent cloud analysis when daily budget cap of $10 per company is reached

#### Container Awareness
- **FR-015**: System MUST allow technicians to associate verification photos with specific containers (truck, trailer, bin)
- **FR-016**: System MUST track which items are in which containers
- **FR-017**: System MUST allow users to view kit contents organized by container
- **FR-018**: System MUST support verification of items across multiple containers for a single kit

#### Audit & Reporting
- **FR-019**: System MUST store all verification attempts with timestamp, technician, result, and photo
- **FR-020**: System MUST allow supervisors to review verification history and photos
- **FR-021**: System MUST generate reports showing verification success rates and frequently missing items
- **FR-022**: System MUST log reasons when technicians override missing item warnings

#### Error Handling
- **FR-023**: System MUST provide clear guidance when photo quality is insufficient for detection
- **FR-024**: System MUST allow technicians to retake photos if results are incorrect
- **FR-025**: System MUST allow manual item selection if automated detection fails completely
- **FR-026**: System MUST allow technicians to proceed with job when both local and cloud processing are unavailable, displaying a warning and logging the kit as unverified for supervisor review

#### Integration
- **FR-027**: System MUST integrate with existing kit definitions from the scheduling system (Feature 003)
- **FR-028**: System MUST update kit verification status in job records
- **FR-029**: System MUST trigger supervisor notifications when kits are verified incomplete using existing notification system from Feature 003

### Performance Requirements
- **PR-001**: Local detection MUST complete within 3 seconds on target mobile devices
- **PR-002**: System MUST capture and process verification photos at 1 frame per second, continuing until user intent and all required objects are detected
- **PR-003**: Offline photo queue MUST support at least 50 photos before requiring sync
- **PR-004**: Cloud analysis (when needed) MUST complete within 10 seconds

### Data & Privacy Requirements
- **DR-001**: System MUST encrypt verification photos stored locally on devices
- **DR-002**: System MUST automatically delete verification photos after 1 year retention period
- **DR-003**: System MUST support manual deletion of verification data per GDPR/privacy requirements before the 1 year expiration
- **DR-004**: System MUST restrict access to verification photos based on company-level RLS policies, with supervisors able to view all company photos and technicians able to view only their own

### Key Entities

- **Vision Verification Record**: Represents a single verification attempt. Contains technician ID, kit ID, timestamp, photo reference (Supabase Storage), detected items list, confidence scores, verification result (complete/incomplete), and processing method used (local/cloud). Links to job and container records.

- **Detected Item**: Represents an item identified in a verification photo. Contains item type, confidence score, bounding box coordinates, associated container, and match status against expected kit items.

- **Container Assignment**: Represents the physical location of items. Contains container ID, container type (truck/trailer/bin), associated kit items, capacity information, and verification photo references.

- **Verification Cost Record**: Tracks costs associated with cloud-based analysis. Contains verification ID, cloud provider used, cost amount, company ID for cost allocation, and processing timestamp.

- **Detection Confidence Threshold**: Company-specific configuration determining when to escalate to cloud analysis. Contains threshold percentage (default 70%), maximum daily cloud requests, and cost budget limits.

---

## Dependencies

- **Feature 003 (Scheduling & Kits)**: Provides kit definitions, kit assignments, and notification system
- **Existing Infrastructure**: PWA foundation, offline sync, RLS policies, Supabase Storage buckets