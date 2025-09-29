# Task: Sync Conflict Resolution UI

**Slug:** `offline-003-conflict-resolver`
**Priority:** Medium
**Size:** 1 PR

## Description
Build UI for resolving sync conflicts with visual diff and merge options.

## Files to Create
- `src/components/sync/conflict-resolver-modal.tsx`
- `src/domains/sync/services/conflict-detector.ts`
- `src/domains/sync/utils/diff-generator.ts`

## Files to Modify
- `src/lib/repositories/base.repository.ts` - Detect conflicts
- `src/domains/customer/services/customer-offline-sync.ts` - Use resolver

## Acceptance Criteria
- [ ] Detects version conflicts during sync
- [ ] Shows side-by-side diff (local vs remote)
- [ ] Highlights changed fields
- [ ] Offers keep local/remote/merge options
- [ ] Allows field-level merge selection
- [ ] Logs resolution for audit trail

## Test Files
**Create:** `src/__tests__/components/sync/conflict-resolver-modal.test.tsx`

Test cases:
- `displays both versions clearly`
  - Mock conflict data
  - Assert local version shown
  - Assert remote version shown
  - Assert differences highlighted
  
- `allows field selection for merge`
  - Show customer conflict
  - Select name from local
  - Select phone from remote
  - Assert merged result correct
  
- `handles keep all local/remote`
  - Click "Keep all local"
  - Assert all fields from local
  - Assert modal closes

**Create:** `src/__tests__/domains/sync/services/conflict-detector.test.ts`

Test cases:
- `detects update conflicts`
- `ignores non-conflicting changes`
- `handles deleted records`

## Dependencies
- Existing: Base repository for version tracking

## Conflict Types
```typescript
interface SyncConflict {
  id: string;
  table: string;
  type: 'update' | 'delete';
  local: {
    data: Record<string, any>;
    updatedAt: Date;
    updatedBy: string;
  };
  remote: {
    data: Record<string, any>;
    updatedAt: Date;
    updatedBy: string;
  };
  differences: FieldDiff[];
}

interface FieldDiff {
  field: string;
  local: any;
  remote: any;
  type: 'added' | 'removed' | 'modified';
}

interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge';
  mergedData?: Record<string, any>;
  resolvedBy: string;
  resolvedAt: Date;
  reason?: string;
}
```

## UI Layout
- Modal with two columns
- Color coding: green (added), red (removed), yellow (changed)
- Checkbox per field for merge mode
- Preview of final result before save