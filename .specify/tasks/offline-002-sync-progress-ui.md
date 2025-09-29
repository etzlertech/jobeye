# Task: Sync Progress UI Components

**Slug:** `offline-002-sync-progress-ui`
**Priority:** Medium
**Size:** 1 PR

## Description
Create UI components to show sync progress with operation counts, time estimates, and completion feedback.

## Files to Create
- `src/components/sync/sync-progress-indicator.tsx`
- `src/components/sync/sync-status-provider.tsx`
- `src/hooks/use-sync-status.ts`

## Files to Modify
- `src/components/shared/offline-indicator.tsx` - Add progress display
- `src/app/layout.tsx` - Wrap with SyncStatusProvider

## Acceptance Criteria
- [ ] Shows pending count by type (CRUD, images, voice)
- [ ] Displays upload/download progress bars
- [ ] Estimates time remaining based on rate
- [ ] Animates during active sync
- [ ] Shows completion summary
- [ ] Minimizes to corner when not syncing

## Test Files
**Create:** `src/__tests__/components/sync/sync-progress-indicator.test.tsx`

Test cases:
- `shows operation counts`
  - Mock sync status with counts
  - Assert displays "5 jobs, 3 images"
  - Assert categorized correctly
  
- `updates progress in real-time`
  - Start with 10 operations
  - Complete 5
  - Assert progress bar at 50%
  - Assert time estimate updated
  
- `shows completion summary`
  - Complete sync
  - Assert success message
  - Assert operation counts
  - Assert auto-dismiss after 5s

**Create:** `src/__tests__/hooks/use-sync-status.test.ts`

Test cases:
- `subscribes to sync events`
- `calculates upload rate`
- `estimates completion time`

## Dependencies
- Existing: Event bus for sync updates
- UI: Framer Motion for animations

## Component Interface
```typescript
interface SyncProgress {
  status: 'idle' | 'syncing' | 'completed' | 'failed';
  operations: {
    crud: { pending: number; completed: number; failed: number };
    images: { pending: number; completed: number; failed: number };
    voice: { pending: number; completed: number; failed: number };
  };
  progress: {
    percentage: number;
    bytesTransferred: number;
    bytesTotal: number;
    rate: number; // bytes/sec
  };
  estimatedTime?: number; // seconds
  errors: SyncError[];
}
```

## UI States
- **Idle**: Hidden or minimized dot
- **Syncing**: Expanded with progress details
- **Completed**: Success message with stats
- **Failed**: Error message with retry button