# Task: Voice Command Offline Queue

**Slug:** `voice-005-command-queue`
**Priority:** Medium
**Size:** 1 PR

## Description
Implement offline queue for voice commands with replay capability and metadata preservation.

## Files to Create
- `src/domains/voice/services/voice-queue-service.ts`
- `src/domains/voice/models/voice-command.ts`
- `src/domains/voice/stores/command-store.ts`

## Files to Modify
- `src/app/api/sync/offline-operations/route.ts` - Add voice sync

## Acceptance Criteria
- [ ] Stores commands in IndexedDB when offline
- [ ] Preserves original timestamp and transcript
- [ ] Limits queue to 1000 entries (FIFO eviction)
- [ ] Replays in chronological order on sync
- [ ] Maintains voice context (user, location)
- [ ] Deduplicates identical commands within 5min

## Test Files
**Create:** `src/__tests__/domains/voice/services/voice-queue-service.test.ts`

Test cases:
- `queues command when offline`
  - Mock offline state
  - Queue voice command
  - Assert stored in IndexedDB
  - Assert includes metadata
  
- `enforces 1000 entry limit`
  - Queue 1001 commands
  - Assert oldest evicted
  - Assert 1000 remaining
  
- `deduplicates recent commands`
  - Queue "create job for Smith"
  - Queue same within 5min
  - Assert only one stored
  
- `replays chronologically`
  - Queue commands out of order
  - Trigger sync
  - Assert processed by timestamp

**Create:** `src/__tests__/domains/voice/stores/command-store.test.ts`

Test cases:
- `persists across sessions`
- `handles storage quota errors`
- `maintains data integrity`

## Dependencies
- Existing: Base repository offline queue pattern

## Queue Schema
```typescript
interface VoiceCommand {
  id: string;
  transcript: string;
  intent: string;
  entities: Record<string, any>;
  timestamp: number;
  context: {
    userId: string;
    companyId: string;
    location?: GeolocationCoordinates;
    deviceId: string;
  };
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  attempts: number;
  error?: string;
}

interface QueueConfig {
  maxEntries: 1000;
  dedupeWindow: 300000; // 5 minutes
  syncPriority: 'high';
  retryAttempts: 3;
}
```