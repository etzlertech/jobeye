# Task: YOLO Inference Engine

**Slug:** `vision-002-yolo-inference-engine`
**Priority:** High
**Size:** 1 PR

## Description
Implement YOLO inference using ONNX Runtime Web with 1fps frame processing and confidence scoring.

## Files to Create
- `src/domains/vision/services/yolo-inference-engine.ts`
- `src/domains/vision/utils/image-preprocessor.ts`
- `src/domains/vision/utils/detection-postprocessor.ts`

## Files to Modify
- `src/domains/vision/services/multi-object-vision-service.ts` - Integrate YOLO inference

## Acceptance Criteria
- [ ] Processes 640x640 images through YOLO model
- [ ] Returns detections with bounding boxes and confidence scores
- [ ] Inference completes in <1s on mobile devices
- [ ] Supports batch processing (up to 4 images)
- [ ] Non-max suppression applied to remove duplicates
- [ ] Class names mapped to human-readable labels

## Test Files
**Create:** `src/__tests__/domains/vision/services/yolo-inference-engine.test.ts`

Test cases:
- `detects objects in test image`
  - Load test image with known objects
  - Assert detections include expected classes
  - Assert confidence scores between 0-1
  - Assert bounding boxes within image bounds
  
- `completes inference within 1 second`
  - Time inference on 640x640 image
  - Assert duration <1000ms
  - Test on multiple device profiles
  
- `applies non-max suppression`
  - Input image with overlapping objects
  - Assert duplicate detections removed
  - Assert highest confidence kept
  
- `handles batch inference`
  - Process 4 images in batch
  - Assert all images processed
  - Assert results array matches input length

**Create:** `src/__tests__/domains/vision/utils/image-preprocessor.test.ts`

Test cases:
- `resizes images to 640x640`
- `normalizes pixel values to 0-1`
- `maintains aspect ratio with padding`

## Dependencies
- `vision-001-yolo-model-loader` - Model must be loaded first
- NPM: `onnxruntime-web@1.16.3`

## Performance Targets
- P50 latency: <500ms
- P95 latency: <1000ms
- P99 latency: <1500ms