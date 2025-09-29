# Task: CLIP Reference Image Matcher

**Slug:** `vision-005-clip-reference-matcher`
**Priority:** Medium
**Size:** 1 PR

## Description
Implement CLIP-based reference image matching to verify specific equipment models against catalog photos.

## Files to Create
- `src/domains/vision/services/clip-matcher-service.ts`
- `src/domains/vision/models/reference-embeddings.ts`
- `src/domains/vision/utils/clip-preprocessor.ts`

## Files to Modify
- `src/domains/equipment/services/equipment-catalog-service.ts` - Add embedding support

## Acceptance Criteria
- [ ] Generates CLIP embeddings for reference images
- [ ] Caches embeddings in IndexedDB
- [ ] Matches captured images against references
- [ ] Returns similarity scores (0-1)
- [ ] Handles multiple reference angles per item
- [ ] Works offline with cached embeddings

## Test Files
**Create:** `src/__tests__/domains/vision/services/clip-matcher-service.test.ts`

Test cases:
- `generates embeddings for reference image`
  - Input reference image
  - Assert embedding vector length 512
  - Assert values normalized
  
- `matches similar equipment`
  - Compare same model from different angles
  - Assert similarity score >0.8
  - Assert correct match ranked first
  
- `distinguishes different models`
  - Compare push mower vs zero-turn
  - Assert similarity score <0.5
  - Assert no false matches
  
- `caches embeddings locally`
  - Generate embedding
  - Clear memory, reload from cache
  - Assert identical embedding retrieved

**Create:** `src/__tests__/domains/vision/models/reference-embeddings.test.ts`

Test cases:
- `stores embeddings by equipment ID`
- `retrieves embeddings for comparison`
- `handles cache size limits`

## Dependencies
- NPM: `@xenova/transformers` for CLIP model
- `vision-001-yolo-model-loader` - Similar caching pattern

## Performance Targets
- Embedding generation: <2s per image
- Similarity computation: <100ms
- Cache size: <50MB for 500 items