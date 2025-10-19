# Task-Item Association Refactor Status
**Date:** 2025-10-19
**Branch:** 015-task-item-association

## Completed Work ✅

### 1. Database Schema Analysis
- ✅ Created comprehensive live schema snapshot (`docs/database/LIVE_SCHEMA_SNAPSHOT.md`)
- ✅ Identified that `job_tasks` table does NOT exist in production
- ✅ Confirmed task-item association tables have **zero usage** (safe to refactor)
- ✅ Documented that `workflow_tasks` is the canonical job task table

### 2. Legacy Code Removal
- ✅ Removed `JobTaskRepository` (`src/domains/workflows/repositories/job-task.repository.ts`)
- ✅ File targeted non-existent `job_tasks` table

### 3. Service Factory Wiring - Partial Complete
- ✅ Fixed `TaskTemplateService` instantiation in:
  - `src/app/api/supervisor/jobs/route.ts` (job creation with templates)
  - `src/app/api/task-templates/[id]/instantiate/route.ts` (template instantiation)
  - `src/app/api/task-templates/[templateId]/items/[itemId]/associations/route.ts` (GET/POST associations)

## In Progress 🚧

### Service Factory Fix Script
Creating systematic approach to fix all remaining service instantiations.

**Files Still Need Fixing:**

**TaskTemplateService** (4 files):
```
src/app/api/task-templates/[id]/image/route.ts
src/app/api/task-templates/[id]/route.ts
src/app/api/task-templates/[templateId]/items/[itemId]/associations/[associationId]/route.ts
src/app/api/task-templates/route.ts
```

**WorkflowTaskService** (7 files):
```
src/app/api/workflow-tasks/[id]/image/route.ts
src/app/api/jobs/[jobId]/tasks/route.ts
src/app/api/jobs/[jobId]/tasks/[taskId]/route.ts
src/app/api/jobs/[jobId]/tasks/[taskId]/associations/route.ts
src/app/api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/route.ts
src/app/api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/load/route.ts
src/app/api/supervisor/jobs/[jobId]/tasks/from-template/route.ts
```

## Pending Work 📋

### 1. Complete Service Factory Fixes
**Required Pattern for TaskTemplateService:**
```typescript
// OLD (broken):
const service = new TaskTemplateService(templateRepo, taskRepo);

// NEW (correct):
import { createTaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { TaskTemplateItemAssociationRepository } from '@/domains/task-template/repositories/TaskTemplateItemAssociationRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';

const templateRepo = new TaskTemplateRepository(supabase);
const taskRepo = new WorkflowTaskRepository(supabase);
const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
const service = createTaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);
```

**Required Pattern for WorkflowTaskService:**
```typescript
// OLD (broken):
const service = new WorkflowTaskService(repo);

// NEW (correct):
import { createWorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';

const repo = new WorkflowTaskRepository(supabase);
const associationRepo = new WorkflowTaskItemAssociationRepository(supabase);
const service = createWorkflowTaskService(repo, associationRepo);
```

### 2. Create Dual-Write BOM Sync Helper
**Location:** `src/domains/jobs/services/job-bom-sync.service.ts`

**Purpose:** Keep `job_checklist_items` in sync with `workflow_task_item_associations` until migration complete.

**Method:**
```typescript
/**
 * Sync workflow task item associations to job_checklist_items
 * Maintains backward compatibility with existing BOM system
 */
export async function syncWorkflowAssociationsToJobChecklist(
  supabase: SupabaseClient,
  jobId: string,
  workflowTaskAssociations: WorkflowTaskItemAssociationWithDetails[]
): Promise<void> {
  // 1. Get existing job_checklist_items for this job
  // 2. Map workflow associations to checklist format
  // 3. Upsert to job_checklist_items table
  // 4. Update sequence_numbers appropriately
}
```

### 3. Integrate Dual-Write into Template Instantiation
**Files to modify:**
- `src/domains/task-template/services/TaskTemplateService.ts:instantiateTemplate()` (line ~186)
- After workflow_task_item_associations are created, call sync helper

```typescript
// After lines 166-184 (association copying loop)
// Add dual-write to job_checklist_items:
await syncWorkflowAssociationsToJobChecklist(supabase, jobId, createdAssociations);
```

### 4. Update Documentation
**Remove `job_tasks` references from:**
- `specs/005-field-intelligence-safety/*.md`
- `.claude/SKELETON_GUIDE.md`
- `docs/FEATURE_GAP_ANALYSIS_2025-09-30.md`
- `docs/FEATURE_005_SCOPE.md`

**Add clarification:**
- Document `workflow_tasks` as canonical job task table
- Document `job_checklist_items` dual-write strategy
- Update diagrams/specs to reflect actual schema

### 5. Update Spec Files
**Files:**
- `specs/015-task-item-association/spec.md`
- `specs/015-task-item-association/plan.md`
- Update data model to reflect workflow_tasks (not job_tasks)

### 6. Testing & Validation

**Unit Tests:**
```bash
npm run test -- tests/unit/task-template/TaskTemplateService.test.ts
npm run test -- tests/unit/workflow-task/WorkflowTaskRepository.test.ts
npm run test -- tests/unit/workflow-task/WorkflowTaskService.test.ts
```

**Integration Tests:**
```bash
npm run test -- tests/integration/task-templates/image-upload.int.test.ts
npm run test -- tests/integration/workflow-tasks/image-upload.int.test.ts
```

**RLS Validation:**
Check existing RLS validation scripts still pass with new workflow.

**Manual Testing:**
1. Create template with item associations
2. Instantiate template into job
3. Verify workflow_task_item_associations created
4. Verify job_checklist_items synced (dual-write)
5. Complete tasks and verify item loading requirements work

## Risk Assessment 🎯

### Low Risk ✅
- Template association system unused (0 production rows)
- Legacy repository removal (job_tasks table doesn't exist)
- Service factory fixes (compile-time safe)

### Medium Risk ⚠️
- Dual-write logic complexity
- job_checklist_items backward compatibility
- Need thorough integration testing

### High Risk 🔴
- None identified (clean slate for association refactor)

## Success Criteria

1. ✅ All service instantiations use factory pattern
2. ⏳ Template item associations propagate to workflow tasks
3. ⏳ Dual-write keeps job_checklist_items in sync
4. ⏳ All tests pass
5. ⏳ Documentation reflects actual schema
6. ⏳ RLS policies validated for workflow tables

## Next Actions

1. **Complete service factory fixes** (11 files remaining)
2. **Create dual-write helper** (job-bom-sync.service.ts)
3. **Integrate dual-write** into TaskTemplateService
4. **Run tests** and fix any issues
5. **Update documentation** to remove job_tasks references
6. **Create PR** with comprehensive changelist

## Notes

- Production database has 71 jobs, 43 items, but zero task associations
- Safe to refactor association system without data migration
- Existing job_checklist_items (3 rows) show minimal usage, easy to sync
- Template system (1 template, 1 item) is functional but association flow was broken
