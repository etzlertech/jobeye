# Task: Container Boundary Detection

**Slug:** `vision-006-container-detection`
**Priority:** High
**Size:** 1 PR

## Description
Implement container boundary detection in images to track which items are loaded in which containers.

## Files to Create
- `src/domains/vision/services/container-detector.ts`
- `src/domains/vision/models/container-boundaries.ts`

## Files to Modify
- `src/domains/vision/services/multi-object-vision-service.ts` - Add container detection
- `src/domains/job/services/checklist-verification-service.ts` - Track item locations

## Acceptance Criteria
- [ ] Detects container boundaries (truck bed, trailer, bin)
- [ ] Associates detected items with containers
- [ ] Calculates container utilization percentage
- [ ] Warns when container capacity exceeded
- [ ] Stores item-container relationships
- [ ] Works with partial container visibility

## Test Files
**Create:** `src/__tests__/domains/vision/services/container-detector.test.ts`

Test cases:
- `detects truck bed boundaries`
- `associates items within container`
- `calculates utilization percentage`
- `handles overlapping containers`

## Dependencies
- `vision-002-yolo-inference-engine` - For object detection