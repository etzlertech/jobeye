# Task: Camera Capture UI Component

**Slug:** `ocr-012-camera-capture-ui`
**Priority:** High
**Size:** 1 PR

## Description
Create camera capture component with guide overlay, multi-capture support, and offline queuing.

## Files to Create
- `src/components/ocr/capture/camera-capture.tsx`
- `src/components/ocr/capture/capture-guide-overlay.tsx`
- `src/hooks/use-camera-stream.ts`

## Files to Modify
- `src/app/ocr/capture/page.tsx` - Add route

## Acceptance Criteria
- [ ] Shows camera preview with guide corners
- [ ] Auto-captures when document stable
- [ ] Manual capture button available
- [ ] Flash toggle for low light
- [ ] Multi-capture mode (batch receipts)
- [ ] Shows capture count badge
- [ ] Works offline with queue indicator
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/components/ocr/capture/camera-capture.test.tsx`

Test cases:
- `requests camera permission`
  - Mount component
  - Assert getUserMedia called
  - Assert permission prompt shown
  
- `shows guide overlay`
  - Start camera
  - Assert corner guides visible
  - Assert "Align document" text
  
- `captures on stability`
  - Mock stable video frame
  - Wait 2 seconds
  - Assert auto-capture triggered
  
- `handles multi-capture`
  - Enable batch mode
  - Capture 3 images
  - Assert count badge = 3

**Create:** `src/__tests__/hooks/use-camera-stream.test.ts`

Test cases:
- `handles permission denied`
- `cleans up on unmount`
- `switches cameras`

## Dependencies
- Media stream API
- Existing offline queue

## UI Layout
```
+---------------------------+
| [Back] OCR Capture [Flash]|
+---------------------------+
|                           |
| +-----+         +-----+   |
| |     |         |     |   |
| |     | Preview |     |   |
| |     |         |     |   |
| +-----+         +-----+   |
|                           |
|   Align document inside   |
|         frame             |
|                           |
| [====Capture====] (3)     |
+---------------------------+
```

## Capture Logic
```typescript
interface CaptureState {
  stream: MediaStream | null;
  isStable: boolean;
  captureCount: number;
  flashEnabled: boolean;
  mode: 'single' | 'batch';
}

// Auto-capture when stable for 2s
// Manual capture always available
// In batch mode, continue after each capture
```

## Rollback
- Fallback to file upload
- Disable camera features