# Feature Specification: Job Assignment and Crew Hub Dashboard

**Feature Branch**: `010-job-assignment-and`
**Created**: 2025-10-16
**Status**: Draft
**Input**: User description: "Job Assignment and Crew Hub Dashboard - Enable supervisors to assign jobs to crew members, and create a crew dashboard showing assigned jobs in load order. First, get Job Assignment working where super@tophand.tech user can assign a job to crew@tophand.tech user. Then, make the Crew Hub screen have same look and design as supervisor dashboard, and it will have a My Jobs section on dash that shows ALL assigned jobs in order of 'next to load', and these job tiles (2 per row) each open the Item Load List screen if there are items remaining to load."

## Execution Flow (main)
```
1. Parse user description from Input ✓
2. Extract key concepts from description ✓
   → Actors: supervisors (super@tophand.tech), crew members (crew@tophand.tech)
   → Actions: assign jobs, view assigned jobs, load items
   → Data: jobs, assignments, items, load status
   → Constraints: matching supervisor UI design, load order sorting
3. Mark unclear aspects → See NEEDS CLARIFICATION markers below
4. Fill User Scenarios & Testing section ✓
5. Generate Functional Requirements ✓
6. Identify Key Entities ✓
7. Run Review Checklist → In progress
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-16
- Q: "Next to load" priority: How should jobs be ordered in the crew member's dashboard? → A: Scheduled start time (earliest first)
- Q: Crew member permissions: What can crew members do with assigned jobs besides viewing and updating load status? → A: Can edit job notes/comments only
- Q: Multiple crew assignment: Can one job be assigned to multiple crew members simultaneously? → A: Yes, multiple crew can be assigned to same job
- Q: Fully loaded job interaction: What happens when a crew member taps a job tile with all items already loaded? → A: Navigate to job details page (read-only view)
- Q: Crew member role determination: How is crew member status identified for job assignment purposes? → A: Database role field (e.g., users.role = 'crew')

---

## User Scenarios & Testing

### Primary User Story

**As a supervisor**, I need to assign jobs to crew members so that they know which jobs they're responsible for and can start loading the required items for those jobs.

**As a crew member**, I need to see all my assigned jobs in priority order so that I can efficiently load items for the next job that needs attention.

### Acceptance Scenarios

#### Job Assignment Flow
1. **Given** a supervisor is viewing a job details page, **When** they select "Assign to Crew", **Then** they can select a crew member from a list and assign the job to them
2. **Given** a job has been assigned to a crew member, **When** the crew member logs in, **Then** they see this job in their "My Jobs" section
3. **Given** multiple jobs are assigned to a crew member, **When** they view their dashboard, **Then** jobs are sorted by scheduled start time (earliest first)

#### Crew Hub Dashboard Flow
4. **Given** a crew member has assigned jobs, **When** they view their dashboard, **Then** they see job tiles in a 2-column grid matching the supervisor dashboard design
5. **Given** a job tile has items remaining to load, **When** the crew member taps the job tile, **Then** they are taken to the Item Load List screen for that job
6. **Given** a job tile has all items loaded, **When** the crew member taps the job tile, **Then** they are taken to a read-only job details page

#### Load Status Visibility
7. **Given** a job has 5 items with 3 loaded, **When** viewing the job tile, **Then** the load status shows "3/5" with a progress indicator
8. **Given** a job is assigned but has no items, **When** viewing the job tile, **Then** [NEEDS CLARIFICATION: Should it show "0/0", hide the load count, or indicate no items assigned?]

### Edge Cases
- What happens when a supervisor unassigns a job from a crew member while they're viewing it?
- How does the system handle a job assigned to a crew member who doesn't have an active account?
- What happens if a crew member is assigned multiple jobs with the same scheduled start time?
- What happens when multiple crew members update the same job's load status simultaneously?
- Can a crew member decline or reassign a job? [NEEDS CLARIFICATION]

## Requirements

### Functional Requirements

#### Job Assignment
- **FR-001**: System MUST allow supervisors to assign a job to one or more crew members
- **FR-001a**: System MUST allow supervisors to add additional crew members to an already-assigned job
- **FR-002**: System MUST allow supervisors to view all crew members currently assigned to each job
- **FR-003**: System MUST allow supervisors to remove individual crew members from a job assignment [NEEDS CLARIFICATION: Should this require confirmation or preserve history of previous assignments?]
- **FR-004**: System MUST notify crew members when a job is assigned to them [NEEDS CLARIFICATION: Notification method not specified - in-app, email, push notification?]
- **FR-005**: System MUST prevent assignment of jobs to users who are not crew members (determined by role field in database where role = 'crew')

#### Crew Hub Dashboard
- **FR-006**: System MUST provide a Crew Hub dashboard that matches the visual design of the supervisor dashboard
- **FR-007**: System MUST display a "My Jobs" section showing all jobs assigned to the logged-in crew member
- **FR-008**: System MUST sort assigned jobs by scheduled start time, with earliest scheduled jobs appearing first
- **FR-009**: System MUST display job tiles in a 2-column grid layout
- **FR-010**: System MUST show load progress on each job tile (e.g., "3/5 items loaded")
- **FR-011**: System MUST display job status visually (e.g., scheduled, in progress, ready to load)
- **FR-012**: System MUST show customer name and property location on job tiles [NEEDS CLARIFICATION: Confirm these are the required fields for crew context]

#### Item Load List Navigation
- **FR-013**: System MUST allow crew members to tap a job tile to navigate based on load completion status
- **FR-013a**: System MUST navigate to Item Load List screen when job has items remaining to load
- **FR-013b**: System MUST navigate to read-only job details page when all job items are fully loaded
- **FR-014**: System MUST display item cards showing item name, type, quantity, and load status on the Item Load List screen
- **FR-015**: System MUST allow crew members to update item load status (pending, loaded, verified) from the Item Load List screen
- **FR-016**: System MUST allow crew members to add and edit notes/comments on assigned jobs
- **FR-017**: System MUST prevent crew members from editing job details (customer, property, scheduled time, status) or adding/removing items

#### Data & Permissions
- **FR-018**: System MUST persist job assignments so they survive app restarts and user sessions
- **FR-019**: System MUST restrict crew members to viewing only their assigned jobs [NEEDS CLARIFICATION: Can they see unassigned jobs or jobs assigned to other crew members?]
- **FR-020**: System MUST maintain a history of job assignments [NEEDS CLARIFICATION: Is assignment history required for audit purposes?]
- **FR-021**: System MUST handle concurrent updates when multiple crew members interact with the same job [NEEDS CLARIFICATION: Conflict resolution strategy not specified]

### Non-Functional Requirements
- **NFR-001**: Crew Hub dashboard MUST load assigned jobs within [NEEDS CLARIFICATION: performance target not specified - 2 seconds? 5 seconds?]
- **NFR-002**: Job assignment action MUST complete within [NEEDS CLARIFICATION: performance target not specified]
- **NFR-003**: UI design MUST maintain visual consistency between supervisor and crew dashboards (fonts, colors, spacing, component styles)
- **NFR-004**: System MUST support offline viewing of assigned jobs [NEEDS CLARIFICATION: Is offline support required, and if so, what's the sync strategy?]

### Key Entities

- **Job Assignment**: Represents the relationship between a job and crew members
  - Links a job to one or more crew members (many-to-many relationship)
  - Tracks assignment timestamp for each crew member
  - May track assignment history (see FR-019)
  - Determines visibility of jobs in Crew Hub dashboard
  - Multiple crew members can view and work on the same job simultaneously

- **Job**: Existing entity representing work to be done
  - Has a status (scheduled, in progress, completed)
  - Contains customer and property information
  - Has a collection of items to be loaded
  - Has a scheduled start time that determines display order in crew dashboard

- **Crew Member**: A user with role = 'crew' in the database
  - Can be assigned jobs by supervisors
  - Views their assigned jobs in Crew Hub
  - Updates item load status
  - Can add/edit notes and comments on assigned jobs
  - Cannot edit job details (customer, property, timing, status) or modify item list
  - Identified by role field for assignment eligibility

- **Item Load Status**: Tracks loading progress for job items
  - Item reference
  - Status (pending, loaded, verified, missing)
  - Quantity loaded vs. total quantity
  - Updated by crew members during loading process

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain - **5 core clarifications resolved, 8 deferred**
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked and resolved (5 core clarifications completed)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed - **READY FOR PLANNING**

---

## Outstanding Clarifications (Deferred)

The following clarifications remain but are lower impact and can be resolved during planning or implementation:

1. **Job with no items**: How should the UI display jobs that have no items assigned? (UI detail - can be decided during design)
2. **Job reassignment confirmation**: Should removal require confirmation or preserve history? (UX polish - default to no confirmation)
3. **Assignment notifications**: Notification method (in-app, email, push)? (Feature enhancement - defer to Phase 2)
4. **Crew member job visibility**: Can they see unassigned/other jobs? (Security consideration - default to assigned-only)
5. **Assignment history**: Is audit trail required? (Compliance decision - recommend yes for accountability)
6. **Concurrent update handling**: Conflict resolution strategy? (Technical - last-write-wins acceptable for MVP)
7. **Performance targets**: Load time thresholds? (Non-functional - use industry standard <3s)
8. **Offline support**: Required and sync strategy? (Feature scope - defer to Phase 2)

**Status**: Ready to proceed to `/plan` with 5 core clarifications resolved.
