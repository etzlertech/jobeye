# Task: OCR Offline Queue Implementation

**Slug:** `ocr-016-offline-queue`
**Priority:** High
**Size:** 1 PR

## Description
Implement offline queuing for OCR jobs with compression, 500MB limit, and LRU eviction.

## Files to Create
- `src/domains/ocr/services/ocr-offline-queue.ts`
- `src/domains/ocr/utils/image-compressor.ts`
- `src/domains/ocr/stores/ocr-indexeddb-store.ts`

## Files to Modify
- `src/domains/ocr/services/ocr-job-service.ts` - Use offline queue

## Acceptance Criteria
- [ ] Queues OCR jobs when offline
- [ ] Compresses images to 80% JPEG quality
- [ ] Enforces 500MB total limit
- [ ] LRU eviction with user warning
- [ ] Preserves original + compressed
- [ ] Tracks queue size in real-time
- [ ] Integrates with base repository pattern
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/ocr-offline-queue.test.ts`

Test cases:
- `queues job when offline`
  - Mock offline state
  - Queue OCR job
  - Assert stored in IndexedDB
  - Assert returns optimistic response
  
- `compresses images`
  - Queue 5MB image
  - Assert compressed <2MB
  - Assert quality acceptable
  
- `enforces storage limit`
  - Fill to 490MB
  - Add 20MB image
  - Assert warning shown
  - Assert oldest evicted
  
- `maintains FIFO order`
  - Queue 5 jobs
  - Process queue
  - Assert processed in order

**Create:** `src/__tests__/domains/ocr/utils/image-compressor.test.ts`

Test cases:
- `preserves aspect ratio`
- `handles various formats`
- `maintains EXIF data`

## Dependencies
- Browser IndexedDB API
- Base repository pattern

## Storage Management
```typescript
interface OcrQueueEntry {
  id: string;
  jobData: CreateJobParams;
  originalImage: Blob;
  compressedImage: Blob;
  metadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    queuedAt: number;
  };
}

interface QueueConfig {
  maxSize: 500 * 1024 * 1024; // 500MB
  compressionQuality: 0.8;
  warningThreshold: 0.9; // Warn at 90%
  evictionPolicy: 'LRU';
}
```

## Compression Strategy
```typescript
// For images >1MB: compress
// For images <1MB: store original
// Target: 80% JPEG quality
// Preserve: orientation, timestamp
// Max dimensions: 2048x2048
```

## Rollback
- Disable offline mode
- Clear IndexedDB
- Process online only