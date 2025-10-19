# Quickstart: Task Lists Implementation

**Feature**: 011-making-task-lists
**For**: Developers implementing this feature
**Last Updated**: 2025-10-18

## Prerequisites

Before starting implementation:
- [x] Phase 0: Research complete (research.md reviewed)
- [x] Phase 1: Design complete (data-model.md, contracts/ reviewed)
- [ ] Local Supabase instance running OR access to dev Supabase project
- [ ] Node.js 20+, npm 10+ installed
- [ ] `.env.local` configured with Supabase credentials

---

## Step 1: Database Migration

### 1.1 Execute Schema Changes

Run the migration script to enhance workflow_tasks and create new tables:

```bash
# From repository root
npm run db:check:actual  # Verify current schema
tsx scripts/migrations/enhance-workflow-tasks.ts
npm run generate:types  # Regenerate Supabase types
```

The migration will:
1. Fix workflow_tasks RLS policy (use JWT app_metadata path)
2. Add is_required, is_deleted, template_id columns to workflow_tasks
3. Create task_templates table
4. Create task_template_items table
5. Create indexes for performance
6. Apply RLS policies to new tables

### 1.2 Verify Migration

```bash
npm run db:check:actual  # Should show new columns/tables
npm run test:rls  # Verify RLS policies work correctly
```

Expected output:
- workflow_tasks has 24 columns (was 21)
- task_templates table exists with 9 columns
- task_template_items table exists with 9 columns
- All RLS policies use correct JWT path

---

## Step 2: Repository Layer

### 2.1 WorkflowTaskRepository

Already exists at `src/domains/workflow-task/WorkflowTaskRepository.ts`. Enhance with new methods:

```typescript
// Add these methods to existing repository
export class WorkflowTaskRepository {
  // ... existing methods ...

  async findIncompleteRequired(jobId: string): Promise<Result<WorkflowTask[], RepositoryError>> {
    const { data, error } = await this.client
      .from('workflow_tasks')
      .select('*')
      .eq('job_id', jobId)
      .eq('is_deleted', false)
      .eq('is_required', true)
      .not('status', 'in', '(complete,skipped)');

    if (error) return Err({ code: 'QUERY_FAILED', message: error.message });
    return Ok(data);
  }

  async softDelete(id: string): Promise<Result<void, RepositoryError>> {
    const { error } = await this.client
      .from('workflow_tasks')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return Err({ code: 'UPDATE_FAILED', message: error.message });
    return Ok(undefined);
  }

  async createFromTemplate(
    jobId: string,
    templateItems: TaskTemplateItem[]
  ): Promise<Result<WorkflowTask[], RepositoryError>> {
    const tasks = templateItems.map(item => ({
      job_id: jobId,
      task_description: item.task_description,
      task_order: item.task_order,
      is_required: item.is_required,
      template_id: item.template_id,
      status: 'pending' as const,
      // ... other fields from item
    }));

    const { data, error } = await this.client
      .from('workflow_tasks')
      .insert(tasks)
      .select();

    if (error) return Err({ code: 'INSERT_FAILED', message: error.message });
    return Ok(data);
  }
}
```

### 2.2 TaskTemplateRepository (NEW)

Create `src/domains/task-template/TaskTemplateRepository.ts`:

```typescript
/**
 * @file /src/domains/task-template/TaskTemplateRepository.ts
 * @phase 1
 * @domain task-template
 * @purpose Repository for task_templates table with type-safe CRUD operations
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Result, Ok, Err } from '@/lib/result';
import { Database } from '@/types/supabase';

type TaskTemplate = Database['public']['Tables']['task_templates']['Row'];
type TaskTemplateItem = Database['public']['Tables']['task_template_items']['Row'];

export class TaskTemplateRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async findAll(includeInactive = false): Promise<Result<TaskTemplate[], RepositoryError>> {
    let query = this.client.from('task_templates').select('*');
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('name');
    if (error) return Err({ code: 'QUERY_FAILED', message: error.message });
    return Ok(data);
  }

  async findByIdWithItems(id: string): Promise<Result<TemplateWithItems, RepositoryError>> {
    const { data: template, error: templateError } = await this.client
      .from('task_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (templateError) return Err({ code: 'NOT_FOUND', message: templateError.message });

    const { data: items, error: itemsError } = await this.client
      .from('task_template_items')
      .select('*')
      .eq('template_id', id)
      .order('task_order');

    if (itemsError) return Err({ code: 'QUERY_FAILED', message: itemsError.message });

    return Ok({ ...template, items });
  }

  async create(
    template: CreateTemplateInput,
    items: CreateTemplateItemInput[]
  ): Promise<Result<TemplateWithItems, RepositoryError>> {
    // Insert template
    const { data: newTemplate, error: templateError } = await this.client
      .from('task_templates')
      .insert(template)
      .select()
      .single();

    if (templateError) return Err({ code: 'INSERT_FAILED', message: templateError.message });

    // Insert items
    const itemsWithTemplateId = items.map(item => ({
      ...item,
      template_id: newTemplate.id,
    }));

    const { data: newItems, error: itemsError } = await this.client
      .from('task_template_items')
      .insert(itemsWithTemplateId)
      .select();

    if (itemsError) return Err({ code: 'INSERT_FAILED', message: itemsError.message });

    return Ok({ ...newTemplate, items: newItems });
  }

  // ... other methods: update, delete, etc.
}
```

---

## Step 3: API Routes

### 3.1 Task CRUD API

Create `src/app/api/jobs/[id]/tasks/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { WorkflowTaskRepository } from '@/domains/workflow-task/WorkflowTaskRepository';
import { CreateTaskSchema } from '@/domains/workflow-task/schemas';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const repo = new WorkflowTaskRepository(supabase);

  const result = await repo.findByJobId(params.id);

  if (result.isErr()) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: result.value });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const repo = new WorkflowTaskRepository(supabase);

  const body = await request.json();
  const validation = CreateTaskSchema.safeParse({ ...body, jobId: params.id });

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid task data',
          details: validation.error.errors,
        },
      },
      { status: 400 }
    );
  }

  const result = await repo.create(validation.data);

  if (result.isErr()) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { success: true, data: result.value },
    { status: 201 }
  );
}
```

### 3.2 Template API

Create `src/app/api/task-templates/route.ts` following similar pattern.

---

## Step 4: Voice Command Handlers

Create `src/lib/voice/taskCommands.ts`:

```typescript
/**
 * @file /src/lib/voice/taskCommands.ts
 * @phase 1
 * @domain voice
 * @purpose Voice command handlers for task operations
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

import { VoiceCommand, VoiceResponse } from './types';
import { WorkflowTaskRepository } from '@/domains/workflow-task/WorkflowTaskRepository';

export const taskVoiceCommands: VoiceCommand[] = [
  {
    pattern: /show (job |)tasks/i,
    intent: 'list_tasks',
    handler: async ({ jobId, client }) => {
      const repo = new WorkflowTaskRepository(client);
      const result = await repo.findByJobId(jobId);

      if (result.isErr() || result.value.length === 0) {
        return {
          text: 'You have no tasks for this job.',
          audio: await generateSpeech('You have no tasks for this job.'),
        };
      }

      const tasks = result.value;
      const text = `You have ${tasks.length} tasks. ${tasks
        .map((t, i) => `Task ${i + 1}: ${t.task_description}`)
        .join('. ')}`;

      return {
        text,
        audio: await generateSpeech(text),
      };
    },
  },

  {
    pattern: /mark task (\d+) complete/i,
    intent: 'complete_task',
    handler: async ({ match, jobId, client }) => {
      const taskNumber = parseInt(match[1]);
      const repo = new WorkflowTaskRepository(client);

      const tasksResult = await repo.findByJobId(jobId);
      if (tasksResult.isErr()) {
        return { text: 'Error loading tasks', audio: await generateSpeech('Error loading tasks') };
      }

      const task = tasksResult.value[taskNumber - 1];
      if (!task) {
        return {
          text: `Task ${taskNumber} not found.`,
          audio: await generateSpeech(`Task ${taskNumber} not found.`),
        };
      }

      const updateResult = await repo.update(task.id, {
        status: 'complete',
        completed_at: new Date(),
      });

      if (updateResult.isErr()) {
        return {
          text: 'Error marking task complete',
          audio: await generateSpeech('Error marking task complete'),
        };
      }

      return {
        text: `Task ${taskNumber} marked complete.`,
        audio: await generateSpeech(`Task ${taskNumber} marked complete.`),
      };
    },
  },

  // Add handlers for: "Next task", "Add task", "Skip task", etc.
];
```

---

## Step 5: Testing

### 5.1 Repository Tests

Create `tests/integration/workflow-task/taskRepo.int.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { WorkflowTaskRepository } from '@/domains/workflow-task/WorkflowTaskRepository';

describe('WorkflowTaskRepository', () => {
  let repo: WorkflowTaskRepository;
  let testJobId: string;

  beforeEach(async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    repo = new WorkflowTaskRepository(client);

    // Create test job with test tenant
    // ...
  });

  it('should find incomplete required tasks', async () => {
    // Create required task with status='pending'
    // Create optional task with status='pending'
    // Create required task with status='complete'

    const result = await repo.findIncompleteRequired(testJobId);

    expect(result.isOk()).toBe(true);
    expect(result.value).toHaveLength(1);  // Only 1 incomplete required
    expect(result.value[0].is_required).toBe(true);
    expect(result.value[0].status).toBe('pending');
  });

  it('should enforce RLS for tenant isolation', async () => {
    // Test with user from different tenant
    // Expect query to return empty or error
  });
});
```

### 5.2 API Tests

Create `tests/api/tasks.api.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';

describe('POST /api/jobs/:id/tasks', () => {
  it('should create a task with valid data', async () => {
    const response = await fetch(`http://localhost:3000/api/jobs/${jobId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testJWT}`,
      },
      body: JSON.stringify({
        taskDescription: 'Test task',
        taskOrder: 0,
        isRequired: true,
      }),
    });

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.task_description).toBe('Test task');
  });

  it('should return 400 for invalid task data', async () => {
    const response = await fetch(`http://localhost:3000/api/jobs/${jobId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testJWT}`,
      },
      body: JSON.stringify({
        taskDescription: '',  // Invalid: empty string
        taskOrder: -1,  // Invalid: negative order
      }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### 5.3 E2E Voice Tests

Create `tests/e2e/task-voice-commands.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('voice command: list tasks', async ({ page }) => {
  await page.goto(`/jobs/${testJobId}`);

  // Simulate voice command
  await page.evaluate(() => {
    window.voiceCommandParser.execute('show job tasks');
  });

  // Wait for audio response
  await page.waitForSelector('[data-testid="voice-response"]');

  const response = await page.textContent('[data-testid="voice-response"]');
  expect(response).toContain('You have');
  expect(response).toContain('tasks');
});
```

---

## Step 6: Update Agent Context

Run the agent context update script:

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This will update `CLAUDE.md` with:
- New task-related domains (workflow-task, task-template)
- New API routes (/api/jobs/:id/tasks, /api/task-templates)
- Voice command patterns
- Recent changes summary

---

## Step 7: Validation Checklist

Before marking feature complete, verify:

- [ ] **Database**:
  - [ ] workflow_tasks has is_required, is_deleted, template_id columns
  - [ ] task_templates and task_template_items tables exist
  - [ ] RLS policies use correct JWT app_metadata path
  - [ ] Indexes created (job_order, required)

- [ ] **Repository**:
  - [ ] WorkflowTaskRepository has findIncompleteRequired, softDelete, createFromTemplate methods
  - [ ] TaskTemplateRepository implements full CRUD
  - [ ] All methods return Result<T, RepositoryError>

- [ ] **API**:
  - [ ] GET /api/jobs/:id/tasks returns tasks list
  - [ ] POST /api/jobs/:id/tasks creates task with validation
  - [ ] PATCH /api/jobs/:id/tasks/:taskId updates task
  - [ ] DELETE /api/jobs/:id/tasks/:taskId soft-deletes
  - [ ] GET /api/task-templates lists templates
  - [ ] POST /api/task-templates creates template with items
  - [ ] POST /api/task-templates/:id/instantiate creates tasks from template

- [ ] **Voice**:
  - [ ] "Show job tasks" lists tasks
  - [ ] "Mark task N complete" completes task
  - [ ] "Next task" / "Previous task" navigates
  - [ ] "Add task: [desc]" creates task
  - [ ] All commands respond within 2 seconds

- [ ] **Testing**:
  - [ ] ≥80% code coverage
  - [ ] RLS isolation tests pass
  - [ ] API contract tests pass
  - [ ] E2E voice command tests pass

- [ ] **Performance**:
  - [ ] Task list query < 200ms
  - [ ] Job completion validation < 300ms
  - [ ] Voice response < 2 seconds
  - [ ] VLM verification < 5 seconds

---

## Troubleshooting

### RLS Policy Not Working

```bash
# Check current policy
npm run db:check:actual

# Verify JWT structure
# In browser console:
console.log(JSON.parse(atob(jwt.split('.')[1])))
# Should have: app_metadata.tenant_id

# Re-apply RLS fix
tsx scripts/migrations/fix-workflow-tasks-rls.ts
```

### Type Generation Errors

```bash
# Regenerate types after schema changes
npm run generate:types

# If errors persist, check supabase connection
npx supabase status
```

### Voice Commands Not Responding

```bash
# Check voice command registration
# In browser console:
window.voiceCommandParser.listCommands()

# Verify voice infrastructure loaded
npm run test:e2e -- --grep "voice"
```

---

**Quickstart Complete**: 2025-10-18
**Next**: Proceed to /tasks command to generate task list
