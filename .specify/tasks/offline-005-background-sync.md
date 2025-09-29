# Task: Background Sync Refinements

**Slug:** `offline-005-background-sync`
**Priority:** Low
**Size:** 1 PR

## Description
Enhance background sync with retry logic, exponential backoff, and network-aware scheduling.

## Files to Modify
- `public/service-worker.js` - Enhance sync logic
- `src/domains/sync/services/sync-scheduler.ts` - Create new
- `src/domains/sync/config/sync-config.ts` - Create new

## Acceptance Criteria
- [ ] Retries failed syncs with exponential backoff
- [ ] Respects device battery level (pause <20%)
- [ ] Prefers WiFi over cellular
- [ ] Batches operations efficiently
- [ ] Implements jitter to prevent thundering herd
- [ ] Honors 72h force sync deadline

## Test Files
**Create:** `src/__tests__/domains/sync/services/sync-scheduler.test.ts`

Test cases:
- `implements exponential backoff`
  - Fail sync 3 times
  - Assert delays: 1s, 5s, 15s
  - Assert gives up after max
  
- `pauses on low battery`
  - Mock battery at 15%
  - Assert sync paused
  - Mock battery at 25%
  - Assert sync resumes
  
- `prefers wifi networks`
  - Mock cellular connection
  - Assert sync delayed
  - Mock wifi connection
  - Assert immediate sync
  
- `forces sync at deadline`
  - Queue op 71h ago
  - Assert normal scheduling
  - Queue op 73h ago
  - Assert immediate forced sync

## Dependencies
- Browser APIs: Background Sync, Network Information, Battery Status

## Sync Strategy
```typescript
interface SyncStrategy {
  retryDelays: [1000, 5000, 15000, 60000]; // ms
  maxRetries: 4;
  jitterRange: 0.1; // ±10%
  batteryThreshold: 0.2; // 20%
  networkPreference: 'wifi' | 'any';
  batchSize: {
    crud: 50;
    images: 5;
    voice: 20;
  };
  forceSyncAfter: 259200000; // 72 hours
}

interface SyncContext {
  attemptCount: number;
  lastAttemptAt: Date;
  nextAttemptAt: Date;
  network: {
    type: 'wifi' | '4g' | '3g' | 'slow-2g';
    downlink: number; // Mbps
  };
  battery: {
    level: number;
    charging: boolean;
  };
}
```

## Service Worker Enhancement
```javascript
// Add to existing service worker
self.addEventListener('sync', async (event) => {
  if (event.tag.startsWith('sync-')) {
    event.waitUntil(
      performSmartSync(event.tag)
    );
  }
});
```