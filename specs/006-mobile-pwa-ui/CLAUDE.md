# CLAUDE.md - Feature 006: Mobile PWA Vision UI

## Feature Context

**Branch**: `006-mobile-pwa-ui`
**Status**: Phase 1 (Design) - Ready for /tasks command
**Dependencies**: Feature 001 (Vision Services), Feature 007 (Offline Infrastructure)

This feature adds a mobile PWA UI layer that integrates existing vision services (YOLO detection, VLM fallback) for real-time equipment verification. It's a **pure frontend integration** with zero new backend code.

## What This Feature Does

Field technicians use their phone camera to verify truck equipment loading. The app:
1. Captures live video feed from phone camera (rear-facing)
2. Runs YOLO detection at 1fps (battery optimized) in Web Worker
3. Displays bounding boxes over detected equipment
4. Auto-checks items in equipment checklist when detected (>70% confidence)
5. Falls back to VLM cloud detection when confidence <70% or after 3 retries
6. Queues verifications locally when offline (200 record limit with FIFO eviction)
7. Auto-syncs to Supabase when network restored
8. Falls back to manual tap-to-verify checklist when camera unavailable

## Architecture Principles

### Reuse Over Rebuild
- ✅ YOLO inference: Use `src/domains/vision/services/yolo-inference.service.ts` (Feature 001)
- ✅ VLM fallback: Use `src/domains/vision/services/vlm-fallback.service.ts` (Feature 001)
- ✅ Offline queue: Extend `src/domains/mobile-pwa/repositories/offline-queue.repository.ts` (Feature 007)
- ✅ Verification storage: Use `src/domains/vision/repositories/vision-verification.repository.ts` (Feature 001)
- ❌ DO NOT create new vision detection services
- ❌ DO NOT create new backend APIs

### Component Boundaries
```
src/app/mobile/equipment-verification/
├── page.tsx                          # Route handler (client component)
├── components/
│   ├── CameraFeed.tsx               # Camera + video element
│   ├── DetectionOverlay.tsx         # SVG bounding boxes
│   ├── EquipmentChecklist.tsx       # Auto-updating checklist
│   ├── ManualChecklistFallback.tsx  # Tap-to-verify mode
│   └── OfflineQueueStatus.tsx       # Queue indicator (200 limit)
├── hooks/
│   ├── useCameraPermissions.ts      # MediaDevices API handling
│   ├── useYOLODetection.ts          # 1fps throttled detection (Web Worker)
│   ├── useVLMFallback.ts            # Cloud fallback trigger
│   └── useVerificationSession.ts    # Session lifecycle
└── services/
    └── verification-workflow.service.ts  # Orchestrates existing services
```

### State Management
- **Session State**: React Context for verification session (not persisted)
- **Camera State**: `useState` for MediaStream, permissions, mode (camera/manual)
- **Detection State**: Web Worker message passing for YOLO results
- **Offline State**: IndexedDB via existing `OfflineQueueRepository`
- **Persistent State**: Supabase via existing repositories (no new tables)

## Critical Implementation Details

### 1. Camera Access Pattern
```typescript
// In useCameraPermissions.ts
const requestCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',  // Rear camera on mobile
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    return { status: 'granted', stream };
  } catch (error) {
    // Auto-fallback to manual mode
    return { status: 'denied', error };
  }
};
```

### 2. 1fps Throttling Pattern
```typescript
// In useYOLODetection.ts
const processFrame = (videoEl: HTMLVideoElement) => {
  const now = performance.now();
  if (now - lastFrameTime.current >= 1000) {  // 1000ms = 1fps
    const imageData = captureFrameToImageData(videoEl);
    workerRef.current.postMessage({ type: 'DETECT', imageData });
    lastFrameTime.current = now;
  }
  requestAnimationFrame(() => processFrame(videoEl));
};
```

**IMPORTANT**: Use `requestAnimationFrame` (not `setInterval`) for precise timing synchronized with display refresh.

### 3. VLM Fallback Trigger Logic
```typescript
// In useVLMFallback.ts
const handleDetectionResult = async (result: DetectionResult) => {
  // Trigger VLM if confidence too low
  if (result.confidence_score < 0.7) {
    return await vlmFallbackService.verify({ photo, expectedItems });
  }

  // Trigger VLM if retries exhausted
  if (result.retry_count >= 3) {
    return await vlmFallbackService.verify({ photo, expectedItems });
  }

  return result;
};
```

### 4. Offline Queue Extension (200 Limit)
```typescript
// Extend existing src/domains/mobile-pwa/repositories/offline-queue.repository.ts
export class OfflineQueueRepository {
  private readonly MAX_QUEUE_SIZE = 200;

  async enqueue(record: VerificationRecord): Promise<void> {
    const count = await this.db.count('verification_queue');

    // FIFO eviction when full
    if (count >= this.MAX_QUEUE_SIZE) {
      const oldestId = await this.getOldestId();
      await this.db.delete('verification_queue', oldestId);
      console.warn('Offline queue full - evicted oldest record');
    }

    await this.db.add('verification_queue', record);
  }

  private async getOldestId(): Promise<string> {
    const cursor = await this.db.transaction('verification_queue')
      .objectStore('verification_queue')
      .openCursor();
    return cursor?.value.id;
  }
}
```

### 5. Partial Detection Handling
```typescript
// In DetectionOverlay.tsx
const isAtEdge = (box: BoundingBox, videoWidth: number, videoHeight: number) => {
  const margin = 50; // pixels from edge
  return (
    box.x < margin ||
    box.y < margin ||
    box.x + box.width > videoWidth - margin ||
    box.y + box.height > videoHeight - margin
  );
};

// In CameraFeed.tsx
{detectedItems.some(item => isAtEdge(item.bounding_box)) && (
  <div className="reposition-prompt">
    ⚠️ Reposition camera to capture full item
  </div>
)}
```

## Testing Strategy

### Unit Tests
```bash
# Test camera permissions handling
src/app/mobile/equipment-verification/__tests__/useCameraPermissions.test.ts

# Test 1fps throttling accuracy
src/app/mobile/equipment-verification/__tests__/useYOLODetection.test.ts

# Test FIFO queue eviction
src/domains/mobile-pwa/__tests__/offline-queue.repository.test.ts
```

### Integration Tests
```bash
# Test full verification workflow (camera → detection → save)
src/app/mobile/equipment-verification/__tests__/verification-workflow.test.tsx

# Test offline queue sync
src/app/mobile/equipment-verification/__tests__/offline-sync.test.tsx
```

### E2E Tests (Playwright)
```bash
# Test complete user flow with camera simulation
src/app/mobile/equipment-verification/__tests__/e2e/equipment-verification-flow.spec.ts
```

## Common Mistakes to Avoid

### ❌ DON'T: Create new vision endpoints
```typescript
// WRONG - Feature 001 endpoints already exist
export async function POST(request: Request) {
  // ... new verification endpoint
}
```

### ✅ DO: Call existing endpoints
```typescript
// CORRECT - Use existing Feature 001 endpoint
const response = await fetch('/api/vision/verify', {
  method: 'POST',
  body: formData
});
```

### ❌ DON'T: Implement YOLO inference in component
```typescript
// WRONG - YOLO logic in React component
const detectEquipment = (imageData) => {
  // ... YOLO inference code
};
```

### ✅ DO: Use Web Worker + existing service
```typescript
// CORRECT - Delegate to Web Worker calling existing service
workerRef.current.postMessage({ type: 'DETECT', imageData });
// Worker internally calls yoloInferenceService.detect(imageData)
```

### ❌ DON'T: Use setInterval for frame processing
```typescript
// WRONG - setInterval doesn't sync with display refresh
setInterval(() => processFrame(video), 1000);
```

### ✅ DO: Use requestAnimationFrame + timing
```typescript
// CORRECT - RAF syncs with display, manual throttle to 1fps
const processFrame = () => {
  if (performance.now() - lastFrame >= 1000) {
    // process frame
  }
  requestAnimationFrame(processFrame);
};
```

### ❌ DON'T: Create new database tables
```typescript
// WRONG - No new tables needed
CREATE TABLE mobile_verifications ...
```

### ✅ DO: Reuse existing tables
```typescript
// CORRECT - Use vision_verification_records from Feature 001
await visionVerificationRepository.create({
  photo_url,
  detected_items,
  verification_status
});
```

## Performance Requirements

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Camera start | <2s | Time from page load to video.srcObject set |
| YOLO inference | <1s | Time from worker.postMessage to worker.onmessage |
| FPS throttle | 1.0 fps ±0.1 | Log `performance.now()` delta between frames |
| Full workflow | <30s | Time from camera start to verification saved |
| Offline queue | 200 records | IndexedDB inspector → verification_queue count |

## Data Retention

**30-Day Auto-Delete**: Implemented via Supabase pg_cron scheduled job (no client-side code needed)

```sql
-- Already implemented in Feature 001 migration
SELECT cron.schedule(
  'delete-old-verifications',
  '0 0 * * *',  -- Daily at midnight
  $$DELETE FROM vision_verification_records WHERE created_at < NOW() - INTERVAL '30 days'$$
);
```

**Offline Queue**: Client-side FIFO eviction when 200 limit reached (no server-side retention needed)

## Integration Points

### Feature 001 (Vision Services)
- **Used**: `YOLOInferenceService`, `VLMFallbackService`, `VisionVerificationService`
- **No Changes**: Reuse as-is
- **Endpoints**: `/api/vision/verify`, `/api/vision/detect`, `/api/vision/vlm-fallback`

### Feature 007 (Offline Infrastructure)
- **Used**: `OfflineQueueRepository`, `OfflineSyncService`
- **Changes**: Add 200-limit + FIFO eviction logic to `enqueue()` method
- **IndexedDB**: `verification_queue` object store

### Jobs Domain (Existing)
- **Used**: Equipment checklist from `job_kits` table
- **No Changes**: Read-only access
- **Query**: Join `job_kits` → `kit_items` to get expected equipment list

## Voice Considerations

**Voice Support**: NONE (Feature 006 is visual-only, no voice interaction)

**Future Voice Integration** (out of scope for Feature 006):
- "Start equipment check" → Open camera page
- "Verify item [name]" → Mark item as verified in manual mode
- "Offline queue status" → Read queue count

## File Complexity Budgets

| File | Max LoC | Rationale |
|------|---------|-----------|
| page.tsx | 200 | Route handler + layout only |
| CameraFeed.tsx | 300 | Camera setup + video element |
| useYOLODetection.ts | 400 | Web Worker setup + throttle logic |
| verification-workflow.service.ts | 500 | Orchestration of multiple services |
| All other components | 200 | Single responsibility |

## Environment Variables

**Required** (from Feature 001):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (for VLM fallback)

**No New Variables**: Feature 006 uses same environment as Feature 001

## Quick Commands

```bash
# Start development
npm run dev

# Run unit tests
npm run test -- src/app/mobile/equipment-verification

# Run E2E tests
npm run test:e2e -- equipment-verification-flow.spec.ts

# Check database schema (verify Feature 001 tables exist)
npm run check:db-actual

# Generate implementation tasks
/tasks  # Run this command after /plan completes
```

## Current Status

- ✅ Phase 0: Research complete (research.md)
- ✅ Phase 1: Design complete (data-model.md, contracts, quickstart.md)
- ⏳ Phase 2: Task generation (ready for /tasks command)
- ⏳ Phase 3: Implementation
- ⏳ Phase 4: Testing
- ⏳ Phase 5: Production deployment

## Next Step

Run `/tasks` to generate ordered, dependency-aware implementation task breakdown from the design documents.
