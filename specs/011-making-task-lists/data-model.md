# Data Model: Task Lists for Jobs

**Feature**: 011-making-task-lists
**Date**: 2025-10-18
**Status**: Phase 1 Complete

## Entity Relationship Diagram

```
┌─────────────┐
│   tenants   │
└──────┬──────┘
       │
       ├──────────────────────────────────────┐
       │                                      │
       │                                      │
┌──────▼──────┐                    ┌─────────▼────────┐
│    jobs     │                    │ task_templates   │
└──────┬──────┘                    └─────────┬────────┘
       │                                     │
       │                                     │
       │                           ┌─────────▼────────────────┐
       │                           │ task_template_items      │
       │                           └──────────────────────────┘
       │                                     │
       │                                     │ (instantiated from)
       │                                     │
┌──────▼───────────────┐                    │
│  workflow_tasks      │◄───────────────────┘
│  (ENHANCED)          │
└──────────────────────┘
```

---

## Table Schemas

### 1. workflow_tasks (ENHANCED)

**Purpose**: Individual tasks associated with jobs, tracking completion status, verification, and supervisor approval.

**Enhancements**: Add `is_required`, `is_deleted`, `template_id` columns to existing table.

```sql
CREATE TABLE workflow_tasks (
  -- Existing columns (21 total)
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id),
  job_id                      UUID NOT NULL REFERENCES jobs(id),
  task_description            TEXT NOT NULL,
  task_order                  INTEGER NOT NULL DEFAULT 0,
  status                      TEXT NOT NULL DEFAULT 'pending',
  completed_by                UUID REFERENCES auth.users(id),
  completed_at                TIMESTAMPTZ,
  verification_photo_url      TEXT,
  ai_confidence               DOUBLE PRECISION,
  requires_supervisor_review  BOOLEAN DEFAULT false,
  supervisor_approved         BOOLEAN,
  supervisor_notes            TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  verification_method         TEXT DEFAULT 'manual',
  verification_data           JSONB DEFAULT '{}',
  requires_supervisor_approval BOOLEAN DEFAULT false,
  user_id                     UUID REFERENCES auth.users(id),
  task_type                   TEXT DEFAULT 'verification',
  supervisor_id               UUID REFERENCES auth.users(id),

  -- NEW columns
  is_required                 BOOLEAN NOT NULL DEFAULT true,
  is_deleted                  BOOLEAN NOT NULL DEFAULT false,
  template_id                 UUID REFERENCES task_templates(id)
);

-- Indexes
CREATE INDEX idx_workflow_tasks_job_order
  ON workflow_tasks(job_id, task_order);

CREATE INDEX idx_workflow_tasks_required
  ON workflow_tasks(job_id, is_required)
  WHERE is_deleted = false;

CREATE INDEX idx_workflow_tasks_template
  ON workflow_tasks(template_id)
  WHERE template_id IS NOT NULL;

-- RLS Policy (FIXED per constitution)
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_tasks_tenant_isolation ON workflow_tasks;

CREATE POLICY workflow_tasks_tenant_isolation ON workflow_tasks
  FOR ALL
  USING (
    tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata' ->> 'tenant_id'
    )
  );
```

**Validation Rules**:
- `task_description`: NOT NULL, length 1-500 chars
- `task_order`: >= 0
- `status`: ENUM('pending', 'in-progress', 'complete', 'skipped', 'failed')
- `ai_confidence`: 0.0-1.0 when present
- `is_deleted`: When true, task not editable/deletable (soft delete)
- `is_required`: When true, blocks job completion if task incomplete

**State Transitions**:
```
pending → in-progress → complete
        ↓              ↓
       skipped       failed
```

---

### 2. task_templates (NEW)

**Purpose**: Reusable task list templates for job types, scoped by tenant.

```sql
CREATE TABLE task_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  job_type     VARCHAR(100),  -- e.g., "HVAC Maintenance", "Electrical Inspection"
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT task_templates_name_tenant_unique UNIQUE(tenant_id, name)
);

-- Indexes
CREATE INDEX idx_task_templates_tenant_active
  ON task_templates(tenant_id, is_active);

CREATE INDEX idx_task_templates_job_type
  ON task_templates(job_type)
  WHERE is_active = true;

-- RLS Policy
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_templates_tenant_isolation ON task_templates
  FOR ALL
  USING (
    tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata' ->> 'tenant_id'
    )
  );
```

**Validation Rules**:
- `name`: NOT NULL, unique per tenant, length 1-255 chars
- `job_type`: Optional categorization, length <= 100 chars
- `is_active`: Templates can be soft-deactivated

---

### 3. task_template_items (NEW)

**Purpose**: Individual task definitions within a template, defining default properties.

```sql
CREATE TABLE task_template_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id                 UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  task_order                  INTEGER NOT NULL DEFAULT 0,
  task_description            TEXT NOT NULL,
  is_required                 BOOLEAN NOT NULL DEFAULT true,
  requires_photo_verification BOOLEAN DEFAULT false,
  requires_supervisor_approval BOOLEAN DEFAULT false,
  acceptance_criteria         TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT task_template_items_order_unique UNIQUE(template_id, task_order)
);

-- Indexes
CREATE INDEX idx_task_template_items_template_order
  ON task_template_items(template_id, task_order);

-- RLS Policy (inherited through template_id FK)
ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_template_items_tenant_isolation ON task_template_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM task_templates
      WHERE task_templates.id = task_template_items.template_id
      AND task_templates.tenant_id::text = (
        current_setting('request.jwt.claims', true)::json
        -> 'app_metadata' ->> 'tenant_id'
      )
    )
  );
```

**Validation Rules**:
- `task_description`: NOT NULL, length 1-500 chars
- `task_order`: >= 0, unique per template
- `is_required`: Copied to workflow_tasks when template instantiated
- `requires_photo_verification`: Sets verification expectation
- `requires_supervisor_approval`: Sets approval workflow requirement

**Cascade Behavior**:
- When template deleted, all items cascade delete (ON DELETE CASCADE)
- When template instantiated, items copied to workflow_tasks (application logic)

---

## Relationships

### 1. tenants → task_templates (1:many)
- One tenant has many templates
- Templates scoped by tenant_id
- RLS enforces tenant isolation

### 2. task_templates → task_template_items (1:many)
- One template has many items
- Items define task sequence (task_order)
- Cascade delete when template removed

### 3. jobs → workflow_tasks (1:many)
- One job has many tasks
- Tasks ordered by task_order
- Cannot hard-delete after job starts (is_deleted flag)

### 4. task_templates → workflow_tasks (1:many, optional)
- Template can spawn many task instances
- workflow_tasks.template_id links back to source template
- Allows tracking "which template was used" for analytics

---

## Type Definitions (TypeScript)

```typescript
// Generated from Supabase schema
export type WorkflowTask = Database['public']['Tables']['workflow_tasks']['Row'];
export type TaskTemplate = Database['public']['Tables']['task_templates']['Row'];
export type TaskTemplateItem = Database['public']['Tables']['task_template_items']['Row'];

// Zod schemas for validation
import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'pending',
  'in-progress',
  'complete',
  'skipped',
  'failed'
]);

export const CreateTaskSchema = z.object({
  job_id: z.string().uuid(),
  task_description: z.string().min(1).max(500),
  task_order: z.number().int().min(0),
  is_required: z.boolean().default(true),
  requires_photo_verification: z.boolean().default(false),
  requires_supervisor_approval: z.boolean().default(false),
  acceptance_criteria: z.string().max(1000).optional(),
  task_type: z.string().max(50).default('verification'),
});

export const UpdateTaskSchema = z.object({
  task_description: z.string().min(1).max(500).optional(),
  task_order: z.number().int().min(0).optional(),
  status: TaskStatusSchema.optional(),
  completed_at: z.date().optional(),
  verification_photo_url: z.string().url().optional(),
  ai_confidence: z.number().min(0).max(1).optional(),
  verification_method: z.enum(['manual', 'vlm', 'yolo']).optional(),
  verification_data: z.record(z.any()).optional(),
  supervisor_notes: z.string().max(1000).optional(),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  job_type: z.string().max(100).optional(),
});

export const CreateTemplateItemSchema = z.object({
  template_id: z.string().uuid(),
  task_order: z.number().int().min(0),
  task_description: z.string().min(1).max(500),
  is_required: z.boolean().default(true),
  requires_photo_verification: z.boolean().default(false),
  requires_supervisor_approval: z.boolean().default(false),
  acceptance_criteria: z.string().max(1000).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type CreateTemplateItemInput = z.infer<typeof CreateTemplateItemSchema>;
```

---

## Business Rules

### Task Lifecycle
1. **Creation**: Tasks created via API or template instantiation
2. **Modification Before Job Start**: Tasks can be added/removed freely
3. **Modification After Job Start**:
   - ✅ Can add new tasks
   - ✅ Can mark tasks skipped/failed/complete
   - ❌ Cannot hard-delete tasks (set is_deleted = true instead)
   - ❌ Cannot remove required flag once set
4. **Completion**: When task completed, set status='complete', completed_at=NOW(), completed_by=user_id
5. **Verification**: If requires_photo_verification, must upload photo before marking complete
6. **Supervisor Approval**: If requires_supervisor_approval, status='complete' but supervisor_approved remains null until approved

### Template Instantiation
1. Supervisor selects template when creating job
2. System copies all task_template_items to workflow_tasks:
   - Sets job_id to new job
   - Copies task_description, task_order, is_required, etc.
   - Sets template_id reference
   - Sets status='pending'
3. Technician can then add additional ad-hoc tasks

### Job Completion Validation
1. Query all workflow_tasks WHERE job_id=X AND is_deleted=false
2. Filter to is_required=true
3. Check all have status IN ('complete', 'skipped')
4. If any required tasks pending/in-progress → block job completion
5. Optional tasks (is_required=false) can remain incomplete

---

## Performance Considerations

### Query Optimization
- Index on (job_id, task_order) supports ordered task list retrieval
- Index on (job_id, is_required) supports job completion validation
- Index on (tenant_id, is_active) supports template browsing

### Expected Query Patterns
```sql
-- List tasks for job (most frequent)
SELECT * FROM workflow_tasks
WHERE job_id = $1 AND is_deleted = false
ORDER BY task_order;

-- Check job can complete (second most frequent)
SELECT COUNT(*) FROM workflow_tasks
WHERE job_id = $1
  AND is_deleted = false
  AND is_required = true
  AND status NOT IN ('complete', 'skipped');

-- Get active templates for tenant
SELECT * FROM task_templates
WHERE tenant_id = $1 AND is_active = true
ORDER BY name;

-- Instantiate template
SELECT * FROM task_template_items
WHERE template_id = $1
ORDER BY task_order;
```

### Estimated Data Volume
- 50 tenants × 10 templates = 500 task_templates rows
- 500 templates × 15 items avg = 7,500 task_template_items rows
- 1,000 jobs/month × 20 tasks avg = 20,000 workflow_tasks rows/month
- After 12 months: ~240,000 workflow_tasks rows (manageable with indexes)

---

**Data Model Complete**: 2025-10-18
**Next**: API Contracts (contracts/)
