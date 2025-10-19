# Task Template Management - Complete Workflow

## 🎭 User Roles & Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                         SUPERVISOR                               │
├─────────────────────────────────────────────────────────────────┤
│ • Create/edit/delete task templates                             │
│ • Apply templates to jobs (creation or existing)                │
│ • Add/edit/delete individual tasks on jobs                      │
│ • View task completion progress (read-only)                     │
│ • Cannot complete tasks (crew's responsibility)                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                            CREW                                  │
├─────────────────────────────────────────────────────────────────┤
│ • View task list for assigned jobs                              │
│ • Complete tasks (with photo verification if required)          │
│ • Cannot edit/delete tasks                                      │
│ • Cannot create templates                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete User Journey

### Journey 1: Supervisor Creates Template & Job

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Create Template                                         │
├─────────────────────────────────────────────────────────────────┤
│ Supervisor navigates to /supervisor/templates                   │
│           ↓                                                      │
│ Clicks "Create Template"                                        │
│           ↓                                                      │
│ Fills form:                                                     │
│   • Name: "Standard Lawn Service"                              │
│   • Description: "Standard residential lawn care"              │
│   • Job Type: "lawn_maintenance"                               │
│   • Active: ✓                                                  │
│           ↓                                                      │
│ Adds task items:                                                │
│   1. "Mow grass" (required, photo verification)                │
│   2. "Edge borders" (required, photo verification)             │
│   3. "Blow off clippings" (optional)                           │
│   4. "Take completion photo" (required, photo)                 │
│           ↓                                                      │
│ Saves template → API creates in database                        │
│           ↓                                                      │
│ Redirected to /supervisor/templates (shows new template)        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Create Job with Template                                │
├─────────────────────────────────────────────────────────────────┤
│ Supervisor navigates to /supervisor/jobs                        │
│           ↓                                                      │
│ Clicks "Create Job"                                             │
│           ↓                                                      │
│ Fills job form:                                                 │
│   • Customer: "John Smith"                                      │
│   • Property: "123 Main St"                                     │
│   • Title: "Weekly lawn service"                                │
│   • Date: 2025-10-20                                            │
│   • Template: "Standard Lawn Service" ← SELECTS TEMPLATE        │
│           ↓                                                      │
│ Preview shows: "4 tasks will be added"                          │
│           ↓                                                      │
│ Clicks "Create Job" → API creates job + instantiates template   │
│           ↓                                                      │
│ 4 tasks automatically created:                                  │
│   • workflow_tasks records with job_id, template_id             │
│   • status: pending                                             │
│   • task_order: 0, 1, 2, 3                                      │
│           ↓                                                      │
│ Redirected to /supervisor/jobs/[jobId]                          │
│ Shows job details + 4 tasks in task list                        │
└─────────────────────────────────────────────────────────────────┘
```

### Journey 2: Supervisor Adds Tasks to Existing Job

```
┌─────────────────────────────────────────────────────────────────┐
│ SCENARIO: Job created WITHOUT template, need to add tasks       │
├─────────────────────────────────────────────────────────────────┤
│ Supervisor viewing /supervisor/jobs/[jobId]                     │
│           ↓                                                      │
│ Sees "No tasks yet" or empty task list                          │
│           ↓                                                      │
│ OPTION A: Click "Add Tasks from Template"                       │
│           ↓                                                      │
│ Dropdown shows available templates                              │
│           ↓                                                      │
│ Selects "Standard Lawn Service"                                 │
│           ↓                                                      │
│ POST /api/task-templates/[id]/instantiate                       │
│           ↓                                                      │
│ 4 tasks created and added to job                                │
│           ↓                                                      │
│ Task list refreshes, shows 4 tasks                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ OPTION B: Click "Add Task" (individual task)                    │
├─────────────────────────────────────────────────────────────────┤
│ Modal opens with TaskEditor form                                │
│           ↓                                                      │
│ Fills form:                                                     │
│   • Description: "Check sprinkler system"                       │
│   • Order: 5                                                    │
│   • Required: ✓                                                │
│   • Photo verification: ✓                                       │
│   • Supervisor approval: -                                      │
│   • Criteria: "All zones functioning"                           │
│           ↓                                                      │
│ Clicks "Add Task" → POST /api/jobs/[jobId]/tasks               │
│           ↓                                                      │
│ Task created in database                                        │
│           ↓                                                      │
│ Task list updates (optimistic UI)                               │
│           ↓                                                      │
│ New task appears in list at position 5                          │
└─────────────────────────────────────────────────────────────────┘
```

### Journey 3: Crew Completes Tasks

```
┌─────────────────────────────────────────────────────────────────┐
│ Crew member assigned to job                                     │
├─────────────────────────────────────────────────────────────────┤
│ Navigates to /crew/jobs/[jobId]                                │
│           ↓                                                      │
│ Sees job details + Task List component (editable)               │
│           ↓                                                      │
│ Task List shows:                                                │
│   ✓ 1. Mow grass (complete) ← already done                     │
│   ⏳ 2. Edge borders (in progress)                              │
│   ○ 3. Blow off clippings (pending)                            │
│   ○ 4. Take completion photo (pending)                         │
│           ↓                                                      │
│ Clicks task #2 "Edge borders"                                   │
│           ↓                                                      │
│ Photo verification required → camera opens                      │
│           ↓                                                      │
│ Takes photo of edged borders                                    │
│           ↓                                                      │
│ Photo uploaded to storage                                       │
│           ↓                                                      │
│ PATCH /api/jobs/[jobId]/tasks/[taskId]                         │
│   • status: complete                                            │
│   • completed_at: timestamp                                     │
│   • verification_photo_url: <url>                               │
│   • completed_by: crew_user_id                                  │
│           ↓                                                      │
│ Task updates to "complete" status                               │
│           ↓                                                      │
│ Progress updates: "2 of 4 complete (50%)"                       │
│           ↓                                                      │
│ Continues with remaining tasks...                               │
└─────────────────────────────────────────────────────────────────┘
```

### Journey 4: Supervisor Monitors Progress

```
┌─────────────────────────────────────────────────────────────────┐
│ While crew is working...                                        │
├─────────────────────────────────────────────────────────────────┤
│ Supervisor views /supervisor/jobs/[jobId]                       │
│           ↓                                                      │
│ Sees Task List (read-only view):                                │
│   ✓ 1. Mow grass                                               │
│      Completed by Mike • 1 hour ago                            │
│      Photo verified (98% confidence)                            │
│                                                                 │
│   ✓ 2. Edge borders                                            │
│      Completed by Mike • 30 mins ago                           │
│      Photo verified (95% confidence)                            │
│                                                                 │
│   ⏳ 3. Blow off clippings (in progress)                        │
│                                                                 │
│   ○ 4. Take completion photo (pending)                         │
│                                                                 │
│ Progress: 2 of 4 complete (50%)                                │
│           ↓                                                      │
│ Can click task to view photos/details                           │
│           ↓                                                      │
│ Can edit task if needed (opens TaskEditor)                      │
│           ↓                                                      │
│ Can delete task if needed (soft delete)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Page Navigation Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPERVISOR NAVIGATION                         │
└─────────────────────────────────────────────────────────────────┘

/supervisor/templates ─────────────────────┐
  │                                         │
  ├─ [+ Create] ──→ /supervisor/templates/create
  │                      │
  │                      └─ [Save] ──→ back to /supervisor/templates
  │
  └─ [Edit] ──→ /supervisor/templates/[id]/edit
                      │
                      └─ [Save] ──→ back to /supervisor/templates


/supervisor/jobs ──────────────────────────┐
  │                                         │
  ├─ [+ Create Job] ──→ job creation form  │
  │      │                                  │
  │      ├─ Select Template (optional)     │
  │      └─ [Create] ──→ /supervisor/jobs/[jobId]
  │
  └─ Click job ──→ /supervisor/jobs/[jobId]
                      │
                      ├─ View task list (read-only)
                      ├─ [Add from Template] ──→ instantiate
                      ├─ [+ Add Task] ──→ TaskEditor modal
                      ├─ [Edit Task] ──→ TaskEditor modal
                      └─ [Delete Task] ──→ soft delete


┌─────────────────────────────────────────────────────────────────┐
│                       CREW NAVIGATION                            │
└─────────────────────────────────────────────────────────────────┘

/crew ──→ /crew/jobs/[jobId]
             │
             ├─ View task list (editable)
             ├─ Click task ──→ complete task
             │    │
             │    ├─ If photo required ──→ camera
             │    └─ Mark complete
             │
             └─ Voice commands:
                  "Show tasks"
                  "Complete task 2"
                  "Next task"
```

---

## 💾 Data Model Relationships

```
┌──────────────────────┐
│   task_templates     │  ← Supervisor creates
├──────────────────────┤
│ id                   │
│ tenant_id            │
│ name                 │
│ description          │
│ job_type             │
│ is_active            │
│ created_by           │
└──────────────────────┘
         │
         │ has many
         ↓
┌──────────────────────┐
│ task_template_items  │  ← Template items
├──────────────────────┤
│ id                   │
│ template_id          │  FK → task_templates.id
│ task_order           │
│ task_description     │
│ is_required          │
│ requires_photo_...   │
│ requires_super...    │
│ acceptance_criteria  │
└──────────────────────┘
         │
         │ instantiate
         ↓
┌──────────────────────┐
│   workflow_tasks     │  ← Actual job tasks
├──────────────────────┤
│ id                   │
│ job_id               │  FK → jobs.id
│ template_id          │  FK → task_templates.id (nullable)
│ task_description     │
│ task_order           │
│ status               │  pending → in_progress → complete
│ is_required          │
│ is_deleted           │  soft delete flag
│ completed_by         │  FK → users.id
│ completed_at         │
│ verification_photo   │
│ ai_confidence        │
└──────────────────────┘
```

---

## 🎯 Key Decision Points

### When creating a job:
```
START → Select template?
         │
    ┌────┴─────┐
    │          │
   YES        NO
    │          │
    ↓          ↓
Template   No tasks
tasks      created
created    initially
    │          │
    └────┬─────┘
         ↓
   Job created
```

### When viewing job as supervisor:
```
Has tasks? ───┐
              │
         ┌────┴─────┐
         │          │
        YES        NO
         │          │
         ↓          ↓
   Show task   "Add Tasks"
   list with   button only
   progress
         │
         ├─ Add from template
         ├─ Add individual task
         ├─ Edit task
         └─ Delete task
```

### When completing task as crew:
```
Task requires photo?
         │
    ┌────┴─────┐
    │          │
   YES        NO
    │          │
    ↓          ↓
 Open       Mark
 camera   complete
    │          │
    ├── Take photo
    ├── Upload
    └── Mark complete
```

---

## 📊 State Management

### TaskList Component States
```typescript
interface TaskListState {
  tasks: WorkflowTask[];
  loading: boolean;
  error: string | null;
  isOffline: boolean;
}

// Supervisor mode: editable=false, showActions=true
// Crew mode: editable=true, showActions=false
```

### Template Form States
```typescript
interface TemplateFormState {
  name: string;
  description: string;
  job_type: string | null;
  is_active: boolean;
  items: TemplateItemInput[];
}

interface TemplateItemInput {
  task_order: number;
  task_description: string;
  is_required: boolean;
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  acceptance_criteria: string | null;
}
```

---

## ✅ Success Criteria Checklist

- [ ] Supervisor can create template with 5+ items in < 3 minutes
- [ ] Template appears in list immediately after creation
- [ ] Job creation form shows template selector
- [ ] Selecting template shows task count preview
- [ ] Job created with template has all tasks
- [ ] Supervisor can view tasks on job detail page
- [ ] Supervisor can add template to existing job
- [ ] Supervisor can add individual task to job
- [ ] Supervisor can edit task description/requirements
- [ ] Supervisor can delete task (soft delete)
- [ ] Crew can view and complete tasks
- [ ] Task progress updates in real-time
- [ ] Photo verification works correctly
- [ ] All operations respect tenant isolation
- [ ] Mobile UI works on 375px viewport
- [ ] No TypeScript errors
- [ ] All tests passing

---

**Ready to implement? Let's start with Phase 1!**
