# Data Model: Task Management

**Feature**: 014-add-task-management
**Date**: 2025-10-19

## Entity: TaskDefinition

### Purpose
Represents a reusable task definition in the task library. Serves as a building block for creating task templates. Each definition contains the core attributes that can be copied into templates and ultimately instantiated as workflow tasks.

### Schema

```sql
CREATE TABLE IF NOT EXISTS task_definitions (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (constitutional requirement)
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Core fields
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) >= 1 AND char_length(description) <= 2000),
  acceptance_criteria TEXT CHECK (acceptance_criteria IS NULL OR char_length(acceptance_criteria) <= 2000),

  -- Configuration flags
  requires_photo_verification BOOLEAN NOT NULL DEFAULT false,
  requires_supervisor_approval BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT true,

  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT task_definitions_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT task_definitions_description_not_empty CHECK (char_length(trim(description)) > 0)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_task_definitions_tenant
  ON task_definitions(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_definitions_tenant_name
  ON task_definitions(tenant_id, name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_definitions_created_by
  ON task_definitions(created_by) WHERE deleted_at IS NULL;

-- RLS Policy (constitutional requirement - correct JWT path)
ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_task_definitions" ON task_definitions
  FOR ALL USING (
    tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata' ->> 'tenant_id'
    )
  );

-- Auto-update updated_at timestamp
CREATE TRIGGER update_task_definitions_updated_at
  BEFORE UPDATE ON task_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Field Specifications

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | PRIMARY KEY, NOT NULL | gen_random_uuid() | Unique identifier |
| `tenant_id` | UUID | NOT NULL, FK → tenants(id) | - | Tenant isolation |
| `name` | VARCHAR(255) | NOT NULL, length > 0 | - | Task name (FR-011) |
| `description` | TEXT | NOT NULL, 1-2000 chars | - | Detailed description (FR-012) |
| `acceptance_criteria` | TEXT | NULLABLE, 0-2000 chars | NULL | Success criteria (FR-013) |
| `requires_photo_verification` | BOOLEAN | NOT NULL | false | Photo required? (FR-014) |
| `requires_supervisor_approval` | BOOLEAN | NOT NULL | false | Approval required? (FR-015) |
| `is_required` | BOOLEAN | NOT NULL | true | Required vs optional (FR-016) |
| `created_by` | UUID | NULLABLE, FK → auth.users(id) | - | User who created (FR-038) |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | Creation timestamp (FR-038) |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | Last update timestamp (FR-038) |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | NULL | Soft delete timestamp |

### Relationships

```
┌─────────────────────────────────────────────────────────┐
│                       tenants                           │
│ - id (PK)                                              │
│ - name                                                  │
└───────────────────────────┬─────────────────────────────┘
                            │ 1
                            │
                            │ N
┌───────────────────────────┴─────────────────────────────┐
│                  task_definitions                        │
│ - id (PK)                                               │
│ - tenant_id (FK)                                        │
│ - name                                                   │
│ - description                                            │
│ - acceptance_criteria                                    │
│ - requires_photo_verification                           │
│ - requires_supervisor_approval                          │
│ - is_required                                           │
│ - created_by (FK)                                       │
│ - created_at                                            │
│ - updated_at                                            │
│ - deleted_at                                            │
└───────────────────────────┬─────────────────────────────┘
                            │ 1
                            │
                            │ N (informational only)
┌───────────────────────────┴─────────────────────────────┐
│               task_template_items                        │
│ - id (PK)                                               │
│ - template_id (FK)                                      │
│ - task_description (COPY of definition)                │
│ - source_definition_id (optional reference)             │
│ - ... (other copied fields)                             │
└─────────────────────────────────────────────────────────┘
```

### State Transitions

```
[ACTIVE]
   ↓
   └─ deleted_at SET → [SOFT DELETED]
                           ↓
                           └─ deleted_at CLEAR → [ACTIVE]
```

**States**:
- **ACTIVE**: `deleted_at IS NULL` - visible in UI, usable in templates
- **SOFT DELETED**: `deleted_at IS NOT NULL` - hidden from UI, recoverable by admin

### Validation Rules

#### Name (FR-011)
- **Required**: YES
- **Min Length**: 1 character (after trimming)
- **Max Length**: 255 characters
- **Validation**: Non-empty after whitespace trim

#### Description (FR-012)
- **Required**: YES
- **Min Length**: 1 character
- **Max Length**: 2,000 characters
- **Validation**: Non-empty

#### Acceptance Criteria (FR-013)
- **Required**: NO
- **Min Length**: 0 (can be empty/null)
- **Max Length**: 2,000 characters
- **Validation**: NULL or within length limit

#### Boolean Flags (FR-014, FR-015, FR-016)
- **Type**: NOT NULL BOOLEAN
- **Defaults**:
  - `requires_photo_verification`: false
  - `requires_supervisor_approval`: false
  - `is_required`: true
- **Validation**: Must be true or false (no null)

### Indexes Rationale

1. **idx_task_definitions_tenant**:
   - Supports: List all definitions for a tenant
   - Excludes: Soft-deleted records
   - Performance: < 50ms for 500 definitions

2. **idx_task_definitions_tenant_name**:
   - Supports: Alphabetical sorting, name-based search
   - Excludes: Soft-deleted records
   - Performance: < 20ms for lookups

3. **idx_task_definitions_created_by**:
   - Supports: "My definitions" filtering
   - Excludes: Soft-deleted records
   - Performance: < 30ms for user-specific queries

### RLS Policy Details

**Policy Name**: `tenant_isolation_task_definitions`
**Operations**: ALL (SELECT, INSERT, UPDATE, DELETE)
**Logic**:
```sql
tenant_id::text = (
  current_setting('request.jwt.claims', true)::json
  -> 'app_metadata' ->> 'tenant_id'
)
```

**Why This Works**:
- Supabase Auth stores tenant_id in JWT's `app_metadata` object
- RLS policy extracts tenant_id from authenticated user's JWT
- Only rows matching user's tenant_id are accessible
- No application-level tenant filtering needed (database enforces)

**Testing RLS**:
```sql
-- Set JWT claims for testing
SET request.jwt.claims = '{"app_metadata":{"tenant_id":"tenant-a-uuid"}}';

-- This query only returns tenant A's definitions
SELECT * FROM task_definitions;
```

---

## TypeScript Types

### Generated Types (from Supabase)

```typescript
export type TaskDefinition = Database['public']['Tables']['task_definitions']['Row'];
export type TaskDefinitionInsert = Database['public']['Tables']['task_definitions']['Insert'];
export type TaskDefinitionUpdate = Database['public']['Tables']['task_definitions']['Update'];
```

### Domain Types

```typescript
// src/domains/task-definition/types/task-definition-types.ts

export interface TaskDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  acceptance_criteria: string | null;
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  is_required: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateTaskDefinitionInput {
  name: string;
  description: string;
  acceptance_criteria?: string | null;
  requires_photo_verification?: boolean;
  requires_supervisor_approval?: boolean;
  is_required?: boolean;
}

export interface UpdateTaskDefinitionInput {
  name?: string;
  description?: string;
  acceptance_criteria?: string | null;
  requires_photo_verification?: boolean;
  requires_supervisor_approval?: boolean;
  is_required?: boolean;
}

export interface TaskDefinitionUsage {
  templateCount: number;
  templateIds: string[];
  templateNames: string[];
}

export type TaskDefinitionWithUsage = TaskDefinition & {
  usage: TaskDefinitionUsage;
};
```

### Zod Schemas

```typescript
// src/domains/task-definition/schemas/task-definition-schemas.ts
import { z } from 'zod';

export const CreateTaskDefinitionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').trim(),
  description: z.string().min(1, 'Description is required').max(2000, 'Description must be 2000 characters or less'),
  acceptance_criteria: z.string().max(2000, 'Acceptance criteria must be 2000 characters or less').nullable().optional(),
  requires_photo_verification: z.boolean().default(false),
  requires_supervisor_approval: z.boolean().default(false),
  is_required: z.boolean().default(true),
});

export const UpdateTaskDefinitionSchema = CreateTaskDefinitionSchema.partial();

export type CreateTaskDefinitionInput = z.infer<typeof CreateTaskDefinitionSchema>;
export type UpdateTaskDefinitionInput = z.infer<typeof UpdateTaskDefinitionSchema>;
```

---

## Migration Checklist

Before applying migration:
- [ ] Run `scripts/check-actual-db.ts` to verify current schema
- [ ] Verify tenants table exists
- [ ] Verify auth.users table exists
- [ ] Verify `update_updated_at_column()` function exists
- [ ] Test RLS policy with different tenant JWTs
- [ ] Confirm indexes created successfully
- [ ] Run `npm run generate:types` after migration
- [ ] Verify generated types in `src/types/database.ts`

After migration:
- [ ] Insert test data for development
- [ ] Verify RLS isolation between tenants
- [ ] Test soft delete behavior
- [ ] Verify trigger updates `updated_at` on UPDATE
- [ ] Check index usage with EXPLAIN ANALYZE

---

**Data Model Complete**: 2025-10-19
**Ready for**: Contract generation and implementation
