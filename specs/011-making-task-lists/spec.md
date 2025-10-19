# Feature Specification: Task Lists for Jobs

**Feature Branch**: `011-making-task-lists`
**Created**: 2025-10-18
**Status**: Draft
**Input**: User description: "making TASK lists for JOBS"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature request: Enable creation and management of task lists for jobs
2. Extract key concepts from description
   → Actors: Field technicians, supervisors, office administrators
   → Actions: Create tasks, reorder tasks, complete tasks, verify completion
   → Data: Task list, task items, completion status, verification evidence
   → Constraints: Multi-tenant isolation, voice-first interface, offline capability
3. For each unclear aspect:
   → [NEEDS CLARIFICATION: Should tasks be reusable templates or job-specific?]
   → [NEEDS CLARIFICATION: Can tasks be added/removed after job starts?]
   → [NEEDS CLARIFICATION: What happens to incomplete tasks when job is completed?]
4. Fill User Scenarios & Testing section ✓
5. Generate Functional Requirements ✓
6. Identify Key Entities ✓
7. Run Review Checklist (pending clarifications)
8. Return: SUCCESS (spec ready for planning after clarifications resolved)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-18
- Q: How should this feature relate to the existing workflow_tasks table? → A: Enhance existing - Extend workflow_tasks with missing features (add columns/capabilities)
- Q: Should the system support reusable task templates? → A: Yes, templates required - Supervisors must be able to create reusable task templates for job types
- Q: Can technicians add or remove tasks after a job has started? → A: Add only, no delete - Can add tasks but cannot remove tasks after job starts
- Q: Can a job be marked as complete when some tasks remain incomplete? → A: Required tasks only - Required tasks must be complete, optional tasks can be incomplete
- Q: Does AI confidence scoring align with vision pipeline strategy? → A: Yes, keep VLM scoring - Continue using Vision Language Models for AI confidence on task verification

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
**As a field technician**, I want to see a clear list of tasks I need to complete for each job so that I can work through the job systematically without missing critical steps, even when working offline or in hands-free mode.

**As a supervisor**, I want to define standard task lists for different job types so that all technicians follow consistent procedures and quality standards.

**As an office administrator**, I want to track which tasks have been completed for each job so that I can verify work quality and identify bottlenecks in job completion.

### Acceptance Scenarios

1. **Given** a job is assigned to me, **When** I open the job details via voice command "Show job tasks", **Then** I hear a numbered list of all tasks I need to complete in order

2. **Given** I'm working through a task list, **When** I complete a task and say "Mark task 3 complete", **Then** the task is marked complete, a timestamp is recorded, and the system confirms completion audibly

3. **Given** a task requires photo verification, **When** I complete the task, **Then** the system prompts me to take a verification photo before allowing me to mark it complete

4. **Given** I'm working offline, **When** I complete multiple tasks, **Then** all task completions are queued locally and sync automatically when connectivity is restored

5. **Given** I'm a supervisor creating a new job, **When** I select a job template, **Then** the associated task list is automatically added to the job

6. **Given** a task requires supervisor approval, **When** I mark it complete, **Then** the supervisor receives a notification and the task shows "pending approval" status

### Edge Cases
- What happens when a technician skips a task and completes later tasks out of order?
- How does the system handle tasks that become irrelevant mid-job? Tasks must be marked "skipped" rather than deleted after job starts
- What happens if a task requires verification but the camera is unavailable?
- How are task lists managed when a job is rescheduled or reassigned?
- Can technicians reorder tasks after job starts, or is sequence locked?
- What happens if a technician tries to complete a job with incomplete required tasks? System must block completion and identify which required tasks remain
- Can a required task be changed to optional after job starts?

## Requirements *(mandatory)*

### Functional Requirements

#### Task List Management
- **FR-001**: System MUST allow creation of task lists associated with specific jobs
- **FR-002**: System MUST support defining task order/sequence within a list
- **FR-003**: System MUST allow tasks to be marked as required vs. optional (impacts job completion validation)
- **FR-004**: System MUST persist task list changes locally when offline
- **FR-005**: System MUST sync task list updates to server when connectivity restored
- **FR-006**: System MUST support creating reusable task templates for job types
- **FR-007**: System MUST allow supervisors to instantiate task templates when creating jobs
- **FR-008**: System MUST allow adding new tasks after job has started
- **FR-009**: System MUST prevent deletion of tasks after job has started (tasks can be marked skipped/failed but not removed)

#### Task Item Properties
- **FR-010**: Each task MUST have a description/title
- **FR-011**: Each task MUST have a required/optional flag
- **FR-012**: Each task MUST have a status (pending, in-progress, complete, skipped, failed)
- **FR-013**: Each task MUST track completion timestamp
- **FR-014**: Each task MUST track who completed it (user_id)
- **FR-015**: Tasks MAY require verification photo before completion
- **FR-016**: Tasks MAY require supervisor approval after completion
- **FR-017**: Tasks MAY have acceptance criteria defined
- **FR-018**: Tasks MAY have AI confidence scoring using VLM (Vision Language Models) for photo verification

#### Voice Interface
- **FR-019**: System MUST support voice command to list all tasks ("Show job tasks", "What are my tasks")
- **FR-020**: System MUST support voice command to mark task complete by number or description ("Mark task 3 complete", "Complete welding task")
- **FR-021**: System MUST provide audio feedback when task status changes
- **FR-022**: System MUST support voice navigation between tasks ("Next task", "Previous task")
- **FR-023**: System MUST support voice query for task details ("What's task 2?", "Read task 5 description")
- **FR-024**: System MUST support voice command to add new tasks ("Add task: Check backup generator")

#### Multi-Tenant & Security
- **FR-025**: System MUST enforce tenant isolation for all task data (inherit from job's tenant_id)
- **FR-026**: System MUST enforce tenant isolation for task templates
- **FR-027**: System MUST respect user role permissions for task operations (create, update, complete vs. template management)
- **FR-028**: System MUST implement RLS policies for task data access
- **FR-029**: System MUST audit all task completion events with user and timestamp

#### Integration with Existing Features
- **FR-030**: System MUST enhance existing workflow_tasks table with missing capabilities (not create new table)
- **FR-031**: System MUST integrate with existing job workflow (jobs table)
- **FR-032**: System MUST support task verification using existing photo/vision pipeline (VLM-first approach per constitution)
- **FR-033**: System MUST respect existing supervisor review workflows
- **FR-034**: System MUST validate all required tasks are complete before allowing job completion
- **FR-035**: System MUST allow job completion when only optional tasks remain incomplete

#### Data Retention & History
- **FR-036**: System MUST retain task completion history for audit purposes
- **FR-037**: System MUST retain task data for duration aligned with tenant policy (defer specific period to planning phase)
- **FR-038**: System MUST allow viewing historical task lists for completed jobs

### Key Entities *(include if feature involves data)*

- **Task List**: A collection of tasks associated with a specific job, ordered sequentially
  - Belongs to exactly one job
  - Inherits tenant_id from parent job
  - May be created from a template (if templates are supported)
  - Contains multiple task items

- **Task Item**: An individual work item that must be completed as part of a job
  - Has description, order/sequence number, status
  - Tracks completion (who, when)
  - May require verification (photo, supervisor approval)
  - May have acceptance criteria and AI confidence scoring
  - Inherits tenant isolation through parent job relationship

- **Task Template**: A reusable definition of tasks for specific job types
  - Tenant-scoped (isolated per tenant)
  - Defines standard task sequences for common job types (e.g., "HVAC Maintenance", "Electrical Inspection")
  - Instantiated when job is created from template
  - Contains template task definitions with order, description, verification requirements

---

## Database Evidence *(captured during specification)*

### Supabase MCP Queries Executed

**Query 1 - Jobs Table Schema** (2025-10-18)
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs'
ORDER BY ordinal_position;
```
**Key Findings**:
- Jobs table has tenant_id (uuid, NOT NULL)
- Has job_number, customer_id, property_id, assigned_to, assigned_team
- Has checklist_items (jsonb, default '[]'::jsonb) - currently storing as JSONB
- Has RLS policy 'jobs_tenant_isolation' for ALL operations
- Has voice-related fields: voice_notes, voice_created, voice_session_id

**Query 2 - Existing Task-Related Tables** (2025-10-18)
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND (tablename LIKE '%job%' OR tablename LIKE '%task%')
ORDER BY tablename;
```
**Key Findings**:
- `job_checklist_items` exists (14 columns, links to jobs via job_id)
- `workflow_tasks` exists (20 columns, has tenant_id, job_id, task_description, task_order, status, completion tracking, verification fields, supervisor approval fields)
- This indicates task functionality may already partially exist!

**Query 3 - workflow_tasks Schema** (2025-10-18)
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workflow_tasks'
ORDER BY ordinal_position;
```
**Key Findings**:
- Has tenant_id (uuid, NOT NULL) - proper multi-tenant isolation
- Has job_id (uuid, NOT NULL) - links to jobs table
- Has task_description, task_order, status, task_type
- Has completion tracking: completed_by, completed_at
- Has verification: verification_photo_url, verification_method, verification_data, ai_confidence
- Has supervisor workflow: requires_supervisor_approval, supervisor_approved, supervisor_id, supervisor_notes
- **CRITICAL**: This table already implements most of the required functionality!

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

**SCOPE DECISION**: Based on clarification, this feature will enhance the existing `workflow_tasks` table with missing capabilities rather than creating a new system. Focus on identifying gaps between current implementation and requirements.

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked and resolved (5 clarifications answered)
- [x] User scenarios defined
- [x] Requirements generated and updated
- [x] Entities identified
- [x] Database evidence gathered
- [x] Review checklist passed

---

## Next Steps

✅ **Clarifications Complete** - All 5 critical ambiguities resolved

**Ready for `/plan`** - Proceed to implementation planning phase with:
- Clear scope: Enhance existing workflow_tasks table
- Task templates required for job types
- Add-only modification after job start (no deletion)
- Required/optional task differentiation for job completion
- VLM-based AI confidence scoring for verification
