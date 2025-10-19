# Feature Specification: Task-Item Association

**Feature ID**: 015
**Title**: Task-Level Item and Kit Association
**Status**: Draft
**Created**: 2025-10-19
**Branch**: `015-task-item-association`

## Overview

Enable associating Items and/or Item Kits directly to Tasks and Task Templates, creating a "Job Load List" at the task level. This complements the existing job-level item assignment by allowing supervisors to specify which equipment/materials are needed for specific tasks.

### Business Context

Currently, Items can be assigned to Jobs (`assigned_to_job_id` on `items` table), providing job-level visibility into what equipment/materials are needed. However, there's no way to specify that a particular task (like "mow small yard") always requires specific items (like "push mower").

This feature adds **task-level granularity** for item requirements, enabling:
- **Task Templates** with predefined equipment lists ("mow small yard" template includes "push mower")
- **Workflow Tasks** (job instances) that inherit or customize item requirements
- **Job Load Lists** that show which items are needed for which tasks
- Better equipment preparation and tracking

## User Stories

### US-1: Template Creator Adds Items to Task Template
**As a** supervisor creating a task template
**I want to** associate required items/kits with template items
**So that** when I instantiate the template on a job, workers know what equipment each task requires

**Acceptance Criteria**:
- Can browse and select items from inventory when editing a task template item
- Can browse and select kits from kit library when editing a task template item
- Can specify quantity required for each item/kit
- Can mark items as required vs. optional for the task
- Selected items are saved with the template item
- When template is instantiated, task items inherit the item associations

### US-2: Supervisor Views Task Equipment Requirements
**As a** supervisor planning a job
**I want to** see which items/kits are required for each task
**So that** I can ensure all equipment is loaded before dispatching workers

**Acceptance Criteria**:
- Job detail view shows items needed per task (not just per job)
- Can see task-level equipment alongside job-level equipment
- Can see which items are required vs. optional
- Can see quantities needed

### US-3: Worker Sees Required Equipment for Current Task
**As a** field worker completing a task
**I want to** see which items/kits I need for this specific task
**So that** I can verify I have the right equipment before starting

**Acceptance Criteria**:
- Task detail view shows associated items/kits
- Can see quantity requirements
- Can see which items are required vs. optional
- Can mark items as "loaded" or "verified"

### US-4: Supervisor Overrides Template Item Requirements
**As a** supervisor instantiating a template
**I want to** modify item requirements for specific tasks
**So that** I can adapt to job-specific conditions

**Acceptance Criteria**:
- Can add items to a task beyond template defaults
- Can remove items from a task (override template)
- Can change quantities for template items
- Changes are specific to this job instance, template remains unchanged

## Functional Requirements

### FR-1: Data Model Extensions

#### Task Template Item Associations
- Add `task_template_item_associations` table:
  ```sql
  - id: UUID PK
  - tenant_id: UUID (RLS)
  - template_item_id: UUID → task_template_items
  - item_id: UUID → items (nullable, one of item_id or kit_id required)
  - kit_id: UUID → kits (nullable, one of item_id or kit_id required)
  - quantity: DECIMAL (default 1)
  - is_required: BOOLEAN (default true)
  - notes: TEXT (optional usage notes)
  - created_at, updated_at: TIMESTAMPTZ
  ```

#### Workflow Task Item Associations
- Add `workflow_task_item_associations` table:
  ```sql
  - id: UUID PK
  - tenant_id: UUID (RLS)
  - workflow_task_id: UUID → workflow_tasks
  - item_id: UUID → items (nullable, one of item_id or kit_id required)
  - kit_id: UUID → kits (nullable, one of item_id or kit_id required)
  - quantity: DECIMAL (default 1)
  - is_required: BOOLEAN (default true)
  - status: ENUM (pending, loaded, verified, missing, returned)
  - loaded_at: TIMESTAMPTZ (when marked as loaded)
  - loaded_by: UUID → users (who marked it as loaded)
  - notes: TEXT (optional)
  - source_template_association_id: UUID → task_template_item_associations (nullable, tracks inheritance)
  - created_at, updated_at: TIMESTAMPTZ
  ```

### FR-2: Template Editing UI

- Task Template Edit page adds "Required Items" section to each task item
- Shows list of currently associated items/kits with quantity
- "Add Item" button opens item browser modal
- "Add Kit" button opens kit browser modal
- Can remove item associations
- Can edit quantity for each association
- Can toggle required/optional flag

### FR-3: Template Instantiation Logic

When creating workflow_tasks from a template:
1. Copy all `task_template_item_associations` to `workflow_task_item_associations`
2. Set `source_template_association_id` to link back to template
3. Initialize status as 'pending'
4. Preserve quantity, is_required, notes from template

### FR-4: Job Planning View

- Job detail page shows "Equipment Needed" section with two tabs:
  - **Job-Level Items**: Items assigned to job (existing `assigned_to_job_id`)
  - **Task-Level Items**: Aggregated view of all task item associations
- Task-level tab groups by task, shows items/kits/quantities
- Shows status indicators (pending/loaded/verified)

### FR-5: Worker Task View

- Task detail view shows "Required Equipment" section
- Lists all associated items and kits
- Shows quantity needed
- Shows required/optional badge
- Checkbox/button to mark items as "loaded"
- Shows status for each item

### FR-6: Override Capabilities

- When viewing workflow_tasks, supervisor can:
  - Add items beyond template defaults (creates new association without source_template_association_id)
  - Remove items (soft delete or mark as excluded)
  - Edit quantities (updates association)
- Changes are specific to this job, don't affect template

## Non-Functional Requirements

### NFR-1: Performance
- Loading job with 50 tasks + 200 item associations: < 1 second
- Task item lookup queries use indexes on workflow_task_id and template_item_id

### NFR-2: Data Integrity
- Enforce check constraint: `(item_id IS NOT NULL) XOR (kit_id IS NOT NULL)` (exactly one must be set)
- Cascade delete: When task_template_item deleted, cascade to task_template_item_associations
- RLS policies on both new tables following tenant_isolation pattern

### NFR-3: Backward Compatibility
- Existing jobs/tasks without item associations continue to work unchanged
- Job-level item assignment (`assigned_to_job_id`) remains available
- No migration needed for existing data (new associations start from zero)

## Technical Constraints

### Database
- PostgreSQL 15+ (Supabase hosted)
- Must follow constitution: RLS on all tables, tenant_id on all tables
- Migrations via Supabase MCP or TypeScript migration scripts

### Frontend
- Next.js 14 App Router
- React Server Components for initial load
- Client components for interactive item selection

### Backend
- Repository pattern for all database access
- Service layer for business logic
- Result<T, E> pattern for error handling

## Success Criteria

### Quantitative Metrics
- [ ] Can create template with 10 tasks, each with 5 item associations: < 2 seconds
- [ ] Can instantiate template with 10 tasks to job: < 1 second
- [ ] Can load job equipment view with 50 tasks: < 1 second
- [ ] Test coverage ≥ 80% for new repositories and services

### Qualitative Criteria
- [ ] Supervisor can create templates with equipment lists without confusion
- [ ] Workers can see task equipment requirements at a glance
- [ ] Job planning view clearly shows all equipment needs (job + task level)
- [ ] No data integrity issues (orphaned associations, wrong tenant access)

## Out of Scope

- **Item availability checking**: Not checking if item is available/in stock (future feature)
- **Automatic item reservation**: Not automatically reserving items when task assigned (future feature)
- **Item check-in/check-out workflow**: Simple status tracking only (future feature)
- **Historical tracking**: Not tracking item usage history across jobs (future feature)
- **Cost tracking**: Not tracking item rental/usage costs (future feature)

## Dependencies

- Task Templates feature (014-add-task-management) - COMPLETE
- Items domain (existing) - COMPLETE
- Kits domain (existing) - COMPLETE
- Workflow Tasks domain (existing) - COMPLETE

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Complex UI with two levels (job + task) confuses users | High | Medium | Clear visual separation, contextual help, user testing |
| Performance degradation with many items | Medium | Low | Pagination, lazy loading, indexes on foreign keys |
| Data integrity issues (orphaned associations) | High | Low | Foreign key constraints, cascade deletes, RLS policies |
| Template changes don't propagate to existing jobs | Low | High | By design - document that template changes only affect NEW instantiations |

## Open Questions

None - user provided clear direction:
- Two-level approach (job-level AND task-level) is intentional
- Task Templates should support item associations
- Workflow Tasks (job instances) inherit from templates but can be customized

## Clarifications

### Session 1: Initial Planning (2025-10-19)

**Q1: Should task-level items REPLACE or COMPLEMENT job-level items?**
A: COMPLEMENT. Keep both systems. Job-level assignment (`assigned_to_job_id`) is useful for shared equipment across tasks. Task-level is for task-specific requirements.

**Q2: Should template changes propagate to existing job instances?**
A: NO. Template changes only affect NEW job instantiations. Existing jobs maintain their snapshot of associations at creation time. This is consistent with how task_template_items work.

**Q3: How should kits be handled - expand to individual items or keep as kit reference?**
A: Keep as kit reference. Store `kit_id` in associations table, let UI expand kit details when needed. This preserves kit versioning and allows updating kit contents without changing task associations.

**Q4: What status values should workflow_task_item_associations support?**
A: Start simple: pending, loaded, verified, missing, returned. More complex workflows (damaged, maintenance) are out of scope for v1.

**Q5: Should items be required vs. optional at task level?**
A: YES. Add `is_required` boolean. Required items block task completion if marked 'missing'. Optional items are "nice to have" but not blockers.
