# Task: OCR Unit Test Suite

**Slug:** `ocr-023-unit-test-suite`
**Priority:** High
**Size:** 1 PR

## Description
Create comprehensive unit test suite for all OCR services with mocks and fixtures.

## Files to Create
- `src/__tests__/domains/ocr/fixtures/ocr-test-data.ts`
- `src/__tests__/domains/ocr/mocks/ocr-provider-mocks.ts`
- `src/__tests__/domains/ocr/helpers/test-helpers.ts`

## Files to Modify
- `jest.config.js` - Add OCR test configuration

## Acceptance Criteria
- [ ] Test fixtures for receipts/invoices/notes
- [ ] Mock OCR provider responses
- [ ] Helper functions for common scenarios
- [ ] Coverage target ≥80% for OCR domain
- [ ] Fast test execution (<30s)
- [ ] Deterministic results
- [ ] Edge case coverage
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/fixtures/ocr-test-data.ts`

Fixtures:
- `SAMPLE_RECEIPTS` - Various formats
  - Home Depot receipt
  - Grocery receipt with tax
  - Gas station receipt
  
- `SAMPLE_INVOICES` - Multi-page
  - Simple invoice
  - Complex with tables
  - With PO number
  
- `SAMPLE_HANDWRITTEN` - Various quality
  - Clear handwriting
  - Mixed print/cursive
  - Poor quality photo
  
- `OCR_RESPONSES` - Provider responses
  - Textract format
  - Google Vision format
  - Error responses

**Create:** `src/__tests__/domains/ocr/mocks/ocr-provider-mocks.ts`

Mocks:
- `mockTesseractWorker()` - Returns canned responses
- `mockTextractClient()` - AWS SDK mock
- `mockVisionClient()` - Google client mock
- `mockWithConfidence(text, confidence)` - Variable confidence
- `mockProcessingDelay(ms)` - Simulate latency

## Dependencies
- All OCR services
- Jest testing framework

## Test Patterns
```typescript
// Service test pattern
describe('OcrJobService', () => {
  let service: OcrJobService;
  let mockRepo: jest.Mocked<OcrJobRepository>;
  
  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new OcrJobService(mockRepo);
  });
  
  it('should create job with queued status', async () => {
    // Arrange
    const params = { mediaAssetId: 'abc', jobType: 'receipt' };
    
    // Act
    const job = await service.createJob(params);
    
    // Assert
    expect(job.status).toBe('queued');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'queued' })
    );
  });
});
```

## Coverage Requirements
- Statements: ≥80%
- Branches: ≥75%
- Functions: ≥80%
- Lines: ≥80%

## Rollback
- Tests are independent
- No rollback needed