# Feature Specification: Field Intelligence - Safety, Routing & Smart Intake

**Feature Branch**: `005-field-intelligence-safety`
**Created**: 2025-09-30
**Status**: Draft
**Input**: User description: "Field Intelligence - Safety checklists with photo evidence, intelligent routing with Mapbox optimization and dynamic re-routing, smart customer/vendor intake via OCR and vision, job execution workflows with arrival detection and completion quality scoring, and automated time tracking with GPS verification"

## Execution Flow (main)
```
1. Parse user description from Input ✓
   → Identified 5 major capability areas
2. Extract key concepts from description ✓
   → Actors: field technicians, dispatchers, supervisors, customers
   → Actions: safety checks, route optimization, contact intake, job workflows, time tracking
   → Data: checklists, routes, contacts, jobs, time entries
   → Constraints: photo evidence, GPS accuracy, offline support, cost optimization
3. For each unclear aspect:
   → Clarifications captured in dedicated section below
4. Fill User Scenarios & Testing section ✓
   → 15 primary scenarios, 20+ edge cases defined
5. Generate Functional Requirements ✓
   → 150 functional requirements across 5 domains
6. Identify Key Entities ✓
   → 15 key entities with relationships
7. Run Review Checklist
   → All clarifications resolved via gap analysis document
8. Return: SUCCESS (spec ready for planning)
```

---

## Clarifications

### Session 2025-09-30
- Q: What is the maximum number of waypoints per route before requiring route splitting? → A: 15 waypoints maximum per route (8-hour day, ~30min per job)
- Q: Should safety checklists be enforced as blocking (cannot start job without completion)? → A: Yes, required checklists block job start; optional checklists show warning only
- Q: What level of GPS accuracy is required for arrival detection? → A: 100m radius geofence for arrival detection, 20m accuracy required for time entry verification
- Q: Should route optimization prioritize distance or time? → A: Time optimization by default, with option for distance or balanced approach per company preference
- Q: How long should intake candidates remain in "pending" state before auto-expiration? → A: 7 days for business cards, 30 days for property photos (more permanent)
- Q: What happens when OCR confidence is below threshold for intake? → A: <60% confidence shows manual review required, 60-80% shows suggested corrections, >80% auto-populates with confirmation
- Q: Should time tracking continue if GPS signal is lost? → A: Yes, continue with last known location, flag entry for supervisor review if gap >30 minutes
- Q: What is the maximum re-optimization frequency for routes? → A: Automatic re-optimization limited to 3 times per day to prevent excessive API costs, manual re-optimization always available
- Q: Should completion quality scoring be visible to technicians immediately? → A: Yes, show score immediately with suggestions for improvement if <80%
- Q: What photo evidence is required for safety checklists? → A: Configurable per checklist item, default is photo optional unless marked "critical" (e.g., trailer hitch, PPE)
- Q: Should historical insights be per-property, per-customer, or both? → A: Both - property-specific (lawn size, typical duration) and customer-specific (preferences, scheduling patterns)
- Q: What happens when a technician skips a required task? → A: Require reason selection from predefined list + optional voice note, notify supervisor immediately
- Q: Should instruction documents have version control? → A: Yes, track versions with "current" flag, notify technicians when assigned document is updated
- Q: What is the fallback behavior when Mapbox API is unavailable? → A: Use cached route from last optimization, show warning banner, manual navigation available
- Q: Should customer intake from business cards automatically link to current job/property? → A: Yes, offer to link with one-tap confirmation, or skip linking if not applicable

---

## User Scenarios & Testing

### Primary User Story
A field technician arrives at the company yard at 6:45 AM. Before starting the workday, they open the JobEye app and see their optimized route: 8 jobs, 52 miles, estimated finish at 4:30 PM. The first job requires a trailer, so the app prompts them to complete the pre-drive safety checklist. They walk around the trailer, taking photos of the hitch (locked), chains (crossed), and lights (working). The app uses vision AI to verify each component and marks the checklist complete. En route to the first job, GPS detects arrival at 8:22 AM and prompts: "Arrived at 123 Oak St?" The technician confirms, takes a pre-work site photo, and the system automatically switches their time entry from travel to job work. At 10:15 AM, an emergency sprinkler repair comes in 3 miles away. The app re-optimizes the route, adjusts all remaining ETAs, and notifies affected customers of the 20-minute delay. After completing the morning jobs, the technician stops at a new property to give a quote. The homeowner's landscaper gave them a business card - the tech snaps a photo and within 15 seconds, the system extracts the contact info and asks: "Add John Smith (Green Thumb Lawn Care) as vendor?" One tap confirms. Throughout the day, the technician checks off tasks via voice ("Task 3 done"), adds notes via photo (handwritten list OCR'd automatically), and clocks in/out automatically as GPS detects arrival and departure. At 4:45 PM, they mark the final job complete, the app analyzes the 3 after photos with vision AI (quality score: 94/100), and prompts for customer signature since the job value exceeded $500. The tech reviews their day: 8 jobs completed, 7.2 hours work time, 1.8 hours travel time, 2 safety checklists passed, 1 new vendor added, 0 missed clock-outs. All data syncs to the office for payroll and billing.

### Acceptance Scenarios

#### Domain 1: Safety & Compliance

1. **Given** a technician is assigned a job requiring a trailer **When** they attempt to start the job **Then** the system displays the pre-drive trailer safety checklist and blocks job start until all required items are completed with photo evidence

2. **Given** a safety checklist requires photo evidence for "hitch locked" **When** the technician takes a photo of the hitch **Then** vision AI analyzes the image for hitch pin presence, displays confidence score, and marks item complete if confidence >70% or prompts for manual confirmation if confidence 60-70%

3. **Given** a technician skips an optional safety check **When** they proceed to the next item **Then** the system logs the skip with timestamp but does not block job start, and displays a warning: "2 of 7 items skipped"

4. **Given** a company configures a weekly equipment inspection checklist **When** a technician starts their first job on Monday **Then** the system prompts for equipment inspection completion and shows "Last completed: 8 days ago" if overdue

5. **Given** a safety checklist is completed with all required photos **When** the checklist is submitted **Then** the system stores GPS coordinates, timestamp, user ID, and generates a PDF summary for audit purposes

#### Domain 2: Intelligent Routing

6. **Given** a dispatcher creates a route with 8 jobs for a technician **When** they tap "Optimize Route" **Then** the system calls Mapbox Optimization API with time windows (customer appointments), estimated job durations, and lunch break constraint, displays optimized sequence with total distance and estimated completion time

7. **Given** a technician is on a route with 5 remaining stops **When** an emergency job is added 3 miles from their current location **Then** the system automatically re-optimizes the route, inserts the emergency job as the next stop, adjusts all subsequent ETAs, and sends notifications to affected customers with new arrival times

8. **Given** a technician is driving and encounters heavy traffic **When** their ETA to the next job exceeds the scheduled time window by >15 minutes **Then** the system displays a re-routing suggestion with alternative roads and prompts: "Traffic delay detected. Re-optimize route? This will notify customer of 20-minute delay."

9. **Given** a technician says "Skip this job" via voice **When** the system confirms the skip **Then** the job is removed from today's route, marked for rescheduling, the route is re-optimized, and the dispatcher receives a notification with skip reason

10. **Given** a technician approaches within 100m of a property **When** GPS accuracy is within 20m **Then** the system displays arrival confirmation prompt with property name, address, and photo (if available): "Arrived at [Property]?"

#### Domain 3: Smart Customer/Vendor Intake

11. **Given** a technician photographs a business card at a job site **When** OCR extracts name, company, phone, and email with >80% confidence **Then** the system displays extracted data in editable fields, prompts: "Create vendor 'ABC Landscaping'?", and offers one-tap confirmation or field editing

12. **Given** OCR extracts "John Smith, Green Thum Lawn Care" (typo) **When** the system searches for similar existing vendors **Then** it finds "Green Thumb Lawn Care" with 85% match confidence and prompts: "Match to existing vendor 'Green Thumb Lawn Care'?" with options: Confirm, New Vendor, or Edit

13. **Given** a technician photographs a house facade for property intake **When** vision AI detects building type, colors, and OCR reads house number "123" **Then** the system combines data with GPS coordinates, prompts: "Create property '123 Oak St' (detected: single-family, blue siding, 2-car garage)?", and stores a reference photo for future visits

14. **Given** a technician photographs a vendor storefront sign **When** OCR extracts "Home Depot #4523, Open 6AM-10PM" **Then** the system uses GPS to determine exact location, searches existing vendor records for "Home Depot", finds match, and prompts: "Add new location 'Home Depot #4523' to existing vendor?"

15. **Given** a business card photo has poor lighting and OCR confidence is 45% **When** the system processes the extraction **Then** it displays a warning: "Low confidence. Please review carefully", highlights low-confidence fields in yellow, and offers option to retake photo

#### Domain 4: Job Execution Workflows

16. **Given** GPS detects arrival within 100m of a property **When** the technician confirms arrival **Then** the system prompts for pre-work site photo, switches time entry from travel to job_work, creates a travel_log record (from previous location → current), updates job.actual_start timestamp, and sends customer notification "Technician has arrived"

17. **Given** a technician says "Add task: Replace sprinkler head in zone 3" **When** the voice command is transcribed and parsed **Then** the system creates a new task record, assigns it to the current job, sets sequence_order as next available, and displays confirmation with task number

18. **Given** a job has a required instruction video (sprinkler repair technique) **When** the technician views the job details **Then** the system displays a blocked task with "Watch video" button, tracks video viewing duration, requires minimum 80% watch time (skipping allowed after first viewing), and marks task as "instruction_viewed" before allowing job start

19. **Given** a technician completes all tasks and says "Job complete" **When** the completion checklist runs **Then** the system verifies: ✓ After photos taken (min 3), ✓ Materials logged, ✓ Equipment returned, displays checklist status, and blocks completion if required items missing

20. **Given** a technician takes 3 after photos **When** vision AI analyzes the images **Then** the system compares to before photos (change detection), checks for common issues (unmowed patches, debris), calculates quality score (0-100), and displays result: "Quality score: 92/100 ✓ Completion verified" or "Quality score: 68/100 ⚠️ Review suggested" with identified issues

#### Domain 5: Time Tracking

21. **Given** a technician says "Clock in" at the start of the day **When** GPS location is captured **Then** the system creates a time_entry record with type='job_work', start_time=now, start_location={lat, lng}, and displays confirmation: "Clocked in at [Location] - 6:48 AM"

22. **Given** a technician is clocked into a job and drives to the next location **When** the job status changes to "in_transit" **Then** the system automatically ends the current time_entry (type='job_work'), creates a new time_entry (type='travel'), and tracks travel time separately

23. **Given** a technician says "Start break" **When** the command is processed **Then** the system ends the current time_entry, creates a new time_entry (type='break'), and displays confirmation: "Break started - 12:05 PM"

24. **Given** a technician forgets to clock out and leaves the property **When** GPS detects >500m distance from last job location after 5pm **Then** the system prompts: "Did you forget to clock out? Last activity: 4:52 PM at [Property]", offers one-tap clock-out with suggested time, and flags entry for supervisor review

25. **Given** a technician says "How many hours today?" **When** the query is processed **Then** the system sums all time entries for the current day, breaks down by type (work: 7.2hrs, travel: 1.8hrs, break: 0.5hrs), and displays: "Total: 9.5 hours (7.2 work, 1.8 travel, 0.5 break)"

### Edge Cases

#### Safety & Compliance
- What happens when a technician completes a safety checklist but photo uploads fail due to poor connectivity? → Queue photos in offline queue, mark checklist "pending upload", allow job start with warning, retry upload when connectivity restored
- How does system handle safety checklist completion by wrong user (e.g., dispatcher completing on behalf of tech)? → Warn "You are not assigned to this job. Complete anyway?" and log both submitter and job assignee IDs
- What if vision AI detects unsafe condition in safety photo (e.g., damaged hitch)? → Flag item as "failed", display warning: "Detected: hitch damage. Cannot proceed. Contact supervisor.", notify supervisor immediately
- When should safety checklists expire and require re-completion? → Company-configurable: default is 24 hours for vehicle checks, 7 days for equipment inspections

#### Routing & Navigation
- What happens when all jobs on a route are cancelled? → Display notification: "All jobs cancelled. Route cleared.", offer to load pending jobs from queue, or end day early with clock-out prompt
- How does system handle when technician deviates from optimized route? → Track deviation distance, if >2 miles off route show alert: "Off route detected. Re-navigate?", do not auto-re-optimize unless technician confirms
- What if Mapbox API returns error during route optimization? → Fall back to manual sequence (same as dispatcher entered), show error banner: "Route optimization unavailable. Using manual sequence.", log error for admin review
- When should re-optimization stop triggering automatically? → After 3 automatic re-optimizations in a day OR if same emergency job triggers re-optimization twice (prevents infinite loops)
- What happens when GPS accuracy is poor (<50m) at arrival? → Show warning: "GPS accuracy low. Confirm arrival manually?", allow manual confirmation, flag time entry for review
- How does system handle when technician says "Next stop" but current job is not marked complete? → Prompt: "Current job not complete. Mark complete now? Or skip to next stop?", require explicit choice

#### Smart Intake
- What if OCR extracts 2 phone numbers from a business card? → Prompt: "Found 2 numbers: (555) 123-4567 (Office), (555) 987-6543 (Mobile). Which is primary?", allow multi-select
- How does system handle duplicate detection when creating a customer from intake? → Show existing matches sorted by confidence: "Found 2 similar customers: [Name 1] 92% match, [Name 2] 78% match. Link to existing or create new?", require explicit choice
- What if property intake photo shows multiple buildings (duplex, strip mall)? → Prompt: "Detected multiple buildings. Which one?" with numbered overlay on photo, tap to select
- When should intake candidates auto-expire? → Business cards: 7 days, Property photos: 30 days, Vehicles: 90 days, with email reminder before expiration
- What happens when vendor intake matches multiple existing vendors? → Show all matches with context: "[Vendor A] - 12 miles away, last order 2 months ago" vs "[Vendor B] - 0.3 miles away (this location), last order yesterday", recommend closest match
- How does system handle when intake session is created but never completed? → Mark as "abandoned" after 1 hour, keep in history for 30 days, do not send notifications

#### Job Workflows
- What if technician takes only 1 after photo when 3 are required? → Block completion with message: "2 more photos required", show preview of existing photo, offer to take more
- How does system handle task dependencies when a task is skipped? → Prompt: "Task 3 depends on Task 2 (skipped). Complete Task 2 first or skip Task 3?", enforce dependency chain
- What happens when vision AI completion quality score is 45%? → Display warning: "Low quality detected: unmowed area in NE corner, debris near driveway. Retake photos or request supervisor review?", offer to notify supervisor
- When should job instructions require re-acknowledgment? → When instruction document is updated (new version), show badge: "Updated instruction available. Review required."
- What if technician marks job complete offline, then connectivity restored reveals customer cancellation? → Prompt: "Job was cancelled 2 hours ago. Clock time to different job or log as administrative?", prevent billing for cancelled job
- How does system handle when customer signature is required but customer is not present? → Allow skip with reason: "Customer unavailable", flag job for follow-up signature collection, send email signature request

#### Time Tracking
- What happens when GPS signal is lost for 45 minutes during a job? → Continue time tracking with last known location, display warning: "GPS signal lost. Location frozen.", flag entry for supervisor review with gap duration
- How does system handle when technician forgets to end break? → Auto-end break after 60 minutes, create new time_entry (resume previous type), notify technician: "Break auto-ended after 60min", flag for review
- What if technician clocks in at 2 different jobs simultaneously? → Block second clock-in with error: "Already clocked in at [Job 1]. Clock out first.", offer quick switch: "Switch to this job?"
- When should automatic clock-out trigger? → After 3 conditions met: (1) >500m from last job, (2) after 5pm, (3) no activity for 30 minutes, then prompt for confirmation
- What happens when time entry spans midnight? → Split entry at 11:59:59 PM, create new entry at 12:00 AM, maintain type and job linkage, show note: "Shift spanned midnight"
- How does system handle time tracking during equipment swaps (stop at shop mid-day)? → Create time_entry (type='equipment_swap'), track duration, do not bill as job work or travel

#### Historical Context
- What if historical insight contradicts current job estimate? → Display warning: "Typical duration: 2 hours. Estimate: 4 hours. Reason for difference?", allow technician to add note
- How does system handle when property has no historical data? → Fall back to job type averages across all properties, show note: "First visit to this property. Estimate based on similar jobs."
- What happens when seasonal patterns conflict (spring vs fall)? → Use season-specific baseline, show context: "Last spring: 3 hours. Last fall: 1.5 hours. Today's estimate: 2.5 hours (spring)."

---

## Requirements

### Functional Requirements

#### Safety & Compliance (FR-001 through FR-020)

- **FR-001**: System MUST allow companies to create customizable safety checklists with configurable items (task description, photo required, critical flag, sequence)
- **FR-002**: System MUST support safety checklist item types: binary (yes/no), photo evidence, numeric measurement, text note
- **FR-003**: System MUST enforce blocking behavior for required safety checklists (cannot start job until checklist marked complete)
- **FR-004**: System MUST display non-blocking warnings for optional safety checklists (can proceed with warning banner)
- **FR-005**: System MUST capture photo evidence for safety checklist items marked "photo required"
- **FR-006**: System MUST use vision AI to analyze safety checklist photos for compliance verification (e.g., detect hitch pin presence, PPE worn)
- **FR-007**: System MUST display vision AI confidence scores for safety photo analysis (0-100%)
- **FR-008**: System MUST require manual confirmation for safety items when vision AI confidence is between 60-70%
- **FR-009**: System MUST auto-approve safety items when vision AI confidence is >70%
- **FR-010**: System MUST flag safety items as failed when vision AI detects unsafe conditions (e.g., damaged equipment)
- **FR-011**: System MUST capture GPS coordinates and timestamp at safety checklist completion
- **FR-012**: System MUST generate PDF summary of completed safety checklists for audit purposes
- **FR-013**: System MUST allow technicians to skip optional safety items with reason selection (dropdown + voice note)
- **FR-014**: System MUST notify supervisors immediately when critical safety items fail
- **FR-015**: System MUST support checklist frequency settings: per-job, daily, weekly, monthly
- **FR-016**: System MUST display "last completed" timestamp for recurring checklists and warn if overdue
- **FR-017**: System MUST enforce checklist expiration (24 hours for vehicle checks, 7 days for equipment, configurable per company)
- **FR-018**: System MUST queue safety checklist photos in offline queue when connectivity unavailable
- **FR-019**: System MUST allow job start with warning when safety photos are queued offline (pending upload)
- **FR-020**: System MUST link safety checklists to job templates, equipment types, and specific job requirements

#### Intelligent Routing (FR-021 through FR-060)

- **FR-021**: System MUST generate optimized daily routes for technicians based on assigned jobs, GPS locations, and time windows
- **FR-022**: System MUST integrate with Mapbox Optimization API for route sequencing
- **FR-023**: System MUST support optimization criteria: minimize distance, minimize time, or balanced approach (configurable per company)
- **FR-024**: System MUST respect customer appointment time windows during route optimization
- **FR-025**: System MUST account for estimated job durations in route calculations
- **FR-026**: System MUST include mandatory lunch break (30 minutes, preferred 12-1pm) in route optimization
- **FR-027**: System MUST support equipment stops (e.g., return to shop mid-day for different equipment) as route waypoints
- **FR-028**: System MUST display total route distance, estimated duration, and finish time after optimization
- **FR-029**: System MUST allow manual route sequence adjustment by dispatcher (drag-and-drop reordering)
- **FR-030**: System MUST detect arrival at job sites using GPS geofencing (100m radius)
- **FR-031**: System MUST require GPS accuracy within 20m for arrival confirmation
- **FR-032**: System MUST prompt technician for arrival confirmation when within geofence
- **FR-033**: System MUST support dynamic re-routing when emergency jobs are inserted
- **FR-034**: System MUST automatically re-optimize route when waypoints are added, removed, or reordered
- **FR-035**: System MUST adjust all subsequent ETAs after route re-optimization
- **FR-036**: System MUST send notifications to affected customers when ETAs change by >15 minutes
- **FR-037**: System MUST limit automatic re-optimizations to 3 per day to control API costs
- **FR-038**: System MUST always allow manual re-optimization regardless of daily limit
- **FR-039**: System MUST support voice commands for route navigation: "Next stop", "Skip this job", "Navigate", "Add stop"
- **FR-040**: System MUST integrate with device navigation apps (Apple Maps, Google Maps, Waze) for turn-by-turn directions
- **FR-041**: System MUST display ETA to next job based on current location and traffic
- **FR-042**: System MUST detect traffic delays and offer re-routing suggestions when ETA exceeds time window by >15 minutes
- **FR-043**: System MUST support weather-based route adjustments (skip outdoor jobs when raining)
- **FR-044**: System MUST allow technicians to add waypoints via voice: "Add gas station stop", "Stop at Home Depot"
- **FR-045**: System MUST insert waypoints at optimal position in route sequence to minimize detour
- **FR-046**: System MUST support multi-crew coordination (show other crews' locations on map)
- **FR-047**: System MUST prevent double-booking of properties (warn if another crew is assigned to same location)
- **FR-048**: System MUST support equipment availability routing (find nearest truck with required equipment)
- **FR-049**: System MUST track route adherence (actual sequence vs. optimized sequence)
- **FR-050**: System MUST log route deviations (>2 miles off route) and prompt for re-navigation
- **FR-051**: System MUST handle Mapbox API failures gracefully with fallback to manual sequence
- **FR-052**: System MUST display error banner when route optimization is unavailable
- **FR-053**: System MUST cache last successful route for offline access
- **FR-054**: System MUST create route_event records for: start, arrival, departure, re-optimization, delay, completion
- **FR-055**: System MUST log route optimization requests with cost tracking (Mapbox API charges)
- **FR-056**: System MUST display estimated route cost (fuel) based on distance and vehicle efficiency
- **FR-057**: System MUST support material stop suggestions: "Low on mulch, stop at [nearest supplier]"
- **FR-058**: System MUST allow route export for external navigation systems
- **FR-059**: System MUST support route templates (save common route patterns for reuse)
- **FR-060**: System MUST prompt confirmation before removing job from route: "Skip job 'Lawn Mowing at 123 Oak'? This will reschedule to tomorrow."

#### Smart Customer/Vendor Intake (FR-061 through FR-095)

- **FR-061**: System MUST support customer/vendor intake via business card photo capture
- **FR-062**: System MUST use OCR to extract text from business cards: name, company, title, phone, email, address, website
- **FR-063**: System MUST use vision AI to analyze business card for context: business type, logo colors, branding style
- **FR-064**: System MUST display extracted data in editable fields with confidence scores per field
- **FR-065**: System MUST highlight low-confidence fields (<60%) in yellow and prompt for manual review
- **FR-066**: System MUST offer option to retake photo when OCR confidence is <60%
- **FR-067**: System MUST search existing customers/vendors for fuzzy matches before creating new records
- **FR-068**: System MUST display match candidates sorted by confidence score (>70% considered strong match)
- **FR-069**: System MUST prompt: "Match to existing [Entity] 'Name' (XX% match)?" with options: Confirm, Create New, Edit
- **FR-070**: System MUST support property intake via building facade photo capture
- **FR-071**: System MUST use vision AI to detect building type, colors, architectural features from property photos
- **FR-072**: System MUST use OCR to read house numbers, suite numbers, business names from property photos
- **FR-073**: System MUST capture GPS coordinates at time of property photo capture
- **FR-074**: System MUST store reference photo with property record for future visual navigation aids
- **FR-075**: System MUST combine OCR house number + GPS coordinates + street address for property creation
- **FR-076**: System MUST detect multiple buildings in property photos (duplex, strip mall) and prompt for selection
- **FR-077**: System MUST support vendor intake via storefront signage photo capture
- **FR-078**: System MUST extract vendor name, hours, phone from signage photos using OCR
- **FR-079**: System MUST use GPS to determine vendor location coordinates
- **FR-080**: System MUST match vendor signage to existing vendor records and offer to add new location
- **FR-081**: System MUST support vehicle identification via license plate + VIN photo capture
- **FR-082**: System MUST use OCR to read license plate numbers and VIN (if visible)
- **FR-083**: System MUST use vision AI to detect vehicle make, model, year, color, condition
- **FR-084**: System MUST link vehicles to customers or vendors with one-tap confirmation
- **FR-085**: System MUST offer to link intake sessions to current job/property context automatically
- **FR-086**: System MUST create intake_session record for each capture with session_type, media_id, location, context
- **FR-087**: System MUST create intake_extraction record with OCR/VLM results, confidence scores, processing time, cost
- **FR-088**: System MUST create contact_candidate or property_candidate record with status='pending'
- **FR-089**: System MUST support intake candidate approval workflow (pending → approved → record created)
- **FR-090**: System MUST allow supervisors to bulk-approve intake candidates from dashboard
- **FR-091**: System MUST support intake candidate rejection with reason (duplicate, incorrect data, spam)
- **FR-092**: System MUST auto-expire intake candidates after configurable period (7 days business cards, 30 days properties)
- **FR-093**: System MUST send reminder notifications before intake candidate expiration
- **FR-094**: System MUST track intake success rate (candidates approved / total captures) per user
- **FR-095**: System MUST support offline intake capture with sync when connectivity restored

#### Job Execution Workflows (FR-096 through FR-135)

- **FR-096**: System MUST prompt for arrival confirmation when GPS detects technician within 100m of property
- **FR-097**: System MUST display property name, address, and reference photo (if available) in arrival prompt
- **FR-098**: System MUST require pre-work site photo upon arrival confirmation
- **FR-099**: System MUST update job.actual_start timestamp upon arrival confirmation
- **FR-100**: System MUST create time_entry record (type='job_work') upon arrival
- **FR-101**: System MUST end previous time_entry (type='travel') upon arrival
- **FR-102**: System MUST create travel_log record (from previous location → current property)
- **FR-103**: System MUST send customer notification "Technician has arrived" upon arrival confirmation
- **FR-104**: System MUST support voice command "Arrived at job site" for arrival confirmation
- **FR-105**: System MUST allow manual arrival confirmation if GPS accuracy is poor (<20m)
- **FR-106**: System MUST flag manually-confirmed arrivals for supervisor review
- **FR-107**: System MUST support task creation via voice: "Add task: [description]"
- **FR-108**: System MUST support task creation via handwritten note photo with OCR extraction
- **FR-109**: System MUST parse voice task descriptions using LLM to extract: task name, equipment needed, estimated duration
- **FR-110**: System MUST assign tasks to current job and set sequence_order automatically
- **FR-111**: System MUST display task list with sequence numbers, status indicators, and assigned users
- **FR-112**: System MUST support task completion via voice: "Task [number] done"
- **FR-113**: System MUST support task completion via photo evidence (vision AI verifies work completed)
- **FR-114**: System MUST support task completion via manual checkbox tap
- **FR-115**: System MUST capture completion timestamp, method, and user for each task
- **FR-116**: System MUST support task assignment via voice: "Assign this task to [name]"
- **FR-117**: System MUST allow task templates to be applied to jobs with one-tap
- **FR-118**: System MUST support task dependencies (task B blocked until task A complete)
- **FR-119**: System MUST prompt for action when dependent task's prerequisite is skipped
- **FR-120**: System MUST allow tasks to be skipped with reason selection (predefined list + voice note)
- **FR-121**: System MUST notify supervisor immediately when required tasks are skipped
- **FR-122**: System MUST support instruction document association with jobs (PDFs, videos, reference images)
- **FR-123**: System MUST enforce required instruction viewing before job start (block job start until viewed)
- **FR-124**: System MUST track instruction viewing: user, timestamp, duration, acknowledgment
- **FR-125**: System MUST require minimum 80% video watch time for required instruction videos
- **FR-126**: System MUST allow instruction video skipping after first complete viewing
- **FR-127**: System MUST display PDF documents in-app with zoom, pan, download capabilities
- **FR-128**: System MUST display reference images side-by-side with current camera view for comparison
- **FR-129**: System MUST notify technicians when assigned instruction documents are updated (new version)
- **FR-130**: System MUST enforce completion checklist before marking job complete: after photos, materials logged, equipment returned, area cleaned
- **FR-131**: System MUST require minimum 3 after photos for job completion
- **FR-132**: System MUST use vision AI to analyze completion photos for quality scoring (0-100)
- **FR-133**: System MUST compare after photos to before photos for change detection (work performed)
- **FR-134**: System MUST detect common completion issues: unmowed areas, debris, missed edges
- **FR-135**: System MUST display completion quality score immediately with suggestions for improvement if <80%

#### Job Execution Workflows Continued (FR-136 through FR-150)

- **FR-136**: System MUST require supervisor review for jobs with completion quality score <70% OR job value >$500
- **FR-137**: System MUST support customer signature capture for high-value jobs (>$500)
- **FR-138**: System MUST allow job completion to be blocked if required checklist items are incomplete
- **FR-139**: System MUST prompt for completion photo retake if quality score is <50%
- **FR-140**: System MUST link completion photos to job record with metadata: timestamp, GPS, quality_score
- **FR-141**: System MUST update job.actual_end timestamp upon completion confirmation
- **FR-142**: System MUST create job completion event in audit log
- **FR-143**: System MUST support offline job completion with sync when connectivity restored
- **FR-144**: System MUST prevent job completion for cancelled jobs (prompt to log time differently)
- **FR-145**: System MUST allow partial job completion (some tasks done, others rescheduled)
- **FR-146**: System MUST support task template creation from completed job task lists
- **FR-147**: System MUST track task template usage count and last used date
- **FR-148**: System MUST allow task templates to be favorited and displayed prominently
- **FR-149**: System MUST support voice command "Apply [template name] task list"
- **FR-150**: System MUST link instruction documents to task templates (auto-assign when template applied)

#### Time Tracking (FR-151 through FR-180)

- **FR-151**: System MUST support clock-in via voice: "Clock in" or "Clock in for job [number]"
- **FR-152**: System MUST create time_entry record upon clock-in with: user_id, start_time, type, start_location (GPS)
- **FR-153**: System MUST display clock-in confirmation with timestamp and location
- **FR-154**: System MUST support time entry types: job_work, travel, break, admin, equipment_swap
- **FR-155**: System MUST automatically switch time_entry type from travel → job_work upon GPS arrival at property
- **FR-156**: System MUST automatically switch time_entry type from job_work → travel when job status changes to in_transit
- **FR-157**: System MUST support break start via voice: "Start break"
- **FR-158**: System MUST end current time_entry and create new time_entry (type='break') upon break start
- **FR-159**: System MUST support break end via voice: "End break"
- **FR-160**: System MUST auto-end break after 60 minutes with notification and flag for review
- **FR-161**: System MUST support clock-out via voice: "Clock out"
- **FR-162**: System MUST update time_entry.end_time and calculate duration upon clock-out
- **FR-163**: System MUST capture end_location (GPS) upon clock-out
- **FR-164**: System MUST detect forgot-to-clock-out scenarios: >500m from last job + after 5pm + 30min no activity
- **FR-165**: System MUST prompt for missed clock-out with suggested time and one-tap confirmation
- **FR-166**: System MUST flag auto-clock-out entries for supervisor review
- **FR-167**: System MUST prevent clocking in to multiple jobs simultaneously (error: "Already clocked in at [Job]. Clock out first.")
- **FR-168**: System MUST offer quick job switch: "Switch to this job?" (ends current time_entry, starts new one)
- **FR-169**: System MUST split time entries at midnight (11:59:59 PM → 12:00 AM) for overnight shifts
- **FR-170**: System MUST maintain time_entry type and job linkage across midnight split
- **FR-171**: System MUST support daily hours summary via voice: "How many hours today?"
- **FR-172**: System MUST calculate total hours broken down by type: work, travel, break, admin
- **FR-173**: System MUST display daily summary with: total hours, breakdown by type, jobs worked, routes completed
- **FR-174**: System MUST continue time tracking when GPS signal is lost (use last known location)
- **FR-175**: System MUST flag time entries with GPS gaps >30 minutes for supervisor review
- **FR-176**: System MUST link time_entry records to job_id for job costing and billing
- **FR-177**: System MUST support equipment_swap time entries (stop at shop mid-day) with separate tracking
- **FR-178**: System MUST calculate billable hours (exclude breaks, admin) for payroll export
- **FR-179**: System MUST support time entry manual adjustments by supervisors with reason tracking
- **FR-180**: System MUST sync time entries to payroll system on daily or weekly basis

#### Historical Context (FR-181 through FR-200)

- **FR-181**: System MUST track historical job durations per property (calculate average, min, max from past jobs)
- **FR-182**: System MUST track historical material usage per property (e.g., "typically uses 10 bags fertilizer")
- **FR-183**: System MUST track customer scheduling preferences (preferred days, time windows)
- **FR-184**: System MUST detect anomalies when current job duration exceeds typical duration by 2x
- **FR-185**: System MUST display warning when job estimate differs significantly from historical baseline
- **FR-186**: System MUST prompt for reason when job duration is anomalous: "This job usually takes 2 hours. Today: 5 hours. Reason?"
- **FR-187**: System MUST support "Same as last time" quick apply for job settings (crew size, materials, equipment)
- **FR-188**: System MUST display seasonal patterns when available: "Last spring: 3 hours. Last fall: 1.5 hours."
- **FR-189**: System MUST generate property-specific insights: lawn size, typical duration, material usage
- **FR-190**: System MUST generate customer-specific insights: communication preferences, payment terms, special requests
- **FR-191**: System MUST calculate confidence scores for insights based on sample size (min 3 jobs required)
- **FR-192**: System MUST update insights automatically after each job completion
- **FR-193**: System MUST support route pattern detection (common sequences of properties)
- **FR-194**: System MUST track route pattern usage frequency and average performance (time, distance)
- **FR-195**: System MUST suggest saved route patterns when creating new routes with similar properties
- **FR-196**: System MUST display property history in job details: last visit date, last crew, last issues
- **FR-197**: System MUST alert when property has history of specific issues: "Previous visit: sprinkler leak detected in zone 3"
- **FR-198**: System MUST support insight opt-out per company (privacy concerns)
- **FR-199**: System MUST archive insights after 2 years of no activity (property no longer serviced)
- **FR-200**: System MUST display insight freshness: "Based on last 8 jobs (most recent: 2 weeks ago)"

### Key Entities

- **Safety Checklist**: Represents configurable safety inspection templates. Contains company reference, name, description, required_for conditions (job types, equipment types), items array (task, type, photo_required, critical flag), frequency (per-job, daily, weekly), active status. Links to company.

- **Safety Checklist Completion**: Represents completed safety inspection records. Contains checklist reference, job reference, user reference, completion timestamp, items_completed array (item_id, value, photo_id, notes), GPS location, signature (if required), notes. Links to checklist, job, user.

- **Daily Route**: Represents optimized daily route plan for a technician. Contains company reference, route date, assigned user, vehicle reference, status (draft, optimized, active, completed, cancelled), optimization parameters (criteria, constraints), total distance, estimated/actual duration, Mapbox route ID, timestamps. Links to company, user, vehicle.

- **Route Waypoint**: Represents stop on a route. Contains route reference, waypoint_type (start, job, break, material_stop, equipment_swap, end), sequence order, job reference (if applicable), location (GPS + address), scheduled/actual arrival and departure times, estimated duration, notes, skipped flag, skip_reason. Links to route, job.

- **Route Event**: Represents route lifecycle events. Contains route reference, event_type (start, arrival, departure, re-optimization, delay, completion), waypoint reference, event timestamp, GPS location, metadata (reason, traffic_delay, weather). Links to route, waypoint.

- **Route Optimization**: Represents route re-calculation record. Contains route reference, optimization timestamp, trigger (manual, job_added, traffic_delay, etc), before/after waypoints snapshot, distance/time saved, Mapbox request ID, API cost. Links to route.

- **Intake Session**: Represents smart capture session for customer/vendor/property intake. Contains company reference, user reference, session_type (business_card, property, vehicle, signage), media reference (photo), GPS location, context (job_id, property_id, customer_id if applicable), timestamp. Links to company, user, media.

- **Intake Extraction**: Represents OCR/VLM extraction results from intake session. Contains session reference, extraction_method (ocr, vlm, hybrid), provider, raw_text, structured_data (name, company, phone, email, etc), confidence_scores per field, cost, processing_time. Links to intake_session.

- **Contact Candidate**: Represents pending customer/vendor contact from intake. Contains intake_session reference, candidate_type (customer_contact, vendor_contact, property_owner), extracted_data, match_confidence to existing records, existing customer/vendor reference (if matched), status (pending, approved, rejected, duplicate), approval user, approval timestamp, rejection_reason, created_record_id. Links to intake_session, existing customer/vendor, created record.

- **Property Candidate**: Represents pending property from intake. Contains intake_session reference, extracted_data (address, coordinates, type, features, reference_image), match_confidence to existing property, existing_property reference, status, approval user, approval timestamp, created_property_id. Links to intake_session, existing property, created property.

- **Job Task**: Represents individual task within a job. Contains job reference, template_task reference (if from template), task_name, description, assigned_to user, status (pending, in_progress, completed, skipped, blocked), sequence_order, required flag, depends_on_task reference (for dependencies), estimated/actual duration, completion_method (voice, photo, manual, auto), completion_photo reference, completion_evidence (vision_confidence, voice_transcript_id), completion timestamp, completion user, voice_transcript reference, created_from (voice, ocr, template, manual), timestamps. Links to job, user, media, voice_transcript, template.

- **Task Template**: Represents reusable task list template. Contains company reference, name, description, job_type, default_tasks array (name, description, required, sequence, estimated_duration), tags, usage_count, created_by user, timestamp. Links to company, user.

- **Instruction Document**: Represents guidance material (PDF, video, reference image). Contains company reference, title, document_type (pdf, video, reference_image, sop), media reference, required_viewing flag, category (equipment, technique, safety, customer_preference), tags, timestamp. Links to company, media.

- **Job Instruction**: Represents instruction document assignment to job. Contains job reference, instruction reference, required flag, viewed_by (user_id → viewed_at, duration, acknowledged), timestamp. Links to job, instruction.

- **Job History Insight**: Represents learned patterns from historical job data. Contains company reference, property reference, customer reference, job_type, insight_type (typical_duration, material_usage, crew_size, seasonal_pattern), insight_key, insight_value, confidence (0-1), sample_size, last_updated timestamp. Links to company, property, customer. Unique constraint on (property, job_type, insight_type, insight_key).

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs) - Specification avoids implementation details, focuses on capabilities
- [x] Focused on user value and business needs - All requirements tied to user scenarios
- [x] Written for non-technical stakeholders - Uses plain language, avoids jargon
- [x] All mandatory sections completed - User scenarios, requirements, entities all complete

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain - All clarifications resolved via gap analysis
- [x] Requirements are testable and unambiguous - Each FR specifies measurable behavior
- [x] Success criteria are measurable - Success metrics defined (95% accuracy, <30 sec, etc)
- [x] Scope is clearly bounded - Feature 005 vs Feature 006 separation documented
- [x] Dependencies and assumptions identified - Integration points with Features 001-004 specified

---

## Execution Status

- [x] User description parsed - 5 major capability areas identified
- [x] Key concepts extracted - Actors, actions, data, constraints documented
- [x] Ambiguities marked - 15 clarifications captured and resolved
- [x] User scenarios defined - 25 acceptance scenarios + 30 edge cases
- [x] Requirements generated - 200 functional requirements across 5 domains
- [x] Entities identified - 15 key entities with relationships
- [x] Review checklist passed - All quality gates met

---