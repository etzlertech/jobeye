# Task: Integration Test Suite

**Slug:** `tests-004-integration-suite`
**Priority:** High
**Size:** 1 PR

## Description
Create integration tests for critical cross-service workflows including vision+voice+sync combinations.

## Files to Create
- `src/__tests__/integration/vision-voice-flow.test.ts`
- `src/__tests__/integration/job-verification-flow.test.ts`
- `src/__tests__/integration/cost-budget-flow.test.ts`
- `src/__tests__/integration/test-fixtures.ts`

## Files to Modify
- None (new test suite)

## Acceptance Criteria
- [ ] Tests vision→voice→action flows
- [ ] Tests complete job verification
- [ ] Tests cost tracking across services
- [ ] Uses real service integrations
- [ ] Validates data consistency
- [ ] Tests error propagation

## Test Files
**Create:** `src/__tests__/integration/vision-voice-flow.test.ts`

Test cases:
- `voice confirms vision results`
  - Process image with YOLO
  - Get low confidence result
  - Trigger voice confirmation
  - User confirms via voice
  - Assert data updated correctly
  
- `voice triggers re-scan`
  - Initial scan misses item
  - Voice: "Check for chainsaw"
  - Trigger targeted scan
  - Assert VLM activated
  - Assert item found

**Create:** `src/__tests__/integration/job-verification-flow.test.ts`

Test cases:
- `complete job verification workflow`
  - Create job with checklist
  - Apply kit items
  - Capture verification image
  - Process with vision
  - Assert all items detected
  - Mark job complete
  
- `handles missing items`
  - Expected: 5 items
  - Detected: 3 items
  - Assert warning raised
  - Voice prompts for missing
  - Manual override option

**Create:** `src/__tests__/integration/cost-budget-flow.test.ts`

Test cases:
- `enforces budgets across services`
  - Set daily budget $10
  - Use $8 on vision
  - Attempt voice command
  - Assert cost check
  - Use $3 on voice
  - Assert blocked at limit
  
- `downgrades models near limit`
  - Approach 80% budget
  - Request vision analysis
  - Assert cheaper model used
  - Assert quality acceptable

## Dependencies
- All services must be available

## Test Fixtures
```typescript
// src/__tests__/integration/test-fixtures.ts
export const IntegrationFixtures = {
  // Standard test job
  testJob: {
    customer: 'Test Customer',
    property: '123 Test St',
    service: 'Lawn Maintenance',
    checklist: [
      { item: 'Mow lawn', required: true },
      { item: 'Edge walkways', required: true },
      { item: 'Blow debris', required: true }
    ]
  },
  
  // Test images
  testImages: {
    complete: 'base64...', // All items visible
    partial: 'base64...', // Some items missing
    complex: 'base64...', // Many objects, challenging
  },
  
  // Voice commands
  testCommands: {
    createJob: "Create a lawn service job for Smith property",
    confirmItem: "Yes, that's correct",
    reportMissing: "The trimmer is missing"
  },
  
  // Cost scenarios
  costScenarios: {
    nearLimit: { used: 8.50, limit: 10.00 },
    overLimit: { used: 10.50, limit: 10.00 }
  }
};
```

## Integration Test Patterns
```typescript
describe('Cross-Service Integration', () => {
  let services: IntegrationServices;
  
  beforeAll(async () => {
    // Initialize all services
    services = await initializeServices({
      vision: true,
      voice: true,
      sync: true,
      telemetry: true
    });
  });
  
  afterEach(async () => {
    // Clean up test data
    await cleanupTestData();
    // Reset service states
    await resetServices(services);
  });
  
  it('should coordinate between services', async () => {
    // Test cross-service workflows
    // Verify data consistency
    // Check error handling
  });
});
```

## Data Flow Validation
```typescript
interface DataFlowValidation {
  // Verify data consistency across services
  async validateJobFlow(jobId: string): Promise<{
    database: JobRecord;
    cache: CachedJob;
    queue: QueuedOperations[];
    consistent: boolean;
  }>;
  
  // Trace operation through system
  async traceOperation(opId: string): Promise<{
    path: ServiceHop[];
    latencies: number[];
    errors: Error[];
  }>;
}
```