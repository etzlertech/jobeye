# Task: VLM Fallback Router

**Slug:** `vision-004-vlm-fallback-router`
**Priority:** High
**Size:** 1 PR

## Description
Implement intelligent routing to VLM when YOLO confidence is low, too many objects detected, or expected items missing.

## Files to Create
- `src/domains/vision/services/vlm-fallback-router.ts`
- `src/domains/vision/config/fallback-thresholds.ts`
- `src/domains/vision/types/vlm-types.ts`

## Files to Modify
- `src/domains/vision/services/multi-object-vision-service.ts` - Add fallback logic
- `src/lib/repositories/company-settings.repository.ts` - Add vision thresholds

## Acceptance Criteria
- [ ] Routes to VLM when confidence <0.7 (configurable)
- [ ] Routes to VLM when >20 objects detected
- [ ] Routes to VLM when expected checklist items missing
- [ ] Loads per-company threshold overrides
- [ ] Shows cost estimate before VLM execution
- [ ] Tracks fallback reasons for analytics

## Test Files
**Create:** `src/__tests__/domains/vision/services/vlm-fallback-router.test.ts`

Test cases:
- `triggers on low confidence`
  - Input detections with confidence 0.5
  - Assert shouldFallback returns true
  - Assert reason is 'low_confidence'
  
- `triggers on too many objects`
  - Input 25 detected objects
  - Assert shouldFallback returns true
  - Assert reason is 'too_many_objects'
  
- `triggers on missing expected items`
  - Input checklist with 'chainsaw'
  - Detections missing 'chainsaw'
  - Assert shouldFallback returns true
  - Assert reason is 'missing_expected'
  
- `respects company overrides`
  - Set company threshold to 0.5
  - Input confidence 0.6
  - Assert no fallback triggered
  
- `estimates VLM cost`
  - Call estimateCost()
  - Assert returns $0.10 per image
  - Assert includes provider name

## Dependencies
- `vision-002-yolo-inference-engine` - Need detection results

## Database Migration
```sql
-- Add to companies table
ALTER TABLE companies 
ADD COLUMN vision_thresholds JSONB DEFAULT '{
  "confidenceThreshold": 0.7,
  "maxObjects": 20,
  "checkExpectedItems": true
}'::jsonb;
```

## Configuration
```typescript
interface VisionThresholds {
  confidenceThreshold: number; // 0-1
  maxObjects: number;
  checkExpectedItems: boolean;
}
```