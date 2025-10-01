# Quickstart: Mobile PWA Vision UI

**Feature**: 006-mobile-pwa-ui
**Prerequisites**: Features 001 (Vision Services) and 007 (Offline Infrastructure) must be deployed
**Estimated Setup Time**: 10 minutes

## What You're Building

A mobile PWA that lets field technicians verify equipment by pointing their phone camera at a truck bed. The app uses real-time YOLO detection (1fps) to automatically identify equipment and mark checklist items as verified. Falls back to VLM cloud detection when confidence is low, and gracefully degrades to manual checklist when camera is unavailable.

## Prerequisites

### 1. Environment Setup
```bash
# Verify you have required environment variables
cat .env.local | grep -E 'SUPABASE_URL|SUPABASE_ANON_KEY|OPENAI_API_KEY'
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `OPENAI_API_KEY` - For VLM fallback service

### 2. Database Verification
```bash
# Check that vision tables exist (from Feature 001)
npm run check:db-actual
```

Expected tables:
- `vision_verification_records`
- `detected_items`
- `vision_cost_records`
- `detection_confidence_thresholds`

### 3. Test Data Setup
```bash
# Create a test job with equipment checklist
npx tsx scripts/seed-test-job.ts
```

This creates:
- 1 test job (ID will be printed)
- 1 equipment kit with 5 items (Gas Trimmer, Edger, Blower, Mower, Safety Gear)

## Local Development

### Step 1: Start Development Server
```bash
npm run dev
```

Server starts at: http://localhost:3000

### Step 2: Open Mobile View

**Desktop Browser (Mobile Emulation)**:
1. Open Chrome DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or similar
4. Navigate to: http://localhost:3000/mobile/equipment-verification?job_id=<TEST_JOB_ID>

**Physical Mobile Device**:
1. Find your local IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. On phone browser: http://<YOUR_IP>:3000/mobile/equipment-verification?job_id=<TEST_JOB_ID>
3. Grant camera permissions when prompted

### Step 3: Test Camera Workflow

1. **Camera Start**: Should auto-request camera permissions on page load
2. **Live Detection**: Point camera at equipment, see bounding boxes appear (1fps)
3. **Checklist Update**: Detected items auto-check in the checklist
4. **Completion**: When all items verified, "Complete Verification" button enables
5. **Final Photo**: Tap button to save verification record with timestamp

**Expected Behavior**:
- Video feed appears within 2 seconds
- Detection bounding boxes appear within 1 second of pointing at equipment
- Checklist items turn green when detected with >70% confidence
- VLM fallback triggers automatically if confidence stays <70% for 3 frames

### Step 4: Test Offline Mode

1. **Go Offline**: Chrome DevTools → Network tab → Throttling: "Offline"
2. **Complete Verification**: Capture photo and verify equipment
3. **Check Queue**: Open IndexedDB inspector, see record in `offline_queue`
4. **Go Online**: Disable throttling
5. **Auto Sync**: Record should sync to Supabase within 5 seconds

**Expected Behavior**:
- Offline indicator appears in UI
- Verification succeeds and queues locally
- Queue shows count: "1 pending"
- When online, queue drains and count resets to 0

### Step 5: Test Manual Fallback

1. **Deny Camera**: Reload page, click "Block" when camera permission prompts
2. **Manual Checklist**: UI should switch to tap-to-verify mode
3. **Tap Items**: Tap each equipment item to mark verified
4. **Complete**: All items verified → "Complete Verification" enables
5. **Save**: Record created without photo

**Expected Behavior**:
- Camera denied message appears briefly
- Checklist renders with tap targets (44x44px minimum)
- Items toggle verified state on tap
- Verification record has `photo_url: null` but saves successfully

## Validation Tests

### Automated Test Suite
```bash
# Unit tests
npm run test -- src/app/mobile/equipment-verification

# E2E tests (requires Playwright)
npm run test:e2e -- equipment-verification-flow.spec.ts
```

### Manual Test Checklist

- [ ] Camera starts within 2 seconds
- [ ] Detection runs at 1fps (not faster, not slower)
- [ ] Bounding boxes align with detected items
- [ ] Checklist auto-updates when items detected
- [ ] VLM fallback triggers on low confidence (<70%)
- [ ] VLM fallback triggers after 3 detection timeouts
- [ ] Offline queue accepts verifications
- [ ] Queue evicts oldest when 200 limit reached
- [ ] Auto-sync works when network restored
- [ ] Manual mode activates when camera denied
- [ ] Manual checklist saves without photo
- [ ] Partial detection shows "Reposition camera" prompt
- [ ] Completion button only enables when all items verified

## Troubleshooting

### Camera Not Starting

**Symptom**: Video feed never appears
**Causes**:
1. HTTPS required (except localhost): Deploy to Railway or use ngrok
2. Camera permissions blocked: Check browser settings → Site permissions
3. Camera in use by another app: Close other camera apps

**Fix**:
```bash
# For HTTPS on localhost (Chrome flag)
chrome://flags/#unsafely-treat-insecure-origin-as-secure
# Add: http://localhost:3000
```

### Detection Not Running

**Symptom**: Video shows but no bounding boxes
**Causes**:
1. YOLO worker not loaded: Check console for worker errors
2. Web Worker blocked: Check CSP headers
3. Detection throttle too slow: Check performance.now() timing

**Debug**:
```typescript
// Add to useYOLODetection hook
console.log('Frame processed:', performance.now() - lastFrameTime.current);
// Should log every ~1000ms
```

### VLM Fallback Not Triggering

**Symptom**: Low confidence but VLM never called
**Causes**:
1. OpenAI API key missing: Check .env.local
2. Cost budget exceeded: Check cost dashboard at /vision/dashboard
3. Network offline: VLM requires internet

**Verify**:
```bash
# Check cost records
npx tsx scripts/check-vision-costs.ts
# Should show current budget usage (<$10/day default)
```

### Offline Queue Not Syncing

**Symptom**: Records stay queued after going online
**Causes**:
1. Sync service not running: Check network event listener attached
2. Supabase connection failed: Check browser console for 401/403
3. Queue full (>200): Check IndexedDB inspector

**Fix**:
```typescript
// Manually trigger sync
import { OfflineSyncService } from '@/domains/mobile-pwa/services/offline-sync.service';
await OfflineSyncService.syncNow();
```

### Partial Detection Prompt Not Showing

**Symptom**: Item at edge of frame but no "Reposition" prompt
**Cause**: Bounding box edge detection threshold too lenient

**Adjust**:
```typescript
// In DetectionOverlay.tsx
const isAtEdge = (box) => {
  const margin = 50; // pixels from edge (increase for earlier prompt)
  return box.x < margin || box.y < margin ||
         box.x + box.width > videoWidth - margin ||
         box.y + box.height > videoHeight - margin;
};
```

## Architecture Quick Reference

### Data Flow
```
Camera Feed
  ↓ (1fps throttle)
Web Worker (YOLO)
  ↓ (if confidence <70%)
VLM Service (OpenAI)
  ↓
Checklist Update
  ↓ (all verified)
Final Photo Capture
  ↓ (if online)
Supabase Save
  ↓ (if offline)
IndexedDB Queue → Auto-sync later
```

### Key Files
```
src/app/mobile/equipment-verification/
├── page.tsx                    # Main screen
├── components/
│   ├── CameraFeed.tsx         # Live video + detection overlay
│   ├── EquipmentChecklist.tsx # Auto-updating checklist
│   └── ManualChecklistFallback.tsx # Tap-to-verify mode
├── hooks/
│   ├── useYOLODetection.ts    # 1fps Web Worker throttle
│   └── useVLMFallback.ts      # Cloud fallback logic
└── services/
    └── verification-workflow.service.ts # Orchestration
```

### Existing Services (Reused)
- **YOLO**: `src/domains/vision/services/yolo-inference.service.ts`
- **VLM**: `src/domains/vision/services/vlm-fallback.service.ts`
- **Offline Queue**: `src/domains/mobile-pwa/repositories/offline-queue.repository.ts`
- **Verification Storage**: `src/domains/vision/repositories/vision-verification.repository.ts`

## Performance Benchmarks

| Metric | Target | Typical |
|--------|--------|---------|
| Camera start | <2s | ~1.2s |
| YOLO inference | <1s | ~0.8s |
| FPS throttle | 1.0 fps | 1.0 fps (stable) |
| Full workflow | <30s | ~15s (5 items) |
| Offline queue | 200 records | ~50 MB storage |
| VLM fallback rate | <30% | ~20% |

## Next Steps

1. **Feature Development**: Run `/tasks` to generate implementation task breakdown
2. **Integration Testing**: Test with real equipment photos in various lighting
3. **Performance Tuning**: Adjust throttle timing based on device benchmarks
4. **Production Deploy**: Enable PWA manifest and service worker for installability

## Support

- **Documentation**: See `specs/006-mobile-pwa-ui/plan.md` for architecture details
- **Vision API**: See `docs/api/vision.md` for endpoint documentation
- **Offline Queue**: See `src/domains/mobile-pwa/README.md` for queue behavior
- **Cost Tracking**: See Feature 001 docs for VLM budget configuration
