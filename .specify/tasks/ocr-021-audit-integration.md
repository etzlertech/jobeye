# Task: OCR Audit Logging Integration

**Slug:** `ocr-021-audit-integration`
**Priority:** Medium
**Size:** 1 PR

## Description
Integrate OCR operations with admin audit system for data corrections and access logging.

## Files to Modify
- `src/domains/ocr/services/ocr-job-service.ts` - Add audit calls
- `src/components/ocr/confirmation/ocr-confirmation-modal.tsx` - Log edits
- `src/domains/vendor/services/vendor-normalization-service.ts` - Log merges

## Acceptance Criteria
- [ ] Logs manual data corrections with before/after
- [ ] Logs bulk vendor normalizations
- [ ] Logs admin document access
- [ ] Logs entity linking changes
- [ ] Includes user, timestamp, reason
- [ ] Tracks OCR accuracy improvements
- [ ] No performance impact
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/integration/ocr-audit-logging.test.ts`

Test cases:
- `logs OCR data correction`
  - Original: "HOEM DEPOT"
  - Corrected: "HOME DEPOT"
  - Assert audit entry created
  - Assert diff captured
  
- `logs vendor merge`
  - Merge duplicate vendors
  - Assert audit shows both IDs
  - Assert reason required
  
- `logs bulk operations`
  - Normalize 10 vendors
  - Assert single audit entry
  - Assert count included

## Dependencies
- Admin audit service
- All OCR services

## Audit Events
```typescript
// Manual correction
await auditService.log({
  action: 'ocr.document.corrected',
  table: 'ocr_documents',
  targetId: documentId,
  changes: {
    before: { vendor_name: 'HOEM DEPOT' },
    after: { vendor_name: 'HOME DEPOT' }
  },
  metadata: {
    fieldName: 'vendor_name',
    correctionType: 'manual',
    ocrConfidence: 0.65
  }
});

// Vendor merge
await auditService.log({
  action: 'vendor.merged',
  table: 'vendors',
  targetId: primaryVendorId,
  changes: {
    mergedIds: [duplicateId1, duplicateId2],
    recordCount: 45 // Affected records
  },
  reason: 'Duplicate vendor cleanup'
});

// Bulk normalization
await auditService.log({
  action: 'ocr.vendor.bulk_normalized',
  table: 'vendor_aliases',
  changes: {
    created: 15,
    pattern: 'Added Inc/LLC variants'
  },
  reason: 'Quarterly vendor cleanup'
});
```

## Privacy Considerations
- Don't log document contents
- Don't log sensitive line items
- Focus on structural changes
- Anonymize in audit reports

## Rollback
- Disable audit logging
- Keep core functionality