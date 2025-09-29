# Task: OCR Background Sync Integration

**Slug:** `ocr-017-sync-integration`
**Priority:** High
**Size:** 1 PR

## Description
Integrate OCR queue with existing background sync infrastructure and service worker.

## Files to Create
- `src/domains/ocr/services/ocr-sync-service.ts`

## Files to Modify
- `src/app/api/sync/offline-operations/route.ts` - Add OCR sync
- `public/service-worker.js` - Add OCR sync tag
- `src/domains/sync/services/sync-orchestrator.ts` - Include OCR

## Acceptance Criteria
- [ ] Syncs OCR jobs during background sync
- [ ] Respects sync priorities (failed first)
- [ ] Handles 72h force sync deadline
- [ ] Reports progress to sync indicator
- [ ] Retries with exponential backoff
- [ ] Cleans up after successful sync
- [ ] Preserves job order (FIFO)
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/ocr-sync-service.test.ts`

Test cases:
- `syncs queued OCR jobs`
  - Queue 5 jobs offline
  - Trigger sync
  - Assert all processed
  - Assert queue cleared
  
- `retries failed jobs first`
  - Have 2 failed, 3 pending
  - Trigger sync
  - Assert failed processed first
  
- `respects 72h deadline`
  - Queue job 73h ago
  - Assert forced sync
  - Assert no delay
  
- `handles partial sync`
  - Sync 3 of 5 jobs
  - Lose connection
  - Assert 3 complete
  - Assert 2 remain queued

## Dependencies
- `ocr-016-offline-queue` - Queue must exist
- Existing sync infrastructure

## Sync Configuration
```typescript
interface OcrSyncConfig {
  batchSize: 5; // Process 5 at a time
  priorities: {
    failed: 1,
    stale: 2, // >24h old
    normal: 3
  };
  retryDelays: [1000, 5000, 15000]; // ms
  maxRetries: 3;
}

interface OcrSyncResult {
  synced: string[];
  failed: string[];
  remaining: number;
  errors: SyncError[];
}
```

## Service Worker Integration
```javascript
// In service worker
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-ocr-queue') {
    event.waitUntil(syncOcrQueue());
  }
});

// Register sync when online
if ('serviceWorker' in navigator && 'SyncManager' in window) {
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register('sync-ocr-queue');
}
```

## Rollback
- Disable background sync
- Manual sync only