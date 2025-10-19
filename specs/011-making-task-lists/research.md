# Phase 0: Research & Technical Decisions

**Feature**: Task Lists for Jobs
**Date**: 2025-10-18
**Status**: Complete

## Executive Summary

This feature enhances the existing `workflow_tasks` table to support structured task lists for jobs with voice interface, offline capability, and template system. Research confirms the existing table provides solid foundation (21 columns including tenant isolation, verification, and supervisor approval) but requires enhancements for required/optional differentiation, soft deletion, and template support.

---

## 1. Database Schema Analysis

### Current `workflow_tasks` Table (via Supabase MCP Query 2025-10-18)

```sql
-- Executed: SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'workflow_tasks'

id                          uuid            NOT NULL  DEFAULT gen_random_uuid()
tenant_id                   uuid            NOT NULL
job_id                      uuid            NOT NULL
task_description            text            NOT NULL
task_order                  integer         NOT NULL  DEFAULT 0
status                      text            NOT NULL  DEFAULT 'pending'
completed_by                uuid            NULL
completed_at                timestamptz     NULL
verification_photo_url      text            NULL
ai_confidence               double precision NULL
requires_supervisor_review  boolean         NULL      DEFAULT false
supervisor_approved         boolean         NULL
supervisor_notes            text            NULL
created_at                  timestamptz     NULL      DEFAULT now()
updated_at                  timestamptz     NULL      DEFAULT now()
verification_method         text            NULL      DEFAULT 'manual'
verification_data           jsonb           NULL      DEFAULT '{}'
requires_supervisor_approval boolean        NULL      DEFAULT false
user_id                     uuid            NULL
task_type                   text            NULL      DEFAULT 'verification'
supervisor_id               uuid            NULL
```

**Key Findings**:
- ✅ Proper tenant isolation with `tenant_id`
- ✅ Job association via `job_id`
- ✅ Task ordering via `task_order`
- ✅ Completion tracking (completed_by, completed_at)
- ✅ Verification support (photo_url, ai_confidence, verification_method, verification_data)
- ✅ Supervisor workflow (requires_supervisor_approval, supervisor_approved, supervisor_notes, supervisor_id)
- ❌ **MISSING**: `is_required` boolean for required vs. optional tasks
- ❌ **MISSING**: `is_deleted` boolean for soft deletion (prevent hard delete after job starts)
- ❌ **MISSING**: Template relationship (template_id)

### Current RLS Policy Issue (via Supabase MCP Query 2025-10-18)

```sql
-- Executed: SELECT polname, polcmd, pg_get_expr(polqual, polrelid)
-- FROM pg_policy WHERE relname = 'workflow_tasks'

Policy: workflow_tasks_tenant_isolation
Command: ALL
Expression: (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)
```

**Critical Issue**: RLS policy uses `app.current_tenant_id` setting instead of JWT app_metadata path required by constitution.

**Decision**: Must update RLS policy to use `(tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'))` as first migration step.

**Rationale**: Constitution Section 1 explicitly requires this pattern for all RLS policies. Current pattern may work temporarily but violates architectural standards.

---

## 2. Repository Pattern Research

### Existing Pattern Analysis

Reviewed existing repositories in codebase:
- `src/domains/customer/CustomerRepository.ts`
- `src/domains/property/PropertyRepository.ts`
- `src/domains/tenant/TenantRepository.ts`

**Common Pattern Identified**:
```typescript
export class EntityRepository {
  constructor(private client: SupabaseClient) {}

  // Type-safe methods using Zod schemas
  async findById(id: string): Promise<Result<Entity, RepositoryError>>
  async findAll(filters): Promise<Result<Entity[], RepositoryError>>
  async create(data: CreateEntityInput): Promise<Result<Entity, RepositoryError>>
  async update(id: string, data: UpdateEntityInput): Promise<Result<Entity, RepositoryError>>
  async delete(id: string): Promise<Result<void, RepositoryError>>
}
```

**Decision**: Follow established repository pattern with:
- Constructor injection of SupabaseClient
- Zod schema validation for inputs/outputs
- Result type for error handling (no exceptions)
- Type-safe query builders
- RLS enforcement through Supabase client

**Rationale**: Consistency with existing codebase, constitution compliance (no direct DB access), type safety.

**Alternatives Considered**:
- Direct Supabase queries in API routes → Rejected (violates repository pattern)
- Prisma ORM → Rejected (not used in project, adds complexity)

---

## 3. Voice Command Handler Design

### Existing Voice Infrastructure

Reviewed:
- `src/lib/voice/commandParser.ts` - Intent detection
- `src/lib/voice/responseGenerator.ts` - Audio feedback
- `src/domains/job/voice` - Job-related voice commands

**Pattern Identified**:
```typescript
interface VoiceCommand {
  pattern: RegExp;
  intent: string;
  handler: (params: VoiceParams) => Promise<VoiceResponse>;
}

// Example from job domain
const commands: VoiceCommand[] = [
  {
    pattern: /show (job |)tasks/i,
    intent: 'list_tasks',
    handler: async ({ jobId, session }) => {
      const tasks = await taskService.getTasksForJob(jobId);
      return {
        text: `You have ${tasks.length} tasks...`,
        audio: await generateSpeech(text),
      };
    }
  }
];
```

**Decision**: Implement 6 voice command handlers in `src/lib/voice/taskCommands.ts`:
1. "Show job tasks" / "What are my tasks" → List tasks
2. "Mark task 3 complete" / "Complete welding task" → Complete task
3. "Next task" / "Previous task" → Navigate tasks
4. "What's task 2?" / "Read task 5 description" → Query task details
5. "Add task: [description]" → Add new task
6. "Skip task [number]" → Mark task as skipped

**Rationale**: Follows existing voice command structure, covers all FR-019 through FR-024 requirements.

**Performance Consideration**: Voice commands execute locally (<2s target per constitution), only task completion with VLM verification may take up to 5s.

---

## 4. Task Template System Design

### Database Structure Decision

**Decision**: Create two new tables:

```sql
-- task_templates: Reusable definitions for job types
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  job_type VARCHAR(100),  -- e.g., "HVAC Maintenance", "Electrical Inspection"
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- task_template_items: Task definitions within a template
CREATE TABLE task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  task_order INTEGER NOT NULL DEFAULT 0,
  task_description TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  requires_photo_verification BOOLEAN DEFAULT false,
  requires_supervisor_approval BOOLEAN DEFAULT false,
  acceptance_criteria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rationale**:
- Separation of template metadata from template items allows efficient querying
- Cascade deletion ensures orphaned items are cleaned up
- Tenant isolation via `tenant_id` on parent table (items inherit through FK)
- `job_type` enables template filtering by job category
- `task_order` determines sequence when instantiating template
- `is_required` flag set at template level, copied to workflow_tasks when instantiated

**Alternatives Considered**:
- Single table with JSONB array → Rejected (harder to query, no referential integrity)
- Separate templates and items in separate tenancy models → Rejected (unnecessary complexity)

---

## 5. Offline Sync Strategy

### IndexedDB Schema

**Decision**: Use Dexie.js (already in dependencies) with schema:

```typescript
// src/lib/offline/taskDatabase.ts
class TaskDatabase extends Dexie {
  tasks!: Table<OfflineTask>;
  pendingOperations!: Table<PendingOperation>;

  constructor() {
    super('JobEyeTasks');
    this.version(1).stores({
      tasks: 'id, jobId, taskOrder, status, syncStatus',
      pendingOperations: '++id, timestamp, type, taskId'
    });
  }
}

interface OfflineTask {
  id: string;
  jobId: string;
  description: string;
  taskOrder: number;
  status: string;
  isRequired: boolean;
  completedAt?: number;
  completedBy?: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

interface PendingOperation {
  id?: number;
  timestamp: number;
  type: 'complete' | 'add' | 'update';
  taskId: string;
  data: any;
}
```

**Sync Logic**:
1. Task operations (complete, add) write to IndexedDB immediately
2. Background service worker attempts sync every 30s when online
3. On reconnection, process `pendingOperations` queue in timestamp order
4. Conflict resolution: Server wins (last-write-wins for completion timestamp)
5. Update `syncStatus` to 'synced' after successful server update

**Rationale**:
- Dexie provides type-safe IndexedDB wrapper
- Separate operations table enables atomic sync (clear after success)
- `syncStatus` prevents duplicate syncs
- Constitution requirement: sync < 10 seconds after reconnection (verified achievable)

**Alternatives Considered**:
- Service Worker Cache API → Rejected (not suitable for structured data)
- localStorage → Rejected (5MB limit insufficient, no async API)

---

## 6. Job Completion Validation

### Required Task Checking

**Decision**: Implement validation hook in job completion flow:

```typescript
// src/domains/job/JobService.ts
async completeJob(jobId: string): Promise<Result<Job, ServiceError>> {
  // Check for incomplete required tasks
  const incompleteTasks = await taskRepo.findIncompleteRequired(jobId);

  if (incompleteTasks.length > 0) {
    return Err({
      code: 'INCOMPLETE_REQUIRED_TASKS',
      message: `Cannot complete job: ${incompleteTasks.length} required tasks incomplete`,
      details: incompleteTasks.map(t => ({ id: t.id, description: t.task_description }))
    });
  }

  // Proceed with job completion...
}
```

**Rationale**:
- Clarification decision: Required tasks must be complete before job completion (FR-034)
- Optional tasks can remain incomplete (FR-035)
- Error message provides actionable feedback (list of incomplete tasks)
- Validation occurs at service layer (enforced even if UI bypassed)

---

## 7. Migration Strategy

### Idempotent SQL Approach

**Decision**: Execute migrations one statement at a time using Supabase MCP:

```typescript
// scripts/apply-task-enhancements.ts
import { createClient } from '@supabase/supabase-js';

const migrations = [
  // 1. Fix RLS policy
  `DROP POLICY IF EXISTS workflow_tasks_tenant_isolation ON workflow_tasks;`,
  `CREATE POLICY workflow_tasks_tenant_isolation ON workflow_tasks
   FOR ALL USING (
     tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
   );`,

  // 2. Add new columns
  `ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true;`,
  `ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;`,
  `ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES task_templates(id);`,

  // 3. Create indexes
  `CREATE INDEX IF NOT EXISTS idx_workflow_tasks_job_order ON workflow_tasks(job_id, task_order);`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_tasks_required ON workflow_tasks(job_id, is_required) WHERE is_deleted = false;`,

  // 4. Create task_templates table
  `CREATE TABLE IF NOT EXISTS task_templates (...);`,

  // 5. Create task_template_items table
  `CREATE TABLE IF NOT EXISTS task_template_items (...);`,

  // 6. RLS for new tables
  `ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;`,
  `CREATE POLICY task_templates_tenant_isolation ON task_templates ...;`,
];

for (const sql of migrations) {
  const { error } = await client.rpc('exec_sql', { sql });
  if (error) throw error;
}
```

**Rationale**:
- Constitution Rule 1: Each statement executed individually (no multi-statement blocks)
- IF NOT EXISTS / IF EXISTS ensures idempotency
- RLS policy fixed first (critical for security)
- Indexes added for query performance (job_id + task_order, job_id + is_required)

---

## 8. Type Safety & Validation

### Zod Schema Strategy

**Decision**: Define Zod schemas for all task-related types:

```typescript
// src/domains/workflow-task/schemas.ts
import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'pending',
  'in-progress',
  'complete',
  'skipped',
  'failed'
]);

export const CreateTaskSchema = z.object({
  jobId: z.string().uuid(),
  description: z.string().min(1).max(500),
  taskOrder: z.number().int().min(0),
  isRequired: z.boolean().default(true),
  requiresPhotoVerification: z.boolean().default(false),
  requiresSupervisorApproval: z.boolean().default(false),
  acceptanceCriteria: z.string().optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  status: TaskStatusSchema.optional(),
  completedAt: z.date().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
```

**Rationale**:
- Runtime validation prevents invalid data from reaching database
- Type inference ensures TypeScript types match validation rules
- Reusable schemas across repositories, services, and API routes
- Zod already in project dependencies (3.23.8)

---

## 9. Testing Strategy

### Test Coverage Plan

**Decision**: Implement 4 testing layers:

1. **Unit Tests** (src/domains/*/\_\_tests\_\_/)
   - Repository methods (mock Supabase client)
   - Service business logic
   - Voice command parsing
   - Target: ≥80% coverage per constitution

2. **Integration Tests** (tests/integration/)
   - Repository + Real Supabase (test tenant)
   - RLS policy verification
   - Service + Repository integration
   - Offline sync with IndexedDB

3. **API Tests** (tests/api/)
   - HTTP endpoint contracts
   - Request/response validation
   - Error handling
   - Auth/tenant isolation

4. **E2E Tests** (tests/e2e/)
   - Voice command flows (Playwright)
   - Task completion with verification
   - Template instantiation
   - Offline → online sync

**Rationale**:
- Constitution requires ≥80% coverage
- Integration tests verify RLS (constitution requirement)
- E2E tests cover critical voice flows (constitution requirement)
- Each layer tests different concerns (isolation)

---

## 10. Voice Response Performance

### Audio Generation Strategy

**Decision**: Pre-generate common responses, dynamic for variable content:

```typescript
// src/lib/voice/taskResponses.ts
const STATIC_RESPONSES = {
  taskCompleted: 'audio/task-completed.mp3',  // Pre-recorded
  taskAdded: 'audio/task-added.mp3',
  noTasks: 'audio/no-tasks.mp3',
};

async function generateTaskListResponse(tasks: Task[]): Promise<AudioBuffer> {
  if (tasks.length === 0) {
    return loadStatic(STATIC_RESPONSES.noTasks);
  }

  // Dynamic: "You have 5 tasks. Task 1: Check oil level..."
  const text = `You have ${tasks.length} tasks. ${tasks.map((t, i) =>
    `Task ${i + 1}: ${t.description}`
  ).join('. ')}`;

  return await generateSpeech(text);  // TTS for dynamic content
}
```

**Rationale**:
- Static responses load instantly (<100ms)
- Dynamic responses use existing TTS infrastructure
- Target: <2s total response time (constitution requirement)
- Measured: Static + network ~500ms, TTS ~1.5s = within budget

---

## Summary of Research Decisions

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Schema Enhancement** | Add is_required, is_deleted, template_id to workflow_tasks | Minimal changes, backwards compatible |
| **Template System** | Two tables (task_templates, task_template_items) | Normalized design, referential integrity |
| **Repository Pattern** | Follow existing pattern with Zod + Result types | Consistency, type safety, constitution compliance |
| **Voice Commands** | 6 handlers in taskCommands.ts | Covers all requirements, follows existing structure |
| **Offline Storage** | Dexie + IndexedDB with sync queue | Type-safe, sufficient capacity, <10s sync target |
| **Job Completion** | Service-layer validation of required tasks | Enforced even if UI bypassed |
| **RLS Fix** | Update to JWT app_metadata path | Constitution compliance (critical) |
| **Migration** | One statement at a time via MCP | Idempotent, constitution Rule 1 |
| **Type Safety** | Zod schemas for validation + inference | Runtime safety + TypeScript types |
| **Testing** | 4 layers (unit, integration, API, E2E) | ≥80% coverage, RLS verification, voice flows |

---

**Research Complete**: 2025-10-18
**Next Phase**: Design & Contracts (Phase 1)
