# Research: Task Management for Reusable Task Library

**Feature**: 014-add-task-management
**Date**: 2025-10-19
**Status**: Complete

## Research Objectives

1. Understand existing domain patterns in task-template and workflow-task
2. Determine database schema requirements for task_definitions table
3. Define integration strategy with Task Templates
4. Establish deletion strategy (soft vs hard delete)
5. Identify UI component reuse opportunities
6. Plan testing strategy

---

## Finding 1: Existing Domain Patterns

### Research Question
How are task-template and workflow-task domains structured, and should we follow the same patterns?

### Investigation
Examined existing code structure:
- `src/domains/task-template/`
- `src/domains/workflow-task/`
- API routes in `src/app/api/`
- Component patterns in `src/components/`

### Decision
**Follow task-template and workflow-task domain patterns**

### Rationale
- **Consistency**: Reduces cognitive load for developers
- **Proven**: Patterns already tested and working in production
- **Type Safety**: Result<T, E> pattern already established
- **Integration**: Clear boundaries between layers already defined

### Key Patterns Identified

#### Repository Pattern
```typescript
export class TaskTemplateRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async findAll(): Promise<Result<TaskTemplate[], RepositoryError>> {
    const { data, error } = await this.client
      .from('task_templates')
      .select('*')
      .eq('is_active', true);

    if (error) return Err({ code: 'QUERY_FAILED', message: error.message });
    return Ok(data);
  }

  async create(input: CreateInput): Promise<Result<TaskTemplate, RepositoryError>> {
    const { data, error } = await this.client
      .from('task_templates')
      .insert(input)
      .select()
      .single();

    if (error) return Err({ code: 'INSERT_FAILED', message: error.message });
    return Ok(data);
  }
}
```

#### Service Pattern
```typescript
export class TaskTemplateService {
  constructor(
    private templateRepo: TaskTemplateRepository,
    private taskRepo: WorkflowTaskRepository
  ) {}

  async createTemplate(input: CreateTemplateInput): Promise<Result<TemplateWithItems, ServiceError>> {
    // Business logic validation
    if (!input.name || input.name.length > 255) {
      return Err({ code: 'INVALID_INPUT', message: 'Name required, max 255 chars' });
    }

    // Repository calls
    const result = await this.templateRepo.create(input);
    if (isErr(result)) {
      return Err({ code: 'CREATION_FAILED', message: result.error.message });
    }

    return Ok(result.value);
  }
}
```

#### API Route Pattern
```typescript
export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    if (!context.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const repo = new TaskTemplateRepository(supabase);
    const result = await repo.findAll();

    if (isErr(result)) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.value });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Alternatives Considered
- **Create new patterns**: Rejected - reinvents wheel, inconsistent with codebase
- **Simplify to direct Supabase calls**: Rejected - violates constitutional requirement for Repository pattern

---

## Finding 2: Database Schema Requirements

### Research Question
What database schema design best supports reusable task definitions with tenant isolation?

### Investigation
- Examined existing tables: `task_templates`, `task_template_items`, `workflow_tasks`
- Reviewed JobEye Constitution requirements for RLS
- Analyzed functional requirements (FR-011 through FR-038)

### Decision
**Create new `task_definitions` table with full tenant isolation**

### Rationale
- **Clear Separation**: Distinct from task_templates (groups) and workflow_tasks (instances)
- **Tenant Isolation**: Follows constitutional requirement for multi-tenancy
- **Audit Trail**: Tracks who created/modified each definition
- **RLS Enforcement**: Database-level security via policies

### Schema Design

```sql
CREATE TABLE IF NOT EXISTS task_definitions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (constitutional requirement)
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Core fields (from spec requirements FR-011, FR-012, FR-013)
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) <= 2000),
  acceptance_criteria TEXT CHECK (acceptance_criteria IS NULL OR char_length(acceptance_criteria) <= 2000),

  -- Configuration flags (FR-014, FR-015, FR-016)
  requires_photo_verification BOOLEAN NOT NULL DEFAULT false,
  requires_supervisor_approval BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT true,

  -- Audit fields (FR-038)
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete support
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_definitions_tenant
  ON task_definitions(tenant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_definitions_name
  ON task_definitions(tenant_id, name) WHERE deleted_at IS NULL;

-- RLS policies (using correct JWT path from constitution)
ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_task_definitions" ON task_definitions
  FOR ALL USING (
    tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata' ->> 'tenant_id'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_task_definitions_updated_at
  BEFORE UPDATE ON task_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Character Length Constraints
- **name**: 255 characters (standard VARCHAR limit)
- **description**: 2,000 characters (allows detailed instructions)
- **acceptance_criteria**: 2,000 characters (optional, detailed success criteria)

Rationale for limits:
- Fits typical field service task descriptions
- Prevents database bloat from excessively long text
- Aligns with UX constraints (textarea limits)

### Alternatives Considered
- **Combine with task_templates**: Rejected - conflates two different concepts
- **Store as JSON in existing table**: Rejected - loses type safety and query performance
- **Separate tables for flags**: Rejected - over-normalization, unnecessary complexity

---

## Finding 3: Integration with Task Templates

### Research Question
When a task definition is used in a template, should it be referenced or copied?

### Investigation
- Reviewed spec requirements FR-029 through FR-032
- Analyzed impact on workflow task instances
- Considered template versioning and stability

### Decision
**Templates copy task definitions (snapshot approach), not reference them**

### Rationale
- **Snapshot Integrity**: Prevents retroactive changes to existing jobs
- **Template Independence**: Task template evolution not tied to definition changes
- **Workflow Stability**: Tasks in active jobs don't change unexpectedly
- **Spec Alignment**: Explicitly required by FR-031 and FR-032

### Implementation Strategy

#### When Adding Definition to Template
```typescript
// TaskTemplateService.addTaskFromDefinition()
async addTaskFromDefinition(
  templateId: string,
  definitionId: string,
  taskOrder: number
): Promise<Result<TaskTemplateItem, ServiceError>> {
  // 1. Fetch task definition
  const defResult = await this.definitionRepo.findById(definitionId);
  if (isErr(defResult)) {
    return Err({ code: 'DEFINITION_NOT_FOUND', message: 'Task definition not found' });
  }
  const definition = defResult.value;

  // 2. Copy fields into template_items (SNAPSHOT)
  const templateItem = {
    template_id: templateId,
    task_order: taskOrder,
    task_description: definition.description,
    acceptance_criteria: definition.acceptance_criteria,
    requires_photo_verification: definition.requires_photo_verification,
    requires_supervisor_approval: definition.requires_supervisor_approval,
    is_required: definition.is_required,
    source_definition_id: definition.id, // Optional reference for traceability
  };

  // 3. Insert into task_template_items
  const result = await this.templateRepo.addItem(templateItem);
  return result;
}
```

#### Schema Update for task_template_items
```sql
ALTER TABLE task_template_items
  ADD COLUMN IF NOT EXISTS source_definition_id UUID REFERENCES task_definitions(id);

COMMENT ON COLUMN task_template_items.source_definition_id IS
  'Optional reference to original task definition (informational only, not a constraint)';
```

### Data Flow

```
Task Definition (Library)
    ↓ (copy on add)
Task Template Item (Snapshot)
    ↓ (copy on job creation)
Workflow Task (Instance)
```

Each level is independent after creation.

### Alternatives Considered
- **Reference with FK**: Rejected - violates snapshot requirement (FR-031)
- **Cascading updates**: Rejected - breaks stability of active jobs
- **Versioned definitions**: Rejected - adds unnecessary complexity for v1

---

## Finding 4: Deletion Strategy

### Research Question
Should task definitions be hard-deleted or soft-deleted, and how do we prevent breaking templates?

### Investigation
- Reviewed FR-025 through FR-028 (deletion requirements)
- Analyzed template usage scenarios
- Considered data recovery needs

### Decision
**Soft delete with usage check and warning**

### Rationale
- **Safety**: Prevents accidental permanent data loss
- **Recovery**: Allows undelete if mistake detected
- **Template Protection**: Usage check prevents breaking active templates
- **Compliance**: Audit trail preserved for compliance requirements

### Implementation

```typescript
// TaskDefinitionService.delete()
async delete(id: string, userId: string): Promise<Result<void, ServiceError>> {
  // 1. Check if definition is in use
  const usageResult = await this.checkUsage(id);
  if (isErr(usageResult)) {
    return Err({ code: 'CHECK_FAILED', message: usageResult.error.message });
  }

  const usage = usageResult.value;
  if (usage.templateCount > 0) {
    return Err({
      code: 'IN_USE',
      message: `Task definition is used in ${usage.templateCount} template(s)`,
      details: {
        templateIds: usage.templateIds,
        templateNames: usage.templateNames,
      }
    });
  }

  // 2. Soft delete (set deleted_at timestamp)
  const result = await this.definitionRepo.softDelete(id, userId);
  if (isErr(result)) {
    return Err({ code: 'DELETE_FAILED', message: result.error.message });
  }

  return Ok(void 0);
}

async checkUsage(definitionId: string): Promise<Result<UsageReport, ServiceError>> {
  const { data, error } = await this.client
    .from('task_template_items')
    .select('template_id, task_templates(id, name)')
    .eq('source_definition_id', definitionId);

  if (error) {
    return Err({ code: 'QUERY_FAILED', message: error.message });
  }

  return Ok({
    templateCount: data.length,
    templateIds: data.map(item => item.template_id),
    templateNames: data.map(item => item.task_templates?.name || 'Unknown'),
  });
}
```

### UI Behavior

**When deleting unused definition**:
- Show confirmation: "Delete task definition '[name]'?"
- Action: Soft delete (set deleted_at)
- Result: Removed from list, can be recovered from admin panel

**When deleting in-use definition**:
- Show error: "Cannot delete. This task definition is used in [N] templates:"
  - Template A
  - Template B
- Options:
  1. "Cancel" - abort deletion
  2. "View Templates" - navigate to template list filtered by this definition

### Alternatives Considered
- **Hard delete only**: Rejected - risky, no recovery path
- **Always allow deletion**: Rejected - breaks templates unexpectedly
- **Cascading delete**: Rejected - destroys template data

---

## Finding 5: UI Component Reuse

### Research Question
Can we reuse existing TaskTemplate UI components for TaskDefinition management?

### Investigation
- Examined `src/components/tasks/` and task template pages
- Compared form fields required for definitions vs templates
- Analyzed list/detail view patterns

### Decision
**Adapt existing TaskTemplate components with minimal changes**

### Rationale
- **Similar Operations**: Both need CRUD (create, list, edit, delete)
- **Similar Fields**: Text, textarea, boolean toggles are common
- **Consistent UX**: Users familiar with template management can use definition management
- **Faster Development**: Proven components reduce implementation time

### Component Mapping

| Task Template Component | Task Definition Component | Changes Required |
|------------------------|---------------------------|------------------|
| `TaskTemplateList` | `TaskDefinitionList` | Remove "job_type" column, add flags display |
| `TaskTemplateCard` | `TaskDefinitionCard` | Simplify to show name, description excerpt, flags |
| `TaskTemplateForm` | `TaskDefinitionForm` | Remove template items editor, keep flags |
| `TemplateDetailPage` | `TaskDefinitionDetailPage` | Simplify to single entity (no items list) |

### Shared UI Patterns

```tsx
// Reusable form structure
<form onSubmit={handleSubmit}>
  <Input label="Name" required maxLength={255} />
  <Textarea label="Description" required maxLength={2000} />
  <Textarea label="Acceptance Criteria" optional maxLength={2000} />

  <div className="flags-section">
    <Checkbox label="Requires photo verification" />
    <Checkbox label="Requires supervisor approval" />
    <Checkbox label="Required (vs optional)" defaultChecked />
  </div>

  <div className="actions">
    <Button type="submit">Save</Button>
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
  </div>
</form>
```

### Alternatives Considered
- **Build from scratch**: Rejected - duplicates effort, inconsistent UX
- **Generic CRUD generator**: Rejected - over-engineering for specific domain
- **Share single component**: Rejected - templates and definitions have different enough needs

---

## Finding 6: Testing Strategy

### Research Question
What testing approach ensures ≥80% coverage while verifying RLS isolation and constitutional compliance?

### Investigation
- Reviewed existing test patterns in `tests/unit/`, `tests/integration/`, `tests/api/`
- Analyzed constitutional testing requirements
- Identified critical user flows from spec

### Decision
**Three-tier testing: Unit (logic) → Integration (RLS) → Contract (API) → E2E (flows)**

### Rationale
- **Unit Tests**: Fast feedback on business logic
- **Integration Tests**: Verify RLS policies and tenant isolation
- **Contract Tests**: Ensure API schema stability
- **E2E Tests**: Validate critical user workflows

### Test Structure

#### Unit Tests (≥80% coverage)
```
tests/unit/task-definition/
├── TaskDefinitionRepository.test.ts
│   ├── findAll() - returns all active definitions
│   ├── findById() - returns single definition or not found
│   ├── create() - inserts with validation
│   ├── update() - modifies existing definition
│   └── softDelete() - sets deleted_at
│
└── TaskDefinitionService.test.ts
    ├── createDefinition() - validates input, calls repo
    ├── checkUsage() - counts template references
    ├── delete() - prevents deletion if in use
    └── addToTemplate() - copies definition to template
```

#### Integration Tests (RLS verification)
```
tests/integration/task-definitions/
├── crud.int.test.ts
│   ├── Create, read, update, delete full flow
│   ├── Verify created_by and timestamps
│   └── Soft delete leaves data intact
│
└── tenant-isolation.int.test.ts
    ├── Tenant A creates definition
    ├── Tenant B cannot see Tenant A's definition
    ├── RLS policy blocks cross-tenant queries
    └── Service-level tenant_id validation
```

#### Contract Tests (API schema)
```
tests/api/task-definitions/
└── api.contract.test.ts
    ├── GET /api/task-definitions returns array
    ├── POST /api/task-definitions validates input
    ├── GET /api/task-definitions/:id returns object
    ├── PATCH /api/task-definitions/:id updates fields
    ├── DELETE /api/task-definitions/:id soft-deletes
    └── Response schemas match OpenAPI spec
```

#### E2E Tests (User workflows)
```
tests/e2e/task-definitions/
└── task-definition-management.spec.ts
    ├── Supervisor creates definition via UI
    ├── Definition appears in list
    ├── Supervisor edits definition
    ├── Supervisor adds definition to template
    ├── Template item has copied fields
    └── Worker cannot access definition management
```

### Test Priorities (by criticality)

1. **RLS Isolation** (CRITICAL - security)
   - Cross-tenant access denial
   - Service-level tenant_id validation

2. **CRUD Operations** (HIGH - core functionality)
   - Create with validation
   - Read (list and detail)
   - Update with validation
   - Soft delete with usage check

3. **Template Integration** (HIGH - business logic)
   - Copy definition to template
   - Snapshot independence
   - No cascading updates

4. **Deletion Guard** (MEDIUM - data safety)
   - Prevent deletion of in-use definitions
   - Usage check accuracy
   - Soft delete recovery

5. **Validation** (MEDIUM - data integrity)
   - Required fields enforced
   - Character limits respected
   - Boolean defaults applied

### Coverage Targets
- **Overall**: ≥80% (constitutional requirement)
- **Critical paths**: 100% (RLS, CRUD, tenant isolation)
- **Edge cases**: ≥90% (deletion guards, validation)
- **UI components**: ≥70% (interaction testing)

### Alternatives Considered
- **Integration tests only**: Rejected - too slow for rapid feedback
- **E2E only**: Rejected - doesn't verify RLS at database level
- **Manual testing only**: Rejected - doesn't meet ≥80% coverage requirement

---

## Summary of Decisions

| Research Area | Decision | Rationale |
|--------------|----------|-----------|
| **Domain Patterns** | Follow task-template/workflow-task patterns | Consistency, proven, type-safe |
| **Database Schema** | New task_definitions table with RLS | Clear separation, tenant isolation |
| **Template Integration** | Snapshot (copy) approach | Stability, no retroactive changes |
| **Deletion Strategy** | Soft delete with usage check | Safety, recovery, template protection |
| **UI Components** | Adapt existing template components | Similar operations, consistent UX |
| **Testing** | Three-tier (unit, integration, contract) | Coverage ≥80%, RLS verification |

---

## Next Steps

1. ✅ Create data-model.md with detailed schema
2. ✅ Generate API contracts (OpenAPI spec)
3. ✅ Write contract tests (failing tests for TDD)
4. ✅ Create quickstart.md with test scenarios
5. ✅ Update CLAUDE.md with new domain context

---

**Research Complete**: 2025-10-19
**Ready for**: Phase 1 (Design & Contracts)
