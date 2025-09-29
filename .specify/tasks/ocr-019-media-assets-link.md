# Task: Media Assets Integration for OCR

**Slug:** `ocr-019-media-assets-link`
**Priority:** High
**Size:** 1 PR

## Description
Link OCR jobs to media assets (inventory_images) with retention policy and storage optimization.

## Files to Create
- `src/domains/ocr/services/ocr-media-service.ts`

## Files to Modify
- `src/domains/inventory/services/inventory-image-service.ts` - Add OCR hooks
- `src/domains/ocr/services/ocr-job-service.ts` - Create media asset first

## Acceptance Criteria
- [ ] Creates inventory_image before OCR job
- [ ] Links via media_asset_id FK
- [ ] Stores original + processed versions
- [ ] Generates thumbnails (150x150)
- [ ] Applies 90-day retention policy
- [ ] Deletes after successful OCR (optional)
- [ ] Tracks storage usage
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/ocr-media-service.test.ts`

Test cases:
- `creates media asset for OCR`
  - Upload image
  - Assert inventory_image created
  - Assert OCR job references it
  
- `stores multiple versions`
  - Original upload
  - Assert processed version saved
  - Assert thumbnail generated
  
- `enforces retention policy`
  - Create asset 91 days ago
  - Run cleanup
  - Assert deleted
  
- `preserves recent assets`
  - Create asset 30 days ago
  - Run cleanup
  - Assert still exists

## Dependencies
- Inventory image service
- OCR job service

## Integration Flow
```typescript
// 1. Upload image
const mediaAsset = await inventoryImageService.create({
  image: file,
  type: 'ocr_source',
  metadata: { 
    documentType: 'receipt',
    capturedAt: new Date()
  }
});

// 2. Create OCR job
const ocrJob = await ocrJobService.createJob({
  mediaAssetId: mediaAsset.id,
  jobType: 'receipt'
});

// 3. After OCR complete (optional)
if (settings.deleteAfterOcr) {
  await inventoryImageService.delete(mediaAsset.id);
}
```

## Storage Optimization
- Compress before storage (80% quality)
- Generate WebP versions for web display
- Create thumbnail for lists
- Track total storage per company

## Rollback
- Keep all images
- Disable auto-deletion