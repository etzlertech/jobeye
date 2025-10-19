# Data Model: Task-Item Associations

**Feature**: 015-task-item-association
**Date**: 2025-10-19
**Status**: Phase 1 Design

## Entity Relationship Diagram

```
┌─────────────────────┐
│  task_templates     │
└──────────┬──────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────┐
│ task_template_items     │
└──────────┬──────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────────────┐      ┌─────────────┐
│ task_template_item_associations      │ N:1  │   items     │
│ ─────────────────────────────────────┤─────▶│             │
│ - template_item_id (FK)              │      └─────────────┘
│ - item_id (FK, nullable)             │
│ - kit_id (FK, nullable)              │      ┌─────────────┐
│ - quantity                           │ N:1  │    kits     │
│ - is_required                        │─────▶│             │
│ - notes                              │      └─────────────┘
└──────────────────────────────────────┘


┌─────────────────────┐
│       jobs          │
└──────────┬──────────┘
           │
           │ 1:N
           ▼
┌─────────────────────┐
│  workflow_tasks     │
└──────────┬──────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────────────┐
│ workflow_task_item_associations      │
│ ─────────────────────────────────────┤
│ - workflow_task_id (FK)              │
│ - item_id (FK, nullable)             │      ┌─────────────┐
│ - kit_id (FK, nullable)              │ N:1  │   items     │
│ - quantity                           │─────▶│             │
│ - is_required                        │      └─────────────┘
│ - status (enum)                      │
│ - loaded_at, loaded_by               │      ┌─────────────┐
│ - notes                              │ N:1  │    kits     │
│ - source_template_association_id (FK)│─────▶│             │
└──────────────────────────────────────┘      └─────────────┘
           │
           │ N:1 (optional)
           ▼
┌──────────────────────────────────────┐
│ task_template_item_associations      │
│ (tracks template origin)             │
└──────────────────────────────────────┘
```

## Table Schemas

### task_template_item_associations

**Purpose**: Links task template items to required items or kits.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| tenant_id | UUID | NOT NULL, REFERENCES tenants(id) | Tenant isolation (RLS) |
| template_item_id | UUID | NOT NULL, REFERENCES task_template_items(id) ON DELETE CASCADE | Parent template item |
| item_id | UUID | NULLABLE, REFERENCES items(id) ON DELETE RESTRICT | Individual item (XOR with kit_id) |
| kit_id | UUID | NULLABLE, REFERENCES kits(id) ON DELETE RESTRICT | Item kit (XOR with item_id) |
| quantity | DECIMAL(10,2) | NOT NULL, DEFAULT 1, CHECK (quantity > 0) | Quantity needed |
| is_required | BOOLEAN | NOT NULL, DEFAULT true | Required vs. optional |
| notes | TEXT | NULLABLE | Usage notes, special instructions |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Constraints**:
```sql
-- XOR constraint: Exactly one of item_id or kit_id must be set
CHECK (
  (item_id IS NOT NULL AND kit_id IS NULL) OR
  (item_id IS NULL AND kit_id IS NOT NULL)
)

-- Unique constraint: Same item/kit can't be added twice to same template item
UNIQUE (template_item_id, item_id) WHERE item_id IS NOT NULL
UNIQUE (template_item_id, kit_id) WHERE kit_id IS NOT NULL
```

**Indexes**:
```sql
CREATE INDEX idx_template_item_assoc_template_item
  ON task_template_item_associations(template_item_id);

CREATE INDEX idx_template_item_assoc_item
  ON task_template_item_associations(item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX idx_template_item_assoc_kit
  ON task_template_item_associations(kit_id)
  WHERE kit_id IS NOT NULL;

CREATE INDEX idx_template_item_assoc_tenant
  ON task_template_item_associations(tenant_id);
```

**RLS Policy**:
```sql
ALTER TABLE task_template_item_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON task_template_item_associations
  FOR ALL
  USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

**Triggers**:
```sql
-- Auto-update updated_at timestamp
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON task_template_item_associations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### workflow_task_item_associations

**Purpose**: Links workflow tasks (job instances) to required items or kits with status tracking.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| tenant_id | UUID | NOT NULL, REFERENCES tenants(id) | Tenant isolation (RLS) |
| workflow_task_id | UUID | NOT NULL, REFERENCES workflow_tasks(id) ON DELETE CASCADE | Parent workflow task |
| item_id | UUID | NULLABLE, REFERENCES items(id) ON DELETE RESTRICT | Individual item (XOR with kit_id) |
| kit_id | UUID | NULLABLE, REFERENCES kits(id) ON DELETE RESTRICT | Item kit (XOR with item_id) |
| quantity | DECIMAL(10,2) | NOT NULL, DEFAULT 1, CHECK (quantity > 0) | Quantity needed |
| is_required | BOOLEAN | NOT NULL, DEFAULT true | Required vs. optional |
| status | task_item_status | NOT NULL, DEFAULT 'pending' | Loading status |
| loaded_at | TIMESTAMPTZ | NULLABLE | When marked as loaded |
| loaded_by | UUID | NULLABLE, REFERENCES users(id) | Who marked as loaded |
| notes | TEXT | NULLABLE | Usage notes, special instructions |
| source_template_association_id | UUID | NULLABLE, REFERENCES task_template_item_associations(id) | Template origin tracking |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Enum Type**:
```sql
CREATE TYPE task_item_status AS ENUM (
  'pending',    -- Created but not yet loaded
  'loaded',     -- Worker marked as loaded
  'verified',   -- Supervisor confirmed loaded
  'missing',    -- Item not available
  'returned'    -- Item returned to inventory
);
```

**Constraints**:
```sql
-- XOR constraint: Exactly one of item_id or kit_id must be set
CHECK (
  (item_id IS NOT NULL AND kit_id IS NULL) OR
  (item_id IS NULL AND kit_id IS NOT NULL)
)

-- Unique constraint: Same item/kit can't be added twice to same workflow task
UNIQUE (workflow_task_id, item_id) WHERE item_id IS NOT NULL
UNIQUE (workflow_task_id, kit_id) WHERE kit_id IS NOT NULL

-- Business rule: loaded_at and loaded_by set together
CHECK (
  (loaded_at IS NULL AND loaded_by IS NULL) OR
  (loaded_at IS NOT NULL AND loaded_by IS NOT NULL)
)
```

**Indexes**:
```sql
CREATE INDEX idx_workflow_task_assoc_task
  ON workflow_task_item_associations(workflow_task_id);

CREATE INDEX idx_workflow_task_assoc_item
  ON workflow_task_item_associations(item_id)
  WHERE item_id IS NOT NULL;

CREATE INDEX idx_workflow_task_assoc_kit
  ON workflow_task_item_associations(kit_id)
  WHERE kit_id IS NOT NULL;

CREATE INDEX idx_workflow_task_assoc_source
  ON workflow_task_item_associations(source_template_association_id)
  WHERE source_template_association_id IS NOT NULL;

CREATE INDEX idx_workflow_task_assoc_status
  ON workflow_task_item_associations(status);

CREATE INDEX idx_workflow_task_assoc_tenant
  ON workflow_task_item_associations(tenant_id);
```

**RLS Policy**:
```sql
ALTER TABLE workflow_task_item_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON workflow_task_item_associations
  FOR ALL
  USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

**Triggers**:
```sql
-- Auto-update updated_at timestamp
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON workflow_task_item_associations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-set loaded_at when status changes to 'loaded'
CREATE OR REPLACE FUNCTION set_loaded_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'loaded' AND OLD.status != 'loaded' AND NEW.loaded_at IS NULL THEN
    NEW.loaded_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_loaded_at
  BEFORE UPDATE OF status ON workflow_task_item_associations
  FOR EACH ROW
  EXECUTE FUNCTION set_loaded_timestamp();
```

## Entity Types

### TaskTemplateItemAssociation

**TypeScript Interface**:
```typescript
export interface TaskTemplateItemAssociation {
  id: string;
  tenant_id: string;
  template_item_id: string;
  item_id: string | null;
  kit_id: string | null;
  quantity: number;
  is_required: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

**Create Input**:
```typescript
export interface CreateTemplateItemAssociationInput {
  template_item_id: string;
  item_id?: string | null;
  kit_id?: string | null;
  quantity?: number;
  is_required?: boolean;
  notes?: string | null;
}
```

**Update Input**:
```typescript
export interface UpdateTemplateItemAssociationInput {
  quantity?: number;
  is_required?: boolean;
  notes?: string | null;
}
```

### WorkflowTaskItemAssociation

**TypeScript Interface**:
```typescript
export interface WorkflowTaskItemAssociation {
  id: string;
  tenant_id: string;
  workflow_task_id: string;
  item_id: string | null;
  kit_id: string | null;
  quantity: number;
  is_required: boolean;
  status: TaskItemStatus;
  loaded_at: string | null;
  loaded_by: string | null;
  notes: string | null;
  source_template_association_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskItemStatus =
  | 'pending'
  | 'loaded'
  | 'verified'
  | 'missing'
  | 'returned';
```

**Create Input**:
```typescript
export interface CreateWorkflowTaskItemAssociationInput {
  workflow_task_id: string;
  item_id?: string | null;
  kit_id?: string | null;
  quantity?: number;
  is_required?: boolean;
  status?: TaskItemStatus;
  notes?: string | null;
  source_template_association_id?: string | null;
}
```

**Update Input**:
```typescript
export interface UpdateWorkflowTaskItemAssociationInput {
  quantity?: number;
  is_required?: boolean;
  status?: TaskItemStatus;
  loaded_by?: string | null;
  notes?: string | null;
}
```

## Validation Rules

### Zod Schemas

```typescript
import { z } from 'zod';

// Template Item Association Schemas
export const CreateTemplateItemAssociationSchema = z.object({
  template_item_id: z.string().uuid(),
  item_id: z.string().uuid().nullable().optional(),
  kit_id: z.string().uuid().nullable().optional(),
  quantity: z.number().positive().default(1),
  is_required: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
}).refine(
  (data) => (data.item_id && !data.kit_id) || (!data.item_id && data.kit_id),
  { message: "Exactly one of item_id or kit_id must be provided" }
);

export const UpdateTemplateItemAssociationSchema = z.object({
  quantity: z.number().positive().optional(),
  is_required: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// Workflow Task Item Association Schemas
export const TaskItemStatusSchema = z.enum([
  'pending',
  'loaded',
  'verified',
  'missing',
  'returned',
]);

export const CreateWorkflowTaskItemAssociationSchema = z.object({
  workflow_task_id: z.string().uuid(),
  item_id: z.string().uuid().nullable().optional(),
  kit_id: z.string().uuid().nullable().optional(),
  quantity: z.number().positive().default(1),
  is_required: z.boolean().default(true),
  status: TaskItemStatusSchema.default('pending'),
  notes: z.string().max(2000).nullable().optional(),
  source_template_association_id: z.string().uuid().nullable().optional(),
}).refine(
  (data) => (data.item_id && !data.kit_id) || (!data.item_id && data.kit_id),
  { message: "Exactly one of item_id or kit_id must be provided" }
);

export const UpdateWorkflowTaskItemAssociationSchema = z.object({
  quantity: z.number().positive().optional(),
  is_required: z.boolean().optional(),
  status: TaskItemStatusSchema.optional(),
  loaded_by: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
```

## Business Rules

### BR-1: XOR Constraint Enforcement
- Association MUST link to exactly ONE of: item OR kit
- Enforced at database level via CHECK constraint
- Validated at application level via Zod schema

### BR-2: Cascade Deletes
- Deleting task_template_item → CASCADE delete template_item_associations
- Deleting workflow_task → CASCADE delete workflow_task_item_associations
- Deleting item/kit → RESTRICT (must remove associations first)

### BR-3: Status Transitions
Valid transitions for workflow_task_item_associations:
```
pending → loaded (worker loads equipment)
pending → missing (item not available)
loaded → verified (supervisor confirms)
loaded → returned (task complete, item back to inventory)
missing → loaded (item found)
verified → returned (task complete)
```

Invalid transitions (should be prevented):
- loaded → pending (can't "unload" without returning)
- returned → any other state (finalized)

### BR-4: Required Items Block Task Completion
- If workflow_task_item_association.is_required = true
- AND status = 'missing'
- THEN workflow_task cannot transition to 'completed' status
- Enforced at service layer during task status updates

### BR-5: Template Snapshot Isolation
- workflow_task_item_associations created at template instantiation
- Changes to task_template_item_associations do NOT propagate to existing jobs
- Only affects NEW job instantiations
- source_template_association_id preserves audit trail but not sync

## Query Patterns

### Load Template with Item Associations
```typescript
const template = await supabase
  .from('task_templates')
  .select(`
    *,
    items:task_template_items (
      *,
      associations:task_template_item_associations (
        *,
        item:items (*),
        kit:kits (*)
      )
    )
  `)
  .eq('id', templateId)
  .single();
```

### Load Job with Task Equipment
```typescript
const job = await supabase
  .from('jobs')
  .select(`
    *,
    tasks:workflow_tasks (
      *,
      equipment:workflow_task_item_associations (
        *,
        item:items (*),
        kit:kits (*)
      )
    )
  `)
  .eq('id', jobId);
```

### Find Missing Items Blocking Task Completion
```typescript
const blockingItems = await supabase
  .from('workflow_task_item_associations')
  .select('*, item:items(*), kit:kits(*)')
  .eq('workflow_task_id', taskId)
  .eq('is_required', true)
  .eq('status', 'missing');
```

## Migration Strategy

### Step 1: Create Enum Type
```sql
CREATE TYPE task_item_status AS ENUM (
  'pending', 'loaded', 'verified', 'missing', 'returned'
);
```

### Step 2: Create task_template_item_associations Table
```sql
CREATE TABLE IF NOT EXISTS task_template_item_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_item_id UUID NOT NULL REFERENCES task_template_items(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE RESTRICT,
  kit_id UUID REFERENCES kits(id) ON DELETE RESTRICT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_required BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (item_id IS NOT NULL AND kit_id IS NULL) OR
    (item_id IS NULL AND kit_id IS NOT NULL)
  )
);
```

### Step 3: Create workflow_task_item_associations Table
```sql
CREATE TABLE IF NOT EXISTS workflow_task_item_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_task_id UUID NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE RESTRICT,
  kit_id UUID REFERENCES kits(id) ON DELETE RESTRICT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  is_required BOOLEAN NOT NULL DEFAULT true,
  status task_item_status NOT NULL DEFAULT 'pending',
  loaded_at TIMESTAMPTZ,
  loaded_by UUID REFERENCES users(id),
  notes TEXT,
  source_template_association_id UUID REFERENCES task_template_item_associations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (item_id IS NOT NULL AND kit_id IS NULL) OR
    (item_id IS NULL AND kit_id IS NOT NULL)
  ),
  CHECK (
    (loaded_at IS NULL AND loaded_by IS NULL) OR
    (loaded_at IS NOT NULL AND loaded_by IS NOT NULL)
  )
);
```

### Step 4: Add Indexes
```sql
-- Template associations indexes
CREATE INDEX idx_template_item_assoc_template_item
  ON task_template_item_associations(template_item_id);
CREATE INDEX idx_template_item_assoc_item
  ON task_template_item_associations(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX idx_template_item_assoc_kit
  ON task_template_item_associations(kit_id) WHERE kit_id IS NOT NULL;
CREATE INDEX idx_template_item_assoc_tenant
  ON task_template_item_associations(tenant_id);

-- Workflow associations indexes
CREATE INDEX idx_workflow_task_assoc_task
  ON workflow_task_item_associations(workflow_task_id);
CREATE INDEX idx_workflow_task_assoc_item
  ON workflow_task_item_associations(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX idx_workflow_task_assoc_kit
  ON workflow_task_item_associations(kit_id) WHERE kit_id IS NOT NULL;
CREATE INDEX idx_workflow_task_assoc_source
  ON workflow_task_item_associations(source_template_association_id)
  WHERE source_template_association_id IS NOT NULL;
CREATE INDEX idx_workflow_task_assoc_status
  ON workflow_task_item_associations(status);
CREATE INDEX idx_workflow_task_assoc_tenant
  ON workflow_task_item_associations(tenant_id);
```

### Step 5: Add RLS Policies
```sql
ALTER TABLE task_template_item_associations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON task_template_item_associations
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );

ALTER TABLE workflow_task_item_associations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON workflow_task_item_associations
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

### Step 6: Add Triggers
```sql
-- Updated timestamp triggers
CREATE TRIGGER set_updated_at_template_assoc
  BEFORE UPDATE ON task_template_item_associations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_workflow_assoc
  BEFORE UPDATE ON workflow_task_item_associations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-set loaded_at trigger
CREATE OR REPLACE FUNCTION set_loaded_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'loaded' AND OLD.status != 'loaded' AND NEW.loaded_at IS NULL THEN
    NEW.loaded_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_loaded_at
  BEFORE UPDATE OF status ON workflow_task_item_associations
  FOR EACH ROW EXECUTE FUNCTION set_loaded_timestamp();
```

## Rollback Plan

If migration fails or needs to be reverted:
```sql
DROP TRIGGER IF EXISTS auto_set_loaded_at ON workflow_task_item_associations;
DROP TRIGGER IF EXISTS set_updated_at_workflow_assoc ON workflow_task_item_associations;
DROP TRIGGER IF EXISTS set_updated_at_template_assoc ON task_template_item_associations;
DROP FUNCTION IF EXISTS set_loaded_timestamp();
DROP TABLE IF EXISTS workflow_task_item_associations;
DROP TABLE IF EXISTS task_template_item_associations;
DROP TYPE IF EXISTS task_item_status;
```

**Safety**: No existing data affected (new tables only), can safely drop without data loss.
