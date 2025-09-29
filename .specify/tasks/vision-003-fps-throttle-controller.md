# Task: FPS Throttle Controller

**Slug:** `vision-003-fps-throttle-controller`
**Priority:** High
**Size:** 1 PR

## Description
Implement 1fps camera capture throttling with frame skip logic when processing exceeds 1.5s.

## Files to Create
- `src/domains/vision/hooks/use-camera-capture.ts`
- `src/domains/vision/services/fps-controller.ts`
- `src/domains/vision/types/capture-types.ts`

## Files to Modify
- `src/components/vision/camera-capture.tsx` - Use new hook

## Acceptance Criteria
- [ ] Captures frames at steady 1fps rate (±100ms tolerance)
- [ ] Skips frames when processing time >1.5s
- [ ] Shows "Re-check" button after frame skip
- [ ] Maintains capture rate in background tabs
- [ ] Provides capture statistics (fps, skipped frames)
- [ ] Cleans up resources on unmount

## Test Files
**Create:** `src/__tests__/domains/vision/hooks/use-camera-capture.test.ts`

Test cases:
- `captures at 1fps rate`
  - Mock getUserMedia and video element
  - Measure time between onFrame callbacks
  - Assert 900-1100ms between frames
  
- `skips frames during slow processing`
  - Simulate processing delay >1.5s
  - Assert next frame skipped
  - Assert skip counter incremented
  
- `shows recheck button after skip`
  - Trigger frame skip
  - Assert recheckAvailable flag true
  - Assert manual capture works
  
- `maintains rate in background`
  - Simulate page visibility change
  - Assert capture continues (using Worker)
  - Assert no rate degradation

**Create:** `src/__tests__/domains/vision/services/fps-controller.test.ts`

Test cases:
- `throttles callback execution`
- `tracks frame statistics`
- `handles cleanup on stop`

## Dependencies
- Browser APIs: getUserMedia, requestAnimationFrame

## Hook Interface
```typescript
interface UseCameraCapture {
  isCapturing: boolean;
  stats: CaptureStats;
  recheckAvailable: boolean;
  startCapture: (onFrame: FrameCallback) => void;
  stopCapture: () => void;
  triggerRecheck: () => void;
}

interface CaptureStats {
  fps: number;
  framesProcessed: number;
  framesSkipped: number;
  avgProcessingTime: number;
}
```