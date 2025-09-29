# Task: Offline E2E Test Scenarios

**Slug:** `tests-003-offline-e2e`
**Priority:** Medium
**Size:** 1 PR

## Description
Create end-to-end tests for complete offline workflows including job creation, image capture, and sync.

## Files to Create
- `src/__tests__/e2e/offline-job-flow.spec.ts`
- `src/__tests__/e2e/offline-sync-flow.spec.ts`
- `src/__tests__/e2e/offline-voice-flow.spec.ts`
- `playwright.config.offline.ts`

## Files to Modify
- `playwright.config.ts` - Add offline profile

## Acceptance Criteria
- [ ] Tests complete offline job creation
- [ ] Tests image queue and sync
- [ ] Tests voice commands offline
- [ ] Simulates network disruptions
- [ ] Verifies data integrity post-sync
- [ ] Tests conflict resolution flows

## Test Files
**Create:** `src/__tests__/e2e/offline-job-flow.spec.ts`

Test cases:
- `creates job while offline`
  - Go offline
  - Create job via UI
  - Add checklist items
  - Assert saved locally
  - Assert UI shows offline badge
  
- `captures images offline`
  - Take verification photo
  - Assert image queued
  - Assert local preview works
  - Check IndexedDB storage
  
- `syncs when reconnected`
  - Go online
  - Assert sync starts automatically
  - Assert progress indicator
  - Verify job in database
  - Verify images uploaded

**Create:** `src/__tests__/e2e/offline-sync-flow.spec.ts`

Test cases:
- `handles interrupted sync`
  - Start sync
  - Go offline mid-sync
  - Assert partial sync saved
  - Go online
  - Assert resumes correctly
  
- `resolves conflicts`
  - Create conflicting edits
  - Trigger sync
  - Assert conflict modal
  - Choose resolution
  - Verify merged result

**Create:** `src/__tests__/e2e/offline-voice-flow.spec.ts`

Test cases:
- `processes voice commands offline`
  - Go offline
  - Say "Hey JobEye, create job"
  - Complete voice flow
  - Assert command queued
  - Go online and verify

## Dependencies
- Playwright for E2E testing

## Test Configuration
```typescript
// playwright.config.offline.ts
export const offlineConfig = {
  use: {
    // Offline simulation
    offline: true,
    
    // Device emulation
    ...devices['Pixel 5'],
    
    // Service worker enabled
    serviceWorkers: 'allow',
    
    // Storage persistence
    storageState: 'tests/e2e/storage-auth.json'
  },
  
  // Network conditions
  networkConditions: {
    offline: {
      offline: true
    },
    slow3G: {
      offline: false,
      downloadThroughput: 0.4 * 1024 * 1024 / 8,
      uploadThroughput: 0.4 * 1024 * 1024 / 8,
      latency: 400
    },
    flaky: {
      offline: false,
      downloadThroughput: 1024 * 1024 / 8,
      uploadThroughput: 1024 * 1024 / 8,
      latency: 100,
      // Custom: drop connection every 30s
    }
  }
};
```

## Test Utilities
```typescript
// Network control helpers
export const NetworkHelpers = {
  async goOffline(page: Page) {
    await page.context().setOffline(true);
    await page.waitForSelector('[data-testid="offline-indicator"]');
  },
  
  async goOnline(page: Page) {
    await page.context().setOffline(false);
    await page.waitForSelector('[data-testid="online-indicator"]');
  },
  
  async simulateFlaky(page: Page, durationMs: number) {
    const interval = setInterval(() => {
      page.context().setOffline(Math.random() > 0.5);
    }, 5000);
    
    setTimeout(() => clearInterval(interval), durationMs);
  },
  
  async waitForSync(page: Page) {
    await page.waitForSelector('[data-testid="sync-complete"]', {
      timeout: 60000
    });
  }
};
```

## Validation Steps
```typescript
interface OfflineDataValidation {
  localStorage: {
    queuedOperations: number;
    cachedData: string[];
  };
  indexedDB: {
    databases: string[];
    totalSize: number;
    imageCount: number;
  };
  serviceWorker: {
    cacheNames: string[];
    cachedRequests: number;
  };
}

async function validateOfflineData(page: Page): Promise<OfflineDataValidation> {
  // Check all offline storage
  // Verify data integrity
  // Return validation summary
}
```