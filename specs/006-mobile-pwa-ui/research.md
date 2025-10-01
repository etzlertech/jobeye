# Research: Mobile PWA Vision UI

**Feature**: 006-mobile-pwa-ui
**Date**: 2025-09-30
**Status**: Complete

## Research Questions

### 1. MediaDevices API Camera Access Patterns
**Decision**: Use `navigator.mediaDevices.getUserMedia()` with facingMode: 'environment'
**Rationale**:
- Standard API supported in iOS Safari 14.3+, Chrome Android 90+
- Provides rear camera by default on mobile devices
- Handles permissions gracefully with try/catch
- Works in PWA installed context

**Best Practices**:
- Request permissions on user action (button tap), not page load
- Fallback to manual checklist on permission denial
- Handle camera hardware failures gracefully
- Stop streams when component unmounts to preserve battery

**Alternatives Considered**:
- WebRTC: Overkill for single camera feed
- Native camera plugins: Breaks PWA portability

### 2. 1fps YOLO Processing Throttle
**Decision**: Use Web Workers + requestAnimationFrame throttling
**Rationale**:
- Web Worker isolates YOLO inference from UI thread
- `requestAnimationFrame` provides precise frame timing
- Throttle to 1fps = every 1000ms prevents battery drain
- Existing YOLO inference service already optimized for web

**Implementation Pattern**:
```typescript
const useYOLODetection = () => {
  const workerRef = useRef<Worker>();
  const lastFrameTime = useRef(0);

  const processFrame = (videoEl: HTMLVideoElement) => {
    const now = performance.now();
    if (now - lastFrameTime.current >= 1000) {  // 1fps = 1000ms
      const imageData = captureFrameToImageData(videoEl);
      workerRef.current.postMessage({ type: 'DETECT', imageData });
      lastFrameTime.current = now;
    }
    requestAnimationFrame(() => processFrame(videoEl));
  };
};
```

**Alternatives Considered**:
- setInterval: Less precise timing, doesn't sync with display refresh
- Higher fps (5-10): Drains battery, no accuracy improvement for static equipment

### 3. IndexedDB Offline Queue (200 Record Limit)
**Decision**: Extend existing `offline-queue.repository.ts` with FIFO eviction
**Rationale**:
- Feature 007 already implements IndexedDB queue
- Add `maxSize: 200` configuration
- FIFO eviction: delete oldest when inserting 201st record
- Existing sync mechanism handles network restoration

**Extension Pattern**:
```typescript
// In offline-queue.repository.ts
export class OfflineQueueRepository {
  private readonly MAX_QUEUE_SIZE = 200;

  async enqueue(record: VerificationRecord): Promise<void> {
    const count = await this.db.count('verification_queue');
    if (count >= this.MAX_QUEUE_SIZE) {
      await this.db.delete('verification_queue', await this.getOldestId());
    }
    await this.db.add('verification_queue', record);
  }
}
```

**Alternatives Considered**:
- Priority queue: Overkill for chronological verifications
- Compression: Adds complexity, photos already JPEG compressed

### 4. VLM Fallback Integration
**Decision**: Reuse existing `vlm-fallback.service.ts` from Feature 001
**Rationale**:
- Service already implements <70% confidence threshold
- Handles OpenAI GPT-4 Vision API calls
- Cost tracking built-in
- Retry logic (3x) matches clarified requirement

**Integration Point**:
```typescript
// In verification-workflow.service.ts
const detectionResult = await yoloService.detectFrame(imageData);

if (detectionResult.confidence < 0.7) {
  const vlmResult = await vlmFallbackService.verify({
    photo: imageData,
    expectedItems: checklist.items
  });
  return vlmResult;
}
```

**No Changes Needed**: Existing service already handles retry + fallback logic

### 5. Manual Checklist Fallback UI
**Decision**: Tap-to-toggle boolean state per checklist item
**Rationale**:
- Simple boolean: `verified: true/false` per item
- No photo capture when in manual mode (camera unavailable)
- Matches existing checklist data model
- Accessible touch targets (44x44px minimum)

**UI Pattern**:
```typescript
<div className="checklist-item" onClick={() => toggleItem(item.id)}>
  <span className={item.verified ? 'verified' : 'unverified'}>
    {item.verified ? '✓' : '○'} {item.name}
  </span>
</div>
```

**Alternatives Considered**:
- Photo upload from gallery: Adds complexity, camera already best option
- Voice confirmation: Out of scope for this feature

### 6. 30-Day Auto-Delete Retention
**Decision**: Supabase scheduled function with `pg_cron`
**Rationale**:
- Runs daily at midnight: `DELETE FROM vision_verification_records WHERE created_at < NOW() - INTERVAL '30 days'`
- Centralized: handles all tenants in single query
- Reliable: survives client offline periods
- No client-side logic needed

**Implementation**:
```sql
-- In Supabase SQL Editor (one-time setup)
SELECT cron.schedule(
  'delete-old-verifications',
  '0 0 * * *',  -- Daily at midnight
  $$DELETE FROM vision_verification_records WHERE created_at < NOW() - INTERVAL '30 days'$$
);
```

**Alternatives Considered**:
- Client-side deletion: Unreliable (device offline)
- Manual deletion: Violates compliance requirement

## Technology Decisions Summary

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Camera Access | MediaDevices API | Standard, PWA-compatible, iOS/Android support |
| YOLO Throttling | Web Workers + RAF | Battery efficient, UI thread isolation |
| Offline Queue | IndexedDB (extend existing) | Reuse Feature 007, FIFO eviction logic |
| VLM Fallback | Existing service (Feature 001) | No changes needed, retry built-in |
| Manual Fallback | React state toggle | Simple, accessible, no camera dependency |
| Auto-Delete | Supabase pg_cron | Centralized, reliable, compliant |

## Dependencies Resolved

**No new external dependencies required**:
- ✅ YOLO: Existing Feature 001 service
- ✅ VLM: Existing Feature 001 service
- ✅ Offline: Existing Feature 007 infrastructure
- ✅ Camera: Browser MediaDevices API (native)
- ✅ Storage: Supabase + IndexedDB (existing)

**Only new code**: React UI components + workflow orchestration service (~500 LOC)

## Risk Assessment

**Low Risk Areas**:
- ✅ YOLO integration (already tested in Feature 001)
- ✅ VLM fallback (already tested in Feature 001)
- ✅ Offline sync (already tested in Feature 007)

**Medium Risk Areas**:
- ⚠️ Camera permissions on iOS Safari (test thoroughly)
- ⚠️ Web Worker performance on low-end devices (throttle may need tuning)

**Mitigation**:
- E2E test suite with camera simulation
- Performance benchmarking on target devices (iPhone 12+, Pixel 5+)
- Graceful degradation to manual checklist

## Next Phase

**Ready for Phase 1**: Design contracts and data model
- No unknowns remain
- All technologies validated
- Integration points identified
