# Task: Tesseract.js Local OCR Service

**Slug:** `ocr-006-tesseract-service`
**Priority:** High
**Size:** 1 PR

## Description
Implement local OCR processing using Tesseract.js with worker pool and IndexedDB caching.

## Files to Create
- `src/domains/ocr/services/tesseract-ocr-service.ts`
- `src/domains/ocr/utils/image-preprocessor.ts`
- `src/domains/ocr/config/tesseract-config.ts`

## Files to Modify
- `public/service-worker.js` - Add Tesseract worker caching

## Acceptance Criteria
- [ ] Initializes 2-4 worker pool based on CPU
- [ ] Downloads and caches language data in IndexedDB
- [ ] Preprocesses images (deskew, enhance contrast)
- [ ] Returns text with confidence scores
- [ ] Handles worker crashes gracefully
- [ ] Supports progress callbacks
- [ ] Works fully offline after initial setup
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/tesseract-ocr-service.test.ts`

Test cases:
- `initializes worker pool`
  - Create service
  - Assert 2-4 workers created
  - Assert language data cached
  
- `processes receipt image`
  - Load test receipt image
  - Process with Tesseract
  - Assert text extracted
  - Assert confidence >0.7
  
- `handles worker failure`
  - Kill worker mid-process
  - Assert job reassigned
  - Assert completes successfully
  
- `reports progress`
  - Process large image
  - Assert progress callbacks fired
  - Assert 0-100% range

**Create:** `src/__tests__/domains/ocr/utils/image-preprocessor.test.ts`

Test cases:
- `deskews rotated image`
- `enhances low contrast`
- `handles various formats`

## Dependencies
- NPM: `tesseract.js@5.x`

## Configuration
```typescript
interface TesseractConfig {
  workerCount: number; // 2-4 based on navigator.hardwareConcurrency
  languages: ['eng']; // Start with English only
  cacheMethod: 'indexedDB';
  workerPath: '/tesseract/worker.min.js';
  corePath: '/tesseract/tesseract-core.wasm';
  langPath: '/tesseract/langs';
  oem: Tesseract.OEM.LSTM_ONLY;
  psm: Tesseract.PSM.AUTO;
}
```

## Performance Targets
- Initialize: <3s first time, <500ms cached
- Process receipt: <2s for 1MP image
- Memory per worker: <50MB

## Rollback
- Disable local OCR, use cloud only
- Clear IndexedDB cache if corrupted