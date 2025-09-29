# Task: OCR Retry and Backoff Logic

**Slug:** `ocr-018-retry-backoff`
**Priority:** Medium
**Size:** 1 PR

## Description
Implement exponential backoff retry logic for failed OCR operations with jitter.

## Files to Create
- `src/domains/ocr/utils/retry-manager.ts`
- `src/domains/ocr/types/retry-types.ts`

## Files to Modify
- `src/domains/ocr/services/ocr-job-service.ts` - Use retry manager
- `src/domains/ocr/services/ocr-sync-service.ts` - Apply backoff

## Acceptance Criteria
- [ ] Retries with exponential backoff (1s, 5s, 15s)
- [ ] Adds jitter to prevent thundering herd
- [ ] Tracks retry count per job
- [ ] Gives up after max retries (3)
- [ ] Different strategies for different errors
- [ ] Preserves original error info
- [ ] Resets on success
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/utils/retry-manager.test.ts`

Test cases:
- `calculates exponential delays`
  - Attempt 1: 1000ms ± 10%
  - Attempt 2: 5000ms ± 10%
  - Attempt 3: 15000ms ± 10%
  - Assert within range
  
- `adds random jitter`
  - Calculate 10 delays
  - Assert all different
  - Assert within ±10%
  
- `handles different errors`
  - Network error: normal retry
  - Auth error: no retry
  - Rate limit: longer delay
  
- `gives up after max`
  - Fail 4 times
  - Assert no 4th retry
  - Assert marked permanent

## Dependencies
- None (utility module)

## Retry Strategy
```typescript
interface RetryStrategy {
  baseDelays: number[]; // [1000, 5000, 15000]
  jitterPercent: 0.1; // ±10%
  maxRetries: 3;
  
  errorStrategies: {
    network: { retryable: true, delayMultiplier: 1 },
    auth: { retryable: false },
    rateLimit: { retryable: true, delayMultiplier: 2 },
    serverError: { retryable: true, delayMultiplier: 1 },
    clientError: { retryable: false }
  };
}

interface RetryState {
  jobId: string;
  attemptCount: number;
  lastAttempt: Date;
  nextAttempt: Date;
  errors: Array<{
    timestamp: Date;
    error: Error;
    attempt: number;
  }>;
}
```

## Jitter Implementation
```typescript
function addJitter(delay: number, percent: number): number {
  const jitter = delay * percent;
  const min = delay - jitter;
  const max = delay + jitter;
  return Math.random() * (max - min) + min;
}
```

## Rollback
- Disable retries
- Fail immediately