# Feature 006: VLM-First Detection Plan

## Problem Statement

Current implementation assumes YOLO is available in browser, but:
1. YOLO service is a placeholder (not implemented)
2. YOLO requires 6MB+ model download
3. YOLO may not work in all browsers (WebGL requirements)
4. Current flow waits for YOLO to fail 3x before using VLM

**Reality**: In production, VLM must be the primary detection method for browser-based deployment.

## Current vs Needed Architecture

### Current (Broken)
```
Camera Feed → YOLO Detection (fails)
  ↓ (after 3 retries or <70% confidence)
VLM Fallback → Detection Results
```

### Needed (VLM-First)
```
Camera Feed → Check YOLO Available?
  ├─ Yes → YOLO Detection → [if confidence < 70%] → VLM
  └─ No  → VLM Detection (primary)
```

## VLM Capabilities Assessment

### ✅ What VLM Already Supports

1. **Object Detection**: Identifies equipment/tools with labels
2. **Confidence Scores**: Returns 0.0-1.0 confidence per item
3. **Bounding Boxes**: Can provide coordinates via prompt (currently disabled)
4. **Reasoning**: Explains what it sees for each detection
5. **Expected Items Matching**: Compares against checklist
6. **Cost Tracking**: ~$0.10 per image with usage metrics

### ⚠️ Current Limitations

1. **Performance**: 2-5 seconds per API call (vs YOLO's <1s)
2. **Cost**: $0.10/image = $6/min at 1fps (need rate limiting)
3. **Rate Limits**: OpenAI has request limits (need queue)
4. **Bounding Boxes**: Not enabled by default (`includeBboxes: false`)
5. **No Retry Logic**: Fails permanently on API errors

## Required Changes

### 1. Add YOLO Availability Detection

**File**: `src/app/mobile/equipment-verification/hooks/useYOLODetection.ts`

```typescript
// Add to hook
const [yoloAvailable, setYoloAvailable] = useState<boolean>(false);

useEffect(() => {
  const checkYOLOAvailable = async () => {
    try {
      // Attempt to initialize YOLO model
      const available = await yoloService.checkModelAvailable();
      setYoloAvailable(available);
    } catch {
      setYoloAvailable(false);
    }
  };
  checkYOLOAvailable();
}, []);

// Export in return
return {
  // ... existing fields
  yoloAvailable,
};
```

### 2. Create VLM-First Detection Hook

**New File**: `src/app/mobile/equipment-verification/hooks/useVLMDetection.ts`

```typescript
export function useVLMDetection(options: VLMDetectionOptions = {}): VLMDetectionResult {
  const {
    expectedItems = [],
    enabled = true,
    targetFps = 1.0, // Default 1fps, allow 2fps for complex scenes
  } = options;

  const [detectionResults, setDetectionResults] = useState<DetectedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vlmService = new VLMFallbackService();
  const lastFrameTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Process frame at targetFps (1-2fps)
  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    const now = performance.now();
    const interval = 1000 / targetFps;

    if (now - lastFrameTimeRef.current >= interval) {
      const imageData = captureFrame(videoElement);

      if (imageData && !isProcessing) {
        setIsProcessing(true);

        try {
          const result = await vlmService.verify({
            photo: imageDataToBase64(imageData),
            expectedItems,
            includeBboxes: true, // Enable bounding boxes
          });

          setDetectionResults(result.detectedItems);
          setError(null);
        } catch (err: any) {
          setError(err.message);
          console.error('[useVLMDetection] Error:', err);
        } finally {
          setIsProcessing(false);
        }
      }

      lastFrameTimeRef.current = now;
    }

    rafIdRef.current = requestAnimationFrame(() => processFrame(videoElement));
  }, [targetFps, expectedItems, isProcessing]);

  return {
    detectionResults,
    isProcessing,
    error,
    startDetection,
    stopDetection,
  };
}
```

### 3. Update Main Page Detection Logic

**File**: `src/app/mobile/equipment-verification/page.tsx`

```typescript
// Replace current hook usage
const yolo = useYOLODetection({ enabled: false }); // Disable YOLO stub
const vlm = useVLMDetection({
  expectedItems: session.checklist.map(i => i.name),
  targetFps: 1.0, // Start at 1fps
  enabled: camera.permission === 'granted'
});

// Use VLM results instead of YOLO
useEffect(() => {
  if (vlm.detectionResults.length > 0) {
    session.updateChecklist(vlm.detectionResults);

    // Haptic feedback on detection
    if (navigator.vibrate) navigator.vibrate(50);
  }
}, [vlm.detectionResults]);

// Start VLM detection when camera ready
useEffect(() => {
  if (videoStream && videoRef.current) {
    vlm.startDetection(videoRef.current);
  }
  return () => vlm.stopDetection();
}, [videoStream]);
```

### 4. Enable VLM Bounding Boxes

**File**: `src/domains/vision/services/vlm-fallback.service.ts`

```typescript
// Line 84: Change default
const {
  model = 'gpt-4o',
  maxTokens = 1500,
  includeBboxes = true, // Enable by default for mobile UI
} = options;

// Enhance prompt for better bbox accuracy
if (includeBboxes) {
  prompt += `\n\nFor each item, provide precise bounding box as:
{
  "x": <percentage from left edge>,
  "y": <percentage from top edge>,
  "width": <percentage of image width>,
  "height": <percentage of image height>
}
Example: {"x": 25, "y": 30, "width": 15, "height": 20}`;
}
```

### 5. Add Rate Limiting for Cost Control

**New File**: `src/app/mobile/equipment-verification/lib/vlm-rate-limiter.ts`

```typescript
export class VLMRateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minIntervalMs = 1000; // Max 1 request/sec = $6/min max
  private dailyCount = 0;
  private readonly dailyLimit = 100; // $10/day budget

  async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.dailyCount >= this.dailyLimit) {
      throw new Error('Daily VLM budget exceeded ($10)');
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minIntervalMs) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minIntervalMs - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
    this.dailyCount++;

    return await fn();
  }

  resetDaily() {
    this.dailyCount = 0;
  }
}
```

### 6. Improve VLM Error Handling

**File**: `src/app/mobile/equipment-verification/hooks/useVLMDetection.ts`

```typescript
// Add retry logic with exponential backoff
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // ms

async function detectWithRetry(imageData: ImageData, attempt = 0): Promise<DetectionResult> {
  try {
    return await vlmService.verify({ photo: imageDataToBase64(imageData), expectedItems });
  } catch (error: any) {
    if (attempt < MAX_RETRIES) {
      console.warn(`[VLM] Retry ${attempt + 1}/${MAX_RETRIES} after error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      return detectWithRetry(imageData, attempt + 1);
    }
    throw error;
  }
}
```

## Performance Optimization

### Adaptive FPS Based on Scene Complexity

```typescript
// Start at 1fps, increase to 2fps if detections are empty
const [targetFps, setTargetFps] = useState(1.0);

useEffect(() => {
  if (vlm.detectionResults.length === 0 && !vlm.isProcessing) {
    // No detections - might be complex scene, increase to 2fps
    setTargetFps(2.0);
  } else if (vlm.detectionResults.length > 0) {
    // Got detections - back to 1fps to save costs
    setTargetFps(1.0);
  }
}, [vlm.detectionResults, vlm.isProcessing]);
```

### Batch Multiple Frames

```typescript
// Instead of sending every frame, accumulate and send best quality frame
const frameBuffer: ImageData[] = [];

function processFrame(video: HTMLVideoElement) {
  frameBuffer.push(captureFrame(video));

  if (frameBuffer.length >= 3) { // Collect 3 frames
    const bestFrame = selectSharpestFrame(frameBuffer); // Use variance/laplacian
    sendToVLM(bestFrame);
    frameBuffer.length = 0;
  }
}
```

## Testing Requirements

### Unit Tests
- [ ] Test VLM availability detection
- [ ] Test rate limiter enforces 1 req/sec
- [ ] Test daily budget limit ($10 = 100 requests)
- [ ] Test retry logic with exponential backoff
- [ ] Test bounding box parsing from VLM response

### Integration Tests
- [ ] Test VLM-first detection flow (camera → VLM → results)
- [ ] Test 1fps throttling accuracy
- [ ] Test 2fps adaptive mode for complex scenes
- [ ] Test bounding box rendering on video overlay
- [ ] Test cost tracking accumulation

### Manual Testing
- [ ] Test on iOS Safari (primary target)
- [ ] Test on Chrome Android
- [ ] Test with poor network (slow API responses)
- [ ] Test with API errors (rate limit, timeout)
- [ ] Test daily budget limit behavior

## Cost Analysis

### Current Implementation
```
YOLO Primary: $0/image (free, but doesn't work)
VLM Fallback: $0.10/image (rarely reached)
Expected Daily Cost: $0 (because YOLO fails)
```

### VLM-First Implementation
```
VLM Primary at 1fps:
- 1 frame/sec × 60 sec = 60 frames/min
- At $0.10/frame = $6/min
- 10 min active use/day = $60/day ⚠️ TOO HIGH

With rate limiting (1 req/sec max):
- 1 frame/sec = 60 frames/min
- But only send when needed (item changes detected)
- Realistic: 10-20 requests/verification session
- Cost: $1-$2 per session
- 10 sessions/day = $10-$20/day ✅ Acceptable
```

### Cost Optimization Strategies

1. **Smart Frame Selection**: Only send frames when motion detected
2. **Caching**: Don't re-detect same items repeatedly
3. **Batch Verification**: Verify entire checklist at once (1 API call)
4. **Progressive Enhancement**: Start with low-cost object detection, upgrade to VLM only for uncertain items

## Migration Path

### Phase 1: VLM-First (Immediate)
- Disable YOLO stub
- Route all detection through VLM
- Enable bounding boxes
- Add rate limiting
- Test at 1fps

### Phase 2: Optimize (Week 2)
- Add adaptive FPS (1-2fps)
- Implement smart frame selection
- Add detection result caching
- Optimize prompts for faster responses

### Phase 3: Hybrid (Future)
- Implement actual YOLO for devices that support it
- Keep VLM as guaranteed fallback
- Auto-detect device capability
- Use YOLO when available, VLM otherwise

## Success Criteria

- [ ] VLM detection works at 1fps consistently
- [ ] Bounding boxes render correctly on video
- [ ] Daily cost stays under $20
- [ ] Detection latency < 5 seconds per frame
- [ ] Works on iOS Safari and Chrome Android
- [ ] Graceful degradation on API errors
- [ ] Clear UI feedback during processing

## Estimated Effort

- **Implementation**: 4-6 hours
- **Testing**: 2-3 hours
- **Documentation**: 1 hour
- **Total**: 1 day

## Priority: HIGH

**Rationale**: Current implementation is non-functional for browser deployment. VLM-first is the only viable path for MVP.
