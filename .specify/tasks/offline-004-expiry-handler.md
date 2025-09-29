# Task: Time-Sensitive Operation Expiry

**Slug:** `offline-004-expiry-handler`
**Priority:** Medium
**Size:** 1 PR

## Description
Implement expiry handling for time-sensitive operations with manual review workflow.

## Files to Create
- `src/domains/sync/services/expiry-handler.ts`
- `src/domains/sync/models/expired-operations.ts`
- `src/components/sync/expired-ops-review.tsx`

## Files to Modify
- `src/lib/repositories/base.repository.ts` - Add expiry timestamps
- `src/app/api/sync/offline-operations/route.ts` - Skip expired

## Acceptance Criteria
- [ ] Marks job status updates with 24h expiry
- [ ] Checks expiry before sync attempt
- [ ] Moves expired ops to review queue
- [ ] Shows expired ops in UI for decision
- [ ] Allows manual retry or discard
- [ ] Preserves non-time-sensitive ops

## Test Files
**Create:** `src/__tests__/domains/sync/services/expiry-handler.test.ts`

Test cases:
- `marks time-sensitive operations`
  - Queue job status change
  - Assert expiresAt = now + 24h
  - Assert marked as time-sensitive
  
- `identifies expired operations`
  - Create op with past expiry
  - Run expiry check
  - Assert marked as expired
  - Assert moved to review queue
  
- `preserves non-expiring ops`
  - Queue customer update
  - Wait 48h
  - Assert still valid
  - Assert syncs normally

**Create:** `src/__tests__/components/sync/expired-ops-review.test.tsx`

Test cases:
- `displays expired operations`
- `allows retry with new timestamp`
- `allows permanent discard`

## Dependencies
- Existing: Offline queue infrastructure

## Expiry Configuration
```typescript
interface ExpiryConfig {
  operations: {
    'job.status': 86400000; // 24 hours
    'job.checkin': 3600000; // 1 hour
    'equipment.checkout': 7200000; // 2 hours
  };
  default: null; // No expiry
}

interface ExpiredOperation {
  id: string;
  type: string;
  operation: any;
  expiredAt: Date;
  originalTimestamp: Date;
  reason: string;
  reviewStatus: 'pending' | 'retried' | 'discarded';
}
```

## Review UI
- List view of expired operations
- Shows original timestamp and expiry time
- Groups by operation type
- Bulk actions: retry all, discard all
- Individual retry with updated timestamp