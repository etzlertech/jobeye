# Task-Item Association Refactor - Next Steps
**Status:** Phase 1 Complete (Critical Path)
**Date:** 2025-10-19

## ✅ Phase 1: Foundation (COMPLETE)

### What Was Accomplished

1. **Database Schema Analysis**
   - Created `docs/database/LIVE_SCHEMA_SNAPSHOT.md`
   - Confirmed `job_tasks` table does NOT exist (referenced in specs but not in DB)
   - Verified `workflow_tasks` is the canonical table (zero current usage = clean slate)
   - Identified task association tables unused (0 rows in production)

2. **Legacy Code Removal**
   - Removed `src/domains/workflows/repositories/job-task.repository.ts` (291 lines)
   - Targeted non-existent table, fully unused

3. **Core Service Factory Fixes**
   - Fixed **3 critical routes** that create/instantiate templates:
     * `src/app/api/supervisor/jobs/route.ts` - Job creation flow
     * `src/app/api/task-templates/[id]/instantiate/route.ts` - Template instantiation
     * `src/app/api/task-templates/[templateId]/items/[itemId]/associations/route.ts` - Association management

4. **Dual-Write BOM Sync Created**
   - New file: `src/domains/jobs/services/job-bom-sync.service.ts`
   - Syncs `workflow_task_item_associations` → `job_checklist_items`
   - Maintains backward compatibility during migration

5. **Documentation**
   - `REFACTOR_STATUS.md` - Comprehensive status & findings
   - `REFACTOR_NEXT_STEPS.md` - This action plan

## 🚧 Phase 2: Complete Service Wiring (TODO)

### Remaining Service Factory Fixes

**Pattern to Apply:**

```typescript
// For TaskTemplateService (4 files):
import { createTaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { TaskTemplateItemAssociationRepository } from '@/domains/task-template/repositories/TaskTemplateItemAssociationRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';

const templateRepo = new TaskTemplateRepository(supabase);
const taskRepo = new WorkflowTaskRepository(supabase);
const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
const service = createTaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);

// For WorkflowTaskService (7 files):
import { createWorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';

const repo = new WorkflowTaskRepository(supabase);
const associationRepo = new WorkflowTaskItemAssociationRepository(supabase);
const service = createWorkflowTaskService(repo, associationRepo);
```

**Files Needing TaskTemplateService Fix:**
1. `src/app/api/task-templates/[id]/image/route.ts`
2. `src/app/api/task-templates/[id]/route.ts`
3. `src/app/api/task-templates/[templateId]/items/[itemId]/associations/[associationId]/route.ts`
4. `src/app/api/task-templates/route.ts`

**Files Needing WorkflowTaskService Fix:**
1. `src/app/api/workflow-tasks/[id]/image/route.ts`
2. `src/app/api/jobs/[jobId]/tasks/route.ts`
3. `src/app/api/jobs/[jobId]/tasks/[taskId]/route.ts`
4. `src/app/api/jobs/[jobId]/tasks/[taskId]/associations/route.ts`
5. `src/app/api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/route.ts`
6. `src/app/api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/load/route.ts`
7. `src/app/api/supervisor/jobs/[jobId]/tasks/from-template/route.ts`

### Automated Fix Script

```bash
# Create a script to batch-fix all remaining files
cat > scripts/fix-service-factories.sh <<'EOF'
#!/bin/bash
# Fix TaskTemplateService instantiations
for file in \
  "src/app/api/task-templates/[id]/image/route.ts" \
  "src/app/api/task-templates/[id]/route.ts" \
  "src/app/api/task-templates/[templateId]/items/[itemId]/associations/[associationId]/route.ts" \
  "src/app/api/task-templates/route.ts"
do
  echo "Fixing $file..."
  # Add imports
  # Replace instantiation
done

# Fix WorkflowTaskService instantiations
for file in \
  "src/app/api/workflow-tasks/[id]/image/route.ts" \
  "src/app/api/jobs/[jobId]/tasks/route.ts" \
  # ... etc
do
  echo "Fixing $file..."
done
EOF
chmod +x scripts/fix-service-factories.sh
```

**OR** manually fix each file using the pattern above.

## 🎯 Phase 3: Integrate Dual-Write (TODO)

### Modify TaskTemplateService.instantiateTemplate()

**File:** `src/domains/task-template/services/TaskTemplateService.ts`

**Location:** After line 184 (end of association copying loop)

**Add:**
```typescript
// T021: Dual-write to job_checklist_items for backward compatibility
import { syncWorkflowAssociationsToJobChecklist } from '@/domains/jobs/services/job-bom-sync.service';

// ... (in instantiateTemplate method, after association loop)

// Sync to job_checklist_items
try {
  // Fetch all workflow associations we just created for this job
  const allJobAssociations = await this.workflowAssocRepo.findByJobIdWithDetails(jobId);

  if (!isErr(allJobAssociations) && allJobAssociations.value.length > 0) {
    // Need to pass supabase client - add to method signature or get from repo
    // For now, document that this needs supabase client access
    // await syncWorkflowAssociationsToJobChecklist(supabase, jobId, allJobAssociations.value);
    console.log(`[TaskTemplateService] TODO: Sync ${allJobAssociations.value.length} associations to job_checklist_items`);
  }
} catch (syncError) {
  console.error('[TaskTemplateService] Failed to sync to job_checklist_items:', syncError);
  // Don't fail template instantiation if sync fails - log and continue
}

return Ok(createdTasks);
```

**Challenge:** The service doesn't have direct Supabase client access. Options:
1. Pass `supabase` client to `instantiateTemplate()` method
2. Add `supabase` to service constructor
3. Create repository method that wraps the sync logic

**Recommended:** Add repository method in `WorkflowTaskItemAssociationRepository`:
```typescript
async syncToJobChecklist(jobId: string): Promise<Result<void, RepositoryError>> {
  const associations = await this.findByJobIdWithDetails(jobId);
  if (isErr(associations)) return associations;

  await syncWorkflowAssociationsToJobChecklist(this.supabase, jobId, associations.value);
  return Ok(undefined);
}
```

Then call: `await this.workflowAssocRepo.syncToJobChecklist(jobId);`

## 📚 Phase 4: Documentation Cleanup (TODO)

### Remove `job_tasks` References

**Files to update:**
```
specs/005-field-intelligence-safety/tasks.md
specs/005-field-intelligence-safety/plan.md
specs/005-field-intelligence-safety/SESSION_2_SUMMARY.md
specs/005-field-intelligence-safety/PROGRESS_SUMMARY.md
.claude/SKELETON_GUIDE.md
docs/FEATURE_GAP_ANALYSIS_2025-09-30.md
docs/FEATURE_005_SCOPE.md
```

**Search & Replace:**
- `job_tasks` → `workflow_tasks`
- Add note: "`workflow_tasks` is the canonical job task table (job_tasks never existed in production)"

### Update Spec Files

**Files:**
```
specs/015-task-item-association/spec.md
specs/015-task-item-association/plan.md
specs/015-task-item-association/data-model.md
```

**Updates needed:**
- Reflect that `workflow_tasks` is canonical (not `job_tasks`)
- Document dual-write strategy for `job_checklist_items`
- Update diagrams if they reference wrong table names

## ✅ Phase 5: Testing & Validation (TODO)

### Unit Tests

```bash
# TaskTemplateService
npm run test -- tests/unit/task-template/TaskTemplateService.test.ts

# WorkflowTaskRepository
npm run test -- tests/unit/workflow-task/WorkflowTaskRepository.test.ts

# WorkflowTaskService
npm run test -- tests/unit/workflow-task/WorkflowTaskService.test.ts

# Job BOM Sync (create if doesn't exist)
npm run test -- tests/unit/jobs/job-bom-sync.service.test.ts
```

### Integration Tests

```bash
# Template image upload
npm run test -- tests/integration/task-templates/image-upload.int.test.ts

# Workflow task image upload
npm run test -- tests/integration/workflow-tasks/image-upload.int.test.ts

# Template instantiation flow (create if doesn't exist)
npm run test -- tests/integration/task-templates/instantiation.int.test.ts
```

### RLS Validation

```bash
# Run existing RLS validation scripts
npm run db:verify-rls  # (if such script exists)

# Manually verify:
# 1. workflow_tasks RLS policies work
# 2. workflow_task_item_associations RLS policies work
# 3. job_checklist_items RLS policies still work
```

### Manual End-to-End Test

**Test Scenario:**
1. Create a task template with 3 task items
2. Add item associations to each task item (equipment + materials)
3. Create a new job
4. Instantiate the template into the job
5. **Verify:**
   - 3 `workflow_tasks` created
   - Item associations copied to `workflow_task_item_associations`
   - `job_checklist_items` table synced with all items
   - Sequence numbers are correct
   - Item names and quantities match
6. Mark items as "loaded" via crew UI
7. **Verify:**
   - Association status updates in `workflow_task_item_associations`
   - Checklist status updates in `job_checklist_items`
8. Try to complete task before all required items loaded
9. **Verify:**
   - Task completion blocked with appropriate error
10. Load remaining items and complete task
11. **Verify:**
    - Task marked complete
    - Job completion validation works

## 📊 Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 2: Service Wiring | 1-2 hours | HIGH |
| Phase 3: Dual-Write Integration | 2-3 hours | HIGH |
| Phase 4: Documentation | 1 hour | MEDIUM |
| Phase 5: Testing | 2-4 hours | HIGH |
| **Total** | **6-10 hours** | |

## 🎯 Critical Path

**Must complete in order:**
1. Phase 2 (service wiring) - **BLOCKS** template instantiation
2. Phase 3 (dual-write) - **BLOCKS** backward compatibility
3. Phase 5 (testing) - **VALIDATES** changes work

## ⚠️ Known Issues & Risks

### Issue 1: Supabase Client Access in Sync
**Problem:** Dual-write helper needs Supabase client, but services don't have direct access.

**Solution:** Add repository method wrapper as shown in Phase 3.

### Issue 2: Kit Item Expansion
**Problem:** Current sync helper creates single checklist entry for kits, doesn't expand kit items.

**Impact:** Crew won't see individual kit items in checklist.

**Solution:** Query `kit_items` table and create checklist entry for each item in kit.

**Code:**
```typescript
if (assoc.kit_id && assoc.kit) {
  // Fetch kit items
  const { data: kitItems } = await supabase
    .from('kit_items')
    .select('*, item:items(*)')
    .eq('kit_id', assoc.kit_id);

  // Create checklist entry for each kit item
  for (const kitItem of kitItems || []) {
    checklistItems.push({
      job_id: jobId,
      sequence_number: sequenceNumber++,
      item_type: kitItem.item.item_type === 'equipment' ? 'equipment' : 'material',
      item_id: kitItem.item_id,
      item_name: `${kitItem.item.name} (from ${assoc.kit.name})`,
      quantity: Number(kitItem.quantity) * Number(assoc.quantity),
      status: mapAssociationStatusToChecklistStatus(assoc.status),
      notes: `Part of kit: ${assoc.kit.name}`,
    });
  }
}
```

### Issue 3: Test Coverage
**Problem:** No existing tests for dual-write flow.

**Solution:** Create `tests/unit/jobs/job-bom-sync.service.test.ts` with:
- Test sync with items only
- Test sync with kits
- Test sync with mixed items and kits
- Test clearing checklist
- Test status mapping

## 📦 Deliverables Summary

**Created:**
- ✅ `docs/database/LIVE_SCHEMA_SNAPSHOT.md` - Complete DB schema analysis
- ✅ `src/domains/jobs/services/job-bom-sync.service.ts` - Dual-write sync logic
- ✅ `REFACTOR_STATUS.md` - Status & findings
- ✅ `REFACTOR_NEXT_STEPS.md` - This action plan

**Modified:**
- ✅ Removed `src/domains/workflows/repositories/job-task.repository.ts`
- ✅ Fixed 3 core API routes (supervisor jobs, instantiate, associations)

**Still TODO:**
- ⏳ Fix 11 remaining service instantiation files
- ⏳ Integrate dual-write into `TaskTemplateService.instantiateTemplate()`
- ⏳ Update 7+ documentation files
- ⏳ Create/update tests
- ⏳ Validate RLS policies

## 🚀 Quick Start Guide

**To continue this refactor:**

1. **Fix remaining service factories:**
   ```bash
   # Manually edit each file listed in Phase 2
   # OR create/run the automated script
   ```

2. **Add dual-write to template instantiation:**
   ```bash
   # Edit src/domains/task-template/services/TaskTemplateService.ts
   # Follow instructions in Phase 3
   ```

3. **Run tests:**
   ```bash
   npm run test
   npm run pre-commit  # This is the gatekeeper
   ```

4. **Manual validation:**
   - Create template
   - Instantiate into job
   - Check both `workflow_task_item_associations` AND `job_checklist_items` populated
   - Try loading items, completing tasks

5. **Clean up docs:**
   ```bash
   # Search for "job_tasks" in specs/docs
   # Replace with "workflow_tasks"
   # Add migration notes
   ```

6. **Create PR:**
   ```bash
   git add .
   git commit -m "refactor(tasks): align task-item workflow with clean model

- Remove legacy JobTaskRepository (job_tasks table doesn't exist)
- Fix service factory wiring (TaskTemplateService, WorkflowTaskService)
- Add dual-write sync for job_checklist_items backward compatibility
- Create comprehensive DB schema snapshot
- Update documentation to reflect workflow_tasks as canonical

Refs: #015-task-item-association

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

   git push origin 015-task-item-association
   ```

## 📧 Questions?

**For implementation questions:**
- Check `REFACTOR_STATUS.md` for current state
- Check `docs/database/LIVE_SCHEMA_SNAPSHOT.md` for schema details
- Check service factory pattern examples in Phase 2

**For design questions:**
- Refer to specs/015-task-item-association/spec.md
- Check `.specify/constitution.md` for architectural rules
