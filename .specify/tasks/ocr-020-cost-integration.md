# Task: OCR Cost Tracking Integration

**Slug:** `ocr-020-cost-integration`
**Priority:** High
**Size:** 1 PR

## Description
Integrate OCR operations with cost tracking service for budget enforcement and monitoring.

## Files to Modify
- `src/domains/ocr/services/tesseract-ocr-service.ts` - Add cost tracking
- `src/domains/ocr/services/cloud-ocr-adapter.ts` - Track cloud costs
- `src/domains/ocr/services/ocr-job-service.ts` - Check budgets

## Acceptance Criteria
- [ ] Records cost for every OCR operation
- [ ] Local OCR = $0 cost
- [ ] Cloud OCR estimates before call
- [ ] Checks daily budget before processing
- [ ] Blocks at 100% budget
- [ ] Warns at 80% budget
- [ ] Updates actual cost after completion
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/integration/ocr-cost-tracking.test.ts`

Test cases:
- `tracks local OCR cost`
  - Process with Tesseract
  - Assert cost = $0
  - Assert recorded in DB
  
- `estimates cloud OCR cost`
  - 2-page invoice
  - Assert estimate = $0.06
  - Assert budget checked
  
- `blocks over budget`
  - Set limit to $1
  - Use $1 budget
  - Attempt OCR
  - Assert blocked
  
- `allows local when over budget`
  - Over cloud budget
  - Try local OCR
  - Assert allowed (free)

## Dependencies
- Cost tracking service
- Company settings (budgets)

## Cost Configuration
```typescript
const OCR_COSTS = {
  local: {
    tesseract: 0 // Free
  },
  cloud: {
    textract: {
      page: 0.03,      // Per page
      table: 0.01,     // Per table
      form: 0.05       // Per form
    },
    googleVision: {
      text: 0.0015,    // Per image
      document: 0.06   // Per page
    }
  }
};

// Integration
await costTracker.record({
  serviceType: 'ocr',
  operationType: 'extract_receipt',
  estimatedCost: 0.03,
  actualCost: 0.028,
  metadata: {
    provider: 'textract',
    documentType: 'receipt',
    pageCount: 1,
    jobId: ocrJob.id
  }
});
```

## Budget Checks
```typescript
// Before cloud OCR
const budget = await costTracker.checkBudget('ocr', estimatedCost);
if (!budget.allowed) {
  // Try local OCR instead
  // Or queue for later
  // Or throw budget exceeded error
}
```

## Rollback
- Disable cost enforcement
- Log only, don't block