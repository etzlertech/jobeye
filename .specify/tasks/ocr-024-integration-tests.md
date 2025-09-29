# Task: OCR Integration Test Suite

**Slug:** `ocr-024-integration-tests`
**Priority:** High
**Size:** 1 PR

## Description
Create integration tests for complete OCR flows including offline sync and event routing.

## Files to Create
- `src/__tests__/integration/ocr-full-flow.test.ts`
- `src/__tests__/integration/ocr-offline-sync.test.ts`
- `src/__tests__/integration/ocr-event-flow.test.ts`

## Files to Modify
- None (new tests)

## Acceptance Criteria
- [ ] Tests complete capture → OCR → confirm flow
- [ ] Tests offline queue and sync
- [ ] Tests event generation and handling
- [ ] Uses real services with test DB
- [ ] Cleanup after each test
- [ ] Tests error scenarios
- [ ] Validates data consistency
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/integration/ocr-full-flow.test.ts`

Test cases:
- `processes receipt end-to-end`
  - Upload receipt image
  - Process with OCR
  - Extract entities
  - Confirm data
  - Assert document saved
  - Assert event generated
  
- `handles invoice with PO matching`
  - Create PO in system
  - Upload matching invoice
  - Assert PO linked
  - Assert items matched
  
- `processes handwritten note`
  - Upload note image
  - Extract entities
  - Link to job
  - Assert note added

**Create:** `src/__tests__/integration/ocr-offline-sync.test.ts`

Test cases:
- `queues and syncs offline OCR`
  - Go offline
  - Queue 3 OCR jobs
  - Go online
  - Assert all synced
  - Assert queue cleared
  
- `handles sync failures`
  - Queue jobs offline
  - Simulate API error
  - Assert retry attempted
  - Assert jobs remain queued

**Create:** `src/__tests__/integration/ocr-event-flow.test.ts`

Test cases:
- `receipt triggers inventory update`
- `invoice triggers PO update`
- `note triggers job update`

## Dependencies
- Test database
- All OCR services
- Event handlers

## Test Database Setup
```typescript
beforeEach(async () => {
  // Reset test database
  await testDb.clean();
  
  // Seed test data
  await testDb.seed({
    companies: [testCompany],
    vendors: [testVendor],
    jobs: [testJob]
  });
});

afterEach(async () => {
  // Cleanup
  await testDb.clean();
});
```

## Rollback
- Tests use separate DB
- No production impact