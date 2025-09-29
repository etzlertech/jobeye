# Task: Offline Image Queue

**Slug:** `offline-001-image-queue`
**Priority:** High
**Size:** 1 PR

## Description
Implement image queue with compression, LRU eviction, and batch upload on reconnection.

## Files to Create
- `src/domains/vision/services/image-queue-service.ts`
- `src/domains/vision/utils/image-compressor.ts`
- `src/domains/vision/models/image-upload-queue.ts`

## Files to Modify
- `src/domains/vision/services/multi-object-vision-service.ts` - Queue on failure
- `src/app/api/sync/offline-operations/route.ts` - Add image sync

## Acceptance Criteria
- [ ] Compresses images to 80% JPEG quality
- [ ] Stores in IndexedDB with 500MB limit
- [ ] LRU eviction when approaching limit
- [ ] Warns user before evicting (toast/modal)
- [ ] Batches uploads (max 5 concurrent)
- [ ] Shows upload progress per image

## Test Files
**Create:** `src/__tests__/domains/vision/services/image-queue-service.test.ts`

Test cases:
- `queues image when offline`
  - Mock offline state
  - Queue 2MB image
  - Assert stored in IndexedDB
  - Assert metadata preserved
  
- `compresses large images`
  - Input 5MB image
  - Assert output <2MB
  - Assert quality acceptable
  - Assert EXIF preserved
  
- `enforces 500MB limit`
  - Fill queue to 490MB
  - Add 20MB image
  - Assert warning shown
  - Assert oldest evicted
  
- `uploads batch on sync`
  - Queue 10 images
  - Trigger sync
  - Assert max 5 concurrent
  - Assert progress events

**Create:** `src/__tests__/domains/vision/utils/image-compressor.test.ts`

Test cases:
- `maintains aspect ratio`
- `preserves orientation metadata`
- `handles various formats (JPEG, PNG, WebP)`

## Dependencies
- Browser API: IndexedDB, Canvas API
- NPM: `browser-image-compression`

## Queue Interface
```typescript
interface ImageQueueEntry {
  id: string;
  jobId: string;
  checklistItemId?: string;
  image: Blob;
  thumbnail: Blob;
  metadata: {
    originalSize: number;
    compressedSize: number;
    capturedAt: number;
    location?: GeolocationCoordinates;
  };
  uploadAttempts: number;
  priority: 'high' | 'normal';
}

interface QueueStats {
  totalSize: number;
  imageCount: number;
  oldestEntry: Date;
  compressionRatio: number;
}
```

## Storage Management
- Check available quota: `navigator.storage.estimate()`
- Request persistence: `navigator.storage.persist()`
- Monitor usage with 10% buffer