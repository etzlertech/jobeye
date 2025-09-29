# Task: OCR Performance Benchmarks

**Slug:** `ocr-027-performance-benchmarks`
**Priority:** Medium
**Size:** 1 PR

## Description
Create performance benchmark suite for OCR operations measuring latency, accuracy, and cost.

## Files to Create
- `src/__tests__/performance/ocr-benchmarks.test.ts`
- `src/__tests__/performance/ocr-accuracy-benchmarks.ts`
- `scripts/ocr-benchmark-runner.ts`

## Files to Modify
- `package.json` - Add benchmark scripts

## Acceptance Criteria
- [ ] Measures OCR latency (local vs cloud)
- [ ] Measures extraction accuracy
- [ ] Tracks memory usage
- [ ] Generates benchmark report
- [ ] Tests various document types
- [ ] Includes cost per document
- [ ] Establishes baselines
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/performance/ocr-benchmarks.test.ts`

Test cases:
- `benchmark local OCR latency`
  - Process 100 receipts
  - Assert P50 <1s
  - Assert P95 <2s
  - Assert P99 <3s
  
- `benchmark cloud OCR latency`
  - Process 20 invoices
  - Assert P50 <3s
  - Assert P95 <5s
  - Assert P99 <8s
  
- `benchmark memory usage`
  - Process batch of 10
  - Assert peak <200MB
  - Assert no memory leaks
  
- `benchmark cost efficiency`
  - Track 100 documents
  - Assert avg cost <$0.05
  - Assert local rate >80%

**Create:** `src/__tests__/performance/ocr-accuracy-benchmarks.ts`

Test cases:
- `receipt field accuracy`
  - 100 known receipts
  - Assert vendor >95%
  - Assert total >98%
  
- `handwriting accuracy`
  - 50 note samples
  - Assert names >80%
  - Assert phones >95%

## Dependencies
- Test dataset
- Performance tools

## Benchmark Configuration
```typescript
interface BenchmarkConfig {
  iterations: 100;
  warmupRuns: 5;
  documentTypes: {
    receipts: 'test-data/receipts/*.jpg',
    invoices: 'test-data/invoices/*.pdf',
    notes: 'test-data/handwritten/*.jpg'
  };
  metrics: ['latency', 'accuracy', 'memory', 'cost'];
}

interface BenchmarkResult {
  documentType: string;
  sampleSize: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  accuracy: {
    overall: number;
    byField: Record<string, number>;
  };
  memory: {
    peak: number;
    average: number;
  };
  cost: {
    average: number;
    total: number;
  };
}
```

## Report Format
```markdown
# OCR Performance Benchmark Report
Date: 2024-01-20
Environment: MacBook Pro M1, 16GB RAM

## Receipt Processing
- Sample Size: 100
- Latency: P50=0.8s, P95=1.5s, P99=2.1s
- Accuracy: Vendor=96%, Total=98.5%
- Memory: Peak=145MB, Avg=98MB
- Cost: $0.02/document (85% local)

## Recommendations
- Current performance meets targets
- Consider GPU acceleration for >95% local rate
```

## Rollback
- Benchmarks are read-only
- No production impact