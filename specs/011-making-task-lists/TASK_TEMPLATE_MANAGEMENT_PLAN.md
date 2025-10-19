# Task Template Management - Full Implementation Plan (Option 2)

**Feature**: Complete task template management system for supervisors with template creation, job integration, and task management.

**Status**: Planning Phase
**Priority**: High
**Estimated Effort**: 8-12 hours

---

## 📋 Overview

Enable supervisors to:
1. Create and manage reusable task templates
2. Apply templates to jobs during creation or after
3. Add individual tasks to jobs
4. View and manage tasks on job detail pages
5. Allow crew to complete tasks (already working)

---

## 🎯 User Stories

### US-1: Template Management
**As a supervisor**, I want to create reusable task templates so that I can quickly add standard task lists to jobs.

**Acceptance Criteria:**
- Can view all task templates in a list
- Can create new templates with name, description, job_type
- Can add multiple task items to a template
- Can edit existing templates
- Can delete templates (if not in use)
- Can mark templates as active/inactive

### US-2: Apply Template at Job Creation
**As a supervisor**, I want to select a task template when creating a job so that tasks are automatically added.

**Acceptance Criteria:**
- Job creation form shows optional template selector
- Templates filtered by job_type (if applicable)
- Tasks from template are created when job is created
- Can create job without selecting a template

### US-3: Apply Template to Existing Job
**As a supervisor**, I want to add a task template to an existing job so that I can standardize work after job creation.

**Acceptance Criteria:**
- Job detail page has "Add Tasks from Template" button
- Can select and instantiate template
- Shows warning if job already has tasks
- Tasks are added with correct ordering

### US-4: View Tasks on Supervisor Job Detail
**As a supervisor**, I want to see the task list on job detail pages so that I can track crew progress.

**Acceptance Criteria:**
- Job detail page shows TaskList component (read-only for supervisor)
- Shows task completion progress
- Shows verification requirements
- Shows supervisor approval status

### US-5: Add Individual Tasks
**As a supervisor**, I want to add individual tasks to a job so that I can customize work beyond templates.

**Acceptance Criteria:**
- Job detail page has "Add Task" button
- Form captures: description, order, required, photo verification, supervisor approval
- Task is added to job immediately
- Task list updates automatically

### US-6: Edit/Delete Tasks
**As a supervisor**, I want to edit or delete tasks so that I can adjust job requirements.

**Acceptance Criteria:**
- Each task has edit/delete actions (for supervisor only)
- Can update task description, requirements, order
- Can soft-delete tasks (is_deleted flag)
- Cannot delete tasks that are already complete

---

## 🏗️ Architecture

### New Pages

```
/supervisor/templates
├── page.tsx                    # List all templates
├── create/
│   └── page.tsx               # Create new template
└── [id]/
    └── edit/
        └── page.tsx           # Edit existing template
```

### New Components

```typescript
// Template Management Components
<TemplateList />                    // Grid/list of templates with search
<TemplateCard />                    // Individual template card
<TemplateForm />                    // Create/edit template form
<TemplateItemEditor />              // Add/edit/reorder template items
<TemplateItemRow />                 // Single template item with drag handle

// Task Management Components (enhance existing)
<TaskList />                        // Already exists, add supervisor mode
<TaskEditor />                      // Modal/form for creating/editing tasks
<TaskActions />                     // Edit/delete buttons for supervisor
```

### API Endpoints (Already Exist)

```
GET    /api/task-templates          # List all templates
POST   /api/task-templates          # Create template
GET    /api/task-templates/[id]     # Get template with items
PATCH  /api/task-templates/[id]     # Update template
DELETE /api/task-templates/[id]     # Delete template (if not in use)
POST   /api/task-templates/[id]/instantiate  # Create tasks from template

GET    /api/jobs/[jobId]/tasks      # Get tasks for job
POST   /api/jobs/[jobId]/tasks      # Create individual task
PATCH  /api/jobs/[jobId]/tasks/[taskId]  # Update task
DELETE /api/jobs/[jobId]/tasks/[taskId]  # Soft delete task
```

---

## 🎨 UI/UX Design

### Template List Page (`/supervisor/templates`)

```
┌─────────────────────────────────────────────────────┐
│  [←] Task Templates                    [+ Create]   │
├─────────────────────────────────────────────────────┤
│  🔍 Search templates...                             │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │ 📋 Standard Inspection            [Active ✓] │  │
│  │ 5 tasks • Used by 12 jobs                    │  │
│  │ • Check equipment                             │  │
│  │ • Document findings                           │  │
│  │ • ...                              [Edit] [×] │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📋 Lawn Maintenance               [Active ✓] │  │
│  │ 8 tasks • Used by 45 jobs                    │  │
│  │ • Mow grass                                   │  │
│  │ • Edge borders                                │  │
│  │ • ...                              [Edit] [×] │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Template Create/Edit Page

```
┌─────────────────────────────────────────────────────┐
│  [←] Create Task Template                           │
├─────────────────────────────────────────────────────┤
│  Template Name *                                    │
│  [Standard Inspection________________________]      │
│                                                     │
│  Description                                        │
│  [Complete safety inspection_______________]        │
│                                                     │
│  Job Type (optional)                                │
│  [inspection ▼]                                     │
│                                                     │
│  Active    [✓] Active  [ ] Inactive                │
├─────────────────────────────────────────────────────┤
│  Task Items                            [+ Add Task] │
│  ┌──────────────────────────────────────────────┐  │
│  │ ≡ 1. Check equipment                    [×]  │  │
│  │    Required: ✓  Photo: ✓  Approval: -        │  │
│  │    Criteria: All equipment operational       │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ ≡ 2. Document findings                  [×]  │  │
│  │    Required: -  Photo: -  Approval: -        │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  [Cancel]                          [Save Template]  │
└─────────────────────────────────────────────────────┘
```

### Job Creation Form (Enhanced)

```
┌─────────────────────────────────────────────────────┐
│  Create New Job                                     │
├─────────────────────────────────────────────────────┤
│  Customer *           [Select customer ▼]           │
│  Property             [Select property ▼]           │
│  Job Title *          [Lawn maintenance_____]       │
│  Description          [__________________]          │
│  Scheduled Date *     [2025-10-18______]            │
│  Scheduled Time       [09:00___________]            │
│  Priority             [Normal ▼]                    │
│                                                     │
│  ┌────────────────────────────────────────────┐    │
│  │ 📋 Task Template (optional)                │    │
│  │ [Standard Inspection ▼]                    │    │
│  │ Preview: 5 tasks will be added             │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  [Clear]                            [Create Job]    │
└─────────────────────────────────────────────────────┘
```

### Supervisor Job Detail (Enhanced)

```
┌─────────────────────────────────────────────────────┐
│  [←] Job Details                           [Edit]   │
│  #JOB-123                                           │
├─────────────────────────────────────────────────────┤
│  [Job Image]                                        │
│  Job Title, Customer, Property, Schedule...         │
│  Crew Assignment...                                 │
├─────────────────────────────────────────────────────┤
│  📋 Job Tasks (3 of 5 complete)    [+ Add Task]    │
│                               [Add from Template ▼] │
│  ┌──────────────────────────────────────────────┐  │
│  │ ✓ 1. Check equipment               [Edit][×]│  │
│  │   Completed by John • 2 hrs ago              │  │
│  │   Photo verified (95% confidence)            │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ ⏳ 2. Document findings            [Edit][×]│  │
│  │   Required • Photo verification required     │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ ○ 3. Final inspection              [Edit][×]│  │
│  │   Required • Supervisor approval required    │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Load List (5/10 items)...                         │
└─────────────────────────────────────────────────────┘
```

### Add/Edit Task Modal

```
┌─────────────────────────────────────────────────────┐
│  Add Task to Job                           [×]      │
├─────────────────────────────────────────────────────┤
│  Task Description *                                 │
│  [Check equipment operation________________]        │
│                                                     │
│  Task Order                                         │
│  [3___] (will be inserted at position 3)           │
│                                                     │
│  Requirements                                       │
│  [✓] Required task                                  │
│  [✓] Requires photo verification                   │
│  [ ] Requires supervisor approval                   │
│                                                     │
│  Acceptance Criteria (optional)                     │
│  [All equipment must be operational________]        │
│                                                     │
│  [Cancel]                             [Add Task]    │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Plan

### Phase 1: Template Management Pages (3-4 hours)

**T1.1: Create Template List Page**
- File: `src/app/(authenticated)/supervisor/templates/page.tsx`
- Components: `TemplateList`, `TemplateCard`
- Features:
  - Fetch and display all templates
  - Search/filter templates
  - Show template usage count (via API enhancement?)
  - Link to create/edit pages
  - Delete templates (with confirmation)

**T1.2: Create Template Creation Page**
- File: `src/app/(authenticated)/supervisor/templates/create/page.tsx`
- Components: `TemplateForm`, `TemplateItemEditor`
- Features:
  - Form for template metadata (name, description, job_type, active)
  - Add/edit/delete/reorder template items
  - Drag-and-drop reordering
  - Validation and error handling
  - Submit to POST /api/task-templates

**T1.3: Create Template Edit Page**
- File: `src/app/(authenticated)/supervisor/templates/[id]/edit/page.tsx`
- Reuse `TemplateForm` and `TemplateItemEditor`
- Features:
  - Load existing template data
  - Allow editing metadata and items
  - Submit to PATCH /api/task-templates/[id]
  - Show warning if template is in use

### Phase 2: Job Creation Integration (1-2 hours)

**T2.1: Enhance JobForm Component**
- File: `src/app/(authenticated)/supervisor/jobs/_components/JobForm.tsx`
- Changes:
  - Add template selection dropdown
  - Fetch templates on mount
  - Show template preview (task count)
  - Pass templateId to job creation handler

**T2.2: Update Job Creation Flow**
- File: `src/app/(authenticated)/supervisor/jobs/page.tsx`
- Changes:
  - Accept templateId in form data
  - Pass templateId to API
  - API instantiates template after job creation

**T2.3: Update Job Creation API (if needed)**
- File: `src/app/api/supervisor/jobs/route.ts`
- Changes:
  - Accept optional template_id in payload
  - After job creation, call TaskTemplateService.instantiateTemplate
  - Return job with tasks in response

### Phase 3: Supervisor Job Detail Enhancement (2-3 hours)

**T3.1: Add TaskList to Supervisor Job Detail**
- File: `src/app/(authenticated)/supervisor/jobs/[jobId]/page.tsx`
- Changes:
  - Import and render TaskList component
  - Set editable=false (supervisor view-only)
  - Add "Tasks" section with progress stats

**T3.2: Add Template Instantiation to Job Detail**
- Component: `TaskTemplateSelector` (already exists!)
- Changes:
  - Add "Add Tasks from Template" button/dropdown
  - Render TaskTemplateSelector in compact mode
  - Handle instantiation success/errors
  - Refresh task list after instantiation

**T3.3: Create TaskEditor Component**
- File: `src/components/tasks/TaskEditor.tsx`
- Features:
  - Modal or inline form
  - Fields: description, order, is_required, requires_photo, requires_supervisor_approval, acceptance_criteria
  - Submit to POST /api/jobs/[jobId]/tasks
  - Edit mode: PATCH to /api/jobs/[jobId]/tasks/[taskId]

**T3.4: Add Task Management Actions**
- Enhance `TaskItem` component with supervisor actions
- Changes:
  - Show edit/delete buttons when role=supervisor
  - Edit button opens TaskEditor modal
  - Delete button soft-deletes task
  - Disable actions for completed tasks

### Phase 4: Testing & Polish (2-3 hours)

**T4.1: End-to-End Testing**
- Create template with 3 tasks
- Create job with template (tasks auto-added)
- Add template to existing job
- Add individual task to job
- Edit task on job
- Delete task from job
- Crew completes tasks
- Verify supervisor can see progress

**T4.2: Edge Cases & Validation**
- Prevent deleting templates in use
- Prevent deleting completed tasks
- Warn when adding template to job with tasks
- Validate task order conflicts
- Handle API errors gracefully

**T4.3: UI Polish**
- Loading states for all async operations
- Success/error notifications
- Optimistic UI updates
- Mobile responsiveness
- Accessibility (keyboard navigation, ARIA labels)

**T4.4: Documentation**
- Update CLAUDE.md with task management patterns
- Add inline code comments
- Create user guide (if needed)

---

## 📝 Data Flow

### Template Creation Flow
```
Supervisor → Template Form
           ↓
       Validation
           ↓
   POST /api/task-templates
           ↓
   TaskTemplateRepository.create()
           ↓
   TaskTemplateItemRepository.createMany()
           ↓
   Return template with items
           ↓
   Navigate to /supervisor/templates
```

### Job Creation with Template Flow
```
Supervisor → Job Form (with template selected)
           ↓
   POST /api/supervisor/jobs
           ↓
   JobService.create()
           ↓
   TaskTemplateService.instantiateTemplate()
           ↓
   WorkflowTaskRepository.createFromTemplate()
           ↓
   Return job with tasks
           ↓
   Navigate to job detail
```

### Add Template to Existing Job Flow
```
Supervisor → Job Detail → "Add from Template"
           ↓
   Select template
           ↓
   POST /api/task-templates/[id]/instantiate
           ↓
   TaskTemplateService.instantiateTemplate()
           ↓
   Return created tasks
           ↓
   Refresh task list
```

### Add Individual Task Flow
```
Supervisor → Job Detail → "Add Task"
           ↓
   Fill task form
           ↓
   POST /api/jobs/[jobId]/tasks
           ↓
   WorkflowTaskRepository.create()
           ↓
   Return created task
           ↓
   Update task list (optimistic)
```

---

## 🔒 Security & Permissions

### RLS Policies (Already exist, verify)
```sql
-- Templates: Tenant isolation
task_templates.tenant_id = auth.jwt() ->> 'tenant_id'

-- Template items: Via template tenant_id
task_template_items.template_id → task_templates(tenant_id)

-- Workflow tasks: Via job tenant_id
workflow_tasks.job_id → jobs(tenant_id)
```

### Role Checks
- Only supervisors can create/edit/delete templates
- Only supervisors can edit/delete tasks on jobs
- Crew can only complete tasks, not edit/delete
- All operations respect tenant isolation

---

## 📊 Success Metrics

- Supervisors can create templates in < 2 minutes
- 90% of jobs use templates (track template usage)
- Task completion rate visible on job detail
- Zero RLS policy violations
- Mobile-responsive on all pages

---

## 🚀 Deployment Checklist

- [ ] All TypeScript errors resolved
- [ ] All tests passing (unit + contract + E2E)
- [ ] RLS policies verified
- [ ] Mobile UI tested on 375px viewport
- [ ] Accessibility audit (keyboard nav, screen readers)
- [ ] API response times < 500ms
- [ ] Error boundaries in place
- [ ] Loading states for all async ops
- [ ] Success/error notifications working
- [ ] Documentation updated

---

## 📚 Future Enhancements (Out of Scope)

- Template versioning (track changes over time)
- Template categories/tags
- Template sharing across tenants
- Task dependencies (task B unlocks after task A)
- Conditional tasks (if equipment X, then task Y)
- Task time estimates and scheduling
- Task attachments (PDFs, images)
- Task comments/notes
- Bulk task operations
- Template analytics dashboard

---

## 🎯 Next Steps

1. Review this plan with stakeholders
2. Estimate effort per phase
3. Prioritize phases (can we ship Phase 1 separately?)
4. Start implementation with Phase 1
5. Iterate based on feedback

**Ready to start implementation? Which phase should we begin with?**
