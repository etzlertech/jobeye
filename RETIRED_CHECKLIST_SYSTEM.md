# Retired: job_checklist_items System

**Retirement Date**: 2025-10-19  
**Migration**: `supabase/migrations/20251019_drop_job_checklist_items.sql`  
**Status**: ✅ Complete

---

## What Was Retired

The `job_checklist_items` table and all associated code has been **fully retired** and replaced by the `item_transactions` system.

### Table Dropped
```sql
-- RETIRED TABLE (no longer exists in schema)
job_checklist_items (
  id, job_id, sequence_number, item_type,
  item_id, item_name, quantity, container_id,
  status, vlm_prompt, acceptance_criteria,
  notes, created_at, updated_at
)
```

### Replacement System

**New Single Source of Truth**: `item_transactions` table

```sql
-- Current schema for tracking tools/materials
item_transactions (
  id, tenant_id, job_id, item_id,
  transaction_type,  -- 'check_out' | 'check_in'
  quantity, notes,
  created_at, updated_at
)
```

**Load Status Calculation** (new pattern):
```typescript
// Group transactions by item_id to get latest status
const itemsMap = new Map();
transactions.forEach(tx => {
  if (!itemsMap.has(tx.item_id)) {
    itemsMap.set(tx.item_id, tx);
  }
});

// Count assigned items (latest transaction is check_out)
const assignedItems = Array.from(itemsMap.values())
  .filter(tx => tx.transaction_type === 'check_out');

const totalItems = assignedItems.reduce((sum, tx) => sum + tx.quantity, 0);
```

---

## What Changed

### Code Removed
- ✅ Repository: `src/domains/job/repositories/ChecklistRepository.ts`
- ✅ Service: `src/domains/job/services/checklist-service.ts`
- ✅ API Routes: `/api/jobs/[jobId]/checklist/*`
- ✅ Vision Service: `job_checklist_items` creation code

### Code Updated
- ✅ `job-assignment.service.ts`: Updated `enrichWithLoadStatus()` to use item_transactions
- ✅ `job-from-voice-service.ts`: Removed checklist creation, uses templates instead
- ✅ Integration tests: Updated to use item_transactions
- ✅ UI Components: Terminology updated to "Required Tools & Materials"

### Database Changes
- ✅ Table dropped: `job_checklist_items`
- ✅ Policies dropped: RLS policies for job_checklist_items
- ✅ Indexes dropped: All job_checklist_items indexes
- ✅ Types updated: Removed from `src/types/database.ts`

---

## Migration Path Used

1. **Backend Updates** (completed before migration):
   - Updated all services to use `item_transactions`
   - Updated all API routes
   - Updated all tests
   - Verified no code references remained

2. **Migration Applied** (2025-10-19):
   ```bash
   # Applied via Supabase MCP
   mcp__supabase__apply_migration(
     project_id: "rtwigjwqufozqfwozpvo",
     name: "drop_job_checklist_items",
     query: "..."  # See migration file
   )
   ```

3. **Type Regeneration**:
   - Removed `job_checklist_items` from `src/types/database.ts`
   - Type check confirms no remaining references

4. **Documentation Updated**:
   - Added deprecation notices to spec files
   - Archived obsolete API contracts
   - Created this retirement notice

---

## Historical References

The following documents contain historical references to `job_checklist_items`:

### Spec Files (with deprecation notices)
- `specs/010-job-assignment-and/data-model.md` - Added retirement notice
- `specs/007-integrate-job-creation-workflow/*` - Historical references preserved

### Archived Contracts
- `specs/007-integrate-job-creation-workflow/contracts/job-checklist-items-api.json.old` - Archived
- `specs/007-integrate-job-creation-workflow/contracts/job-checklist-items-api.json.RETIRED` - Notice file

### Old Migrations (preserved for history)
- `supabase/migrations/005_v4_multi_object_vision_extension.sql` - Created the table
- `supabase/migrations/007_job_checklist_auto_override.sql` - Added auto-override feature
- `supabase/migrations/20251019_drop_job_checklist_items.sql` - Dropped the table

---

## Testing Verification

**Integration Tests**: ✅ All Passing
```bash
# Crew hub flow tests
npm test -- src/__tests__/integration/crew-hub-flow.test.ts
# PASS: 6/6 tests

# Multi-crew assignment tests  
npm test -- src/__tests__/integration/multi-crew-assignment.test.ts
# PASS: 8/8 tests
```

**Type Check**: ✅ Clean
```bash
npm run type-check
# No job_checklist_items errors
# Only pre-existing task_definitions errors remain
```

---

## Terminology Updates

As part of the cleanup, user-facing terminology was also updated:

| Old Term | New Term |
|----------|----------|
| "Checklist items" | "Required Tools & Materials" |
| "Job" (UI) | "Work Order" (user-facing) |
| "Loaded" status | "Assigned" status |
| "Equipment Checklist" | "Required Tools & Materials" |
| "Load List" | "Required Tools & Materials" |

**Hierarchy**: Work Order → Task → Steps + Required Tools/Materials

---

## Summary

✅ **Complete Retirement**:
- Table dropped from database
- All code updated to use item_transactions
- Types regenerated and verified
- Tests passing
- Documentation updated

**No Rollback Needed**: This was a clean migration with no production data (fake-data environment).

**Next Steps**: Continue with phase 4 cleanup (terminology sweep, final integration tests).

---

**Document Version**: 1.0  
**Date**: 2025-10-19  
**Author**: Claude Code (automated cleanup)
