# Task: YOLO Model Loader Service

**Slug:** `vision-001-yolo-model-loader`
**Priority:** High
**Size:** 1 PR

## Description
Create a service to load and cache YOLOv11n ONNX models in IndexedDB for offline inference.

## Files to Create
- `src/domains/vision/services/yolo-model-loader.ts`
- `src/domains/vision/types/yolo-types.ts`
- `src/domains/vision/constants/model-config.ts`

## Files to Modify
- None (new functionality)

## Acceptance Criteria
- [ ] YOLOv11n ONNX model downloads from CDN on first use
- [ ] Model cached in IndexedDB (max 100MB)
- [ ] Cache checked before download attempt
- [ ] Model loads successfully for inference
- [ ] Progress callback during download (0-100%)
- [ ] Error handling for network failures

## Test Files
**Create:** `src/__tests__/domains/vision/services/yolo-model-loader.test.ts`

Test cases:
- `downloads model when cache empty`
  - Mock fetch response with ONNX blob
  - Assert IndexedDB contains model after download
  - Assert progress callbacks fired
  
- `loads from cache when available`
  - Pre-populate IndexedDB with model
  - Assert no network request made
  - Assert model loaded from cache
  
- `handles download failure gracefully`
  - Mock fetch to reject
  - Assert error thrown with descriptive message
  - Assert cache remains empty
  
- `respects 100MB storage limit`
  - Attempt to store >100MB model
  - Assert storage error thrown
  - Assert old cache cleared if needed

## Dependencies
- None

## Configuration
```typescript
// src/domains/vision/constants/model-config.ts
export const YOLO_CONFIG = {
  modelUrl: process.env.NEXT_PUBLIC_YOLO_MODEL_URL || 'https://cdn.example.com/yolov11n.onnx',
  cacheKey: 'yolo-model-v11n',
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  dbName: 'jobeye-vision',
  storeName: 'models'
};
```