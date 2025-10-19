# Phase 0: Research & Technical Decisions

**Feature**: Task-Level Item Association
**Date**: 2025-10-19
**Status**: Complete

## Research Questions

### R1: Association Table Design Pattern

**Question**: How should we model many-to-many relationships between tasks and items/kits?

**Research Findings**:
- Reviewed existing `kit_items` table (kit ↔ item many-to-many)
- Reviewed existing `task_template_items` table (template ↔ task many-to-many)
- PostgreSQL best practices recommend separate junction tables
- Supabase RLS requires `tenant_id` on all tables including junction tables

**Decision**: Create two separate junction/association tables:
1. `task_template_item_associations` - Links template items to items/kits
2. `workflow_task_item_associations` - Links workflow tasks to items/kits

**Rationale**:
- Separate tables maintain clear domain boundaries (template vs. runtime)
- Allows different columns (template has no status, workflow has status/loaded_at)
- Follows existing pattern (task_template_items separate from workflow_tasks)
- Enables independent evolution of template vs. workflow concerns

**Alternatives Considered**:
- Single `task_item_associations` table with polymorphic `task_type` field
  - Rejected: Complicates foreign key constraints and RLS policies
- Embedding item lists as JSON in existing tables
  - Rejected: Loses relational integrity, harder to query, no referential integrity

### R2: Item vs. Kit Distinction

**Question**: Should associations point to `items` OR `kits` OR both?

**Research Findings**:
- Current schema has separate `items` and `kits` tables
- `kits` contain `kit_items` which reference `items`
- Tasks might require individual items (e.g., "push mower") OR kits (e.g., "small yard kit")

**Decision**: Support BOTH item_id and kit_id with XOR constraint

**Rationale**:
- Flexibility: Some tasks need specific items, others need pre-configured kits
- Consistency: Matches how job-level assignment works (`assigned_to_job_id` on items table)
- Expandability: Kit contents can change without changing task associations

**Implementation**:
```sql
CHECK (
  (item_id IS NOT NULL AND kit_id IS NULL) OR
  (item_id IS NULL AND kit_id IS NOT NULL)
)
```

**Alternatives Considered**:
- Items only, expand kits at UI level
  - Rejected: Loses kit versioning, complicated UI logic
- Kits only, force everything into kit structure
  - Rejected: Overkill for single-item requirements
- Separate tables for item associations vs. kit associations
  - Rejected: Unnecessary complexity, same columns needed for both

### R3: Template Instantiation Strategy

**Question**: How should workflow_task item associations be created from template associations?

**Research Findings**:
- Reviewed `TaskTemplateService.instantiateTemplate()` method
- Currently copies task_template_items → workflow_tasks with modified fields
- Service layer handles instantiation logic, not database triggers

**Decision**: Service-layer copy with `source_template_association_id` tracking

**Rationale**:
- Maintains audit trail (can trace workflow association back to template)
- Allows detecting "template-derived" vs. "custom" associations
- Enables future features (e.g., "sync changes from template")
- Consistent with how task_order, description, etc. are copied

**Implementation** (in TaskTemplateService):
```typescript
async instantiateTemplate(templateId, jobId) {
  // ... existing task instantiation ...

  // For each workflow_task created:
  for (const task of createdTasks) {
    const templateItemId = task.source_template_item_id;
    const templateAssociations = await getTemplateItemAssociations(templateItemId);

    for (const assoc of templateAssociations) {
      await createWorkflowTaskItemAssociation({
        workflow_task_id: task.id,
        item_id: assoc.item_id,
        kit_id: assoc.kit_id,
        quantity: assoc.quantity,
        is_required: assoc.is_required,
        notes: assoc.notes,
        status: 'pending',
        source_template_association_id: assoc.id
      });
    }
  }
}
```

**Alternatives Considered**:
- Database trigger on workflow_tasks INSERT
  - Rejected: Hard to test, difficult to debug, less flexible
- Copy associations in separate API call after instantiation
  - Rejected: Atomicity issues, could leave incomplete job state
- No tracking of template origin
  - Rejected: Loses valuable audit trail

### R4: Status Tracking for Workflow Task Items

**Question**: What status values and workflow are needed for tracking item loading?

**Research Findings**:
- Reviewed similar field service management systems
- Current `workflow_tasks` has status: pending, in_progress, completed
- Items have different lifecycle: requested → loaded → verified → returned

**Decision**: Add `status` ENUM with values: pending, loaded, verified, missing, returned

**Rationale**:
- **pending**: Item association created but not yet loaded (initial state)
- **loaded**: Worker marked item as loaded onto truck/vehicle
- **verified**: Supervisor or system confirmed item is loaded
- **missing**: Item not available, task may be blocked
- **returned**: Item returned to inventory after task completion

**Status Transitions**:
```
pending → loaded → verified → returned
pending → missing (blocked flow)
missing → loaded (item found)
```

**Alternatives Considered**:
- Boolean flags (is_loaded, is_verified, is_returned)
  - Rejected: Harder to query current state, no clear single source of truth
- No status tracking (always assume loaded)
  - Rejected: Defeats purpose of task-level equipment tracking
- Complex workflow with more states (reserved, in_transit, damaged, etc.)
  - Rejected: Out of scope for v1, can add later if needed

### R5: UI Component Architecture

**Question**: How should item association UI integrate with existing template editing?

**Research Findings**:
- Reviewed `src/app/(authenticated)/supervisor/templates/[id]/edit/page.tsx`
- Currently uses accordion for task items, each task item is editable
- Already has pattern for adding items from library (TaskDefinitionLibraryModal)

**Decision**: Add "Required Items" section within each task item accordion panel

**Rationale**:
- Co-location: Item requirements shown alongside task description
- Consistency: Matches how task template items are edited
- Reusability: Can leverage existing ItemBrowserModal component pattern

**Component Structure**:
```tsx
<TaskItemAccordion>
  <TaskDescriptionFields />
  <TaskItemAssociationManager> {/* NEW */}
    <ItemAssociationList>
      <ItemAssociationCard /> {/* displays associated item */}
      <KitAssociationCard />  {/* displays associated kit */}
    </ItemAssociationList>
    <AddItemButton onClick={openItemBrowser} />
    <AddKitButton onClick={openKitBrowser} />
  </TaskItemAssociationManager>
</TaskItemAccordion>

<ItemKitBrowserModal> {/* NEW */}
  <ItemList filter={searchQuery} />
  <KitList filter={searchQuery} />
</ItemKitBrowserModal>
```

**Alternatives Considered**:
- Separate page for managing item associations
  - Rejected: Extra navigation, breaks context
- Modal that shows all task items with their associations
  - Rejected: Harder to edit specific task
- Inline autocomplete for adding items
  - Rejected: Less discoverable, harder to browse inventory

### R6: Performance Optimization Strategy

**Question**: How to efficiently load job with 50 tasks + 200 item associations?

**Research Findings**:
- Current job loading uses Supabase queries with `.select()` joins
- PostgreSQL query planner can optimize joins with proper indexes
- N+1 query problem common with associations

**Decision**: Use Supabase nested select with indexes on foreign keys

**Database Indexes**:
```sql
CREATE INDEX idx_template_assoc_template_item
  ON task_template_item_associations(template_item_id);

CREATE INDEX idx_workflow_assoc_task
  ON workflow_task_item_associations(workflow_task_id);

CREATE INDEX idx_workflow_assoc_source
  ON workflow_task_item_associations(source_template_association_id);
```

**Query Pattern**:
```typescript
const { data } = await supabase
  .from('workflow_tasks')
  .select(`
    *,
    workflow_task_item_associations (
      *,
      items (*),
      kits (*)
    )
  `)
  .eq('job_id', jobId);
```

**Rationale**:
- Single query instead of N+1 queries
- Supabase PostgREST optimizes joins automatically
- Indexes ensure fast lookups on foreign keys

**Alternatives Considered**:
- Load associations in separate query after tasks
  - Rejected: N+1 problem, slower total time
- Lazy load associations on demand
  - Rejected: Poor UX for "Equipment Needed" view where all associations matter
- Materialize view with task + associations
  - Rejected: Overkill for v1, adds complexity

## Technical Stack Decisions

### Database
- **PostgreSQL 15** via Supabase
- **PostgREST** for API layer
- **RLS** for tenant isolation
- **Foreign Key Constraints** for referential integrity
- **Check Constraints** for business rules

### Backend
- **Repository Pattern**: All database access
- **Service Pattern**: Business logic layer
- **Result<T, E>** type: Functional error handling
- **Zod Schemas**: Runtime validation

### Frontend
- **Next.js 14 App Router**: Server + Client components
- **React Server Components**: Initial data loading
- **Client Components**: Interactive forms
- **Lucide React**: Icon library
- **Tailwind CSS**: Styling

### Testing
- **Vitest**: Unit tests (repositories, services)
- **Playwright**: Integration tests (API routes)
- **Contract Tests**: Schema validation
- **Coverage Target**: ≥80%

## Open Questions Resolved

All questions from spec.md Clarifications section were addressed during feature discussion:

1. ✅ Job-level vs. Task-level: COMPLEMENT (keep both)
2. ✅ Template propagation: NO (snapshot at instantiation time)
3. ✅ Kits: Keep as reference (don't expand to items)
4. ✅ Status values: pending, loaded, verified, missing, returned
5. ✅ Required vs. Optional: YES (`is_required` boolean)

## Dependencies Verified

### Existing Domains (No Changes Needed)
- ✅ `items` table and domain - fully implemented
- ✅ `kits` and `kit_items` tables - fully implemented
- ✅ `task_templates` and `task_template_items` - fully implemented (spec 013)
- ✅ `workflow_tasks` - fully implemented
- ✅ `task_definitions` library - fully implemented (spec 014)

### New Dependencies (Will Create)
- Two new junction tables
- Two new repositories
- Service method additions
- UI components for association management

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Performance degradation with many items | Indexed foreign keys, single-query loading |
| Complex UI (two-level equipment view) | Clear visual separation, user testing |
| Data integrity (orphaned associations) | Foreign key constraints, cascade deletes |
| Template changes don't propagate | By design - document in user guide |

## Next Steps → Phase 1

With research complete, proceed to Phase 1:
1. Generate detailed data model documentation
2. Create API contracts for association endpoints
3. Generate contract tests (TDD approach)
4. Create quickstart guide for feature validation
5. Update CLAUDE.md with new domain context
