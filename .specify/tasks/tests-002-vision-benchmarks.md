# Task: Vision Performance Benchmarks

**Slug:** `tests-002-vision-benchmarks`
**Priority:** Medium
**Size:** 1 PR

## Description
Create performance benchmark suite for vision pipeline measuring latency, accuracy, and resource usage.

## Files to Create
- `src/__tests__/performance/vision-benchmarks.test.ts`
- `src/__tests__/performance/benchmark-utils.ts`
- `src/__tests__/performance/test-images/README.md`

## Files to Modify
- `package.json` - Add benchmark script

## Acceptance Criteria
- [ ] Measures YOLO inference latency
- [ ] Measures VLM fallback frequency
- [ ] Tests various image sizes/complexities
- [ ] Establishes performance baselines
- [ ] Tracks memory usage
- [ ] Outputs benchmark report

## Test Files
**Create:** `src/__tests__/performance/vision-benchmarks.test.ts`

Test cases:
- `benchmark YOLO inference speed`
  - Test 640x640 image: Assert <500ms P50
  - Test 1920x1080 image: Assert <1000ms P50
  - Test batch of 4: Assert <2000ms total
  
- `benchmark YOLO accuracy`
  - Test known object set
  - Assert >90% detection rate
  - Assert <5% false positives
  
- `benchmark VLM fallback rate`
  - Process 100 diverse images
  - Assert <10% require VLM
  - Track fallback reasons
  
- `benchmark memory usage`
  - Load model
  - Process 50 images
  - Assert memory <500MB peak
  - Assert no memory leaks

**Create:** `src/__tests__/performance/benchmark-utils.ts`

Utilities:
- `measureLatency()` - High-precision timing
- `profileMemory()` - Heap snapshots
- `generateTestImages()` - Various complexities
- `formatReport()` - Markdown output

## Dependencies
- Test images dataset

## Benchmark Configuration
```typescript
interface BenchmarkConfig {
  iterations: number;
  warmupRuns: number;
  testImages: {
    simple: string[]; // Few objects, good lighting
    moderate: string[]; // Typical field conditions
    complex: string[]; // Many objects, poor conditions
  };
  deviceProfiles: {
    highEnd: { cpu: 8, memory: 16 };
    midRange: { cpu: 4, memory: 8 };
    lowEnd: { cpu: 2, memory: 4 };
  };
}

interface BenchmarkResult {
  metric: string;
  unit: string;
  values: number[];
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
  baseline?: number;
  regression?: boolean;
}
```

## Performance Baselines
```typescript
export const PERFORMANCE_BASELINES = {
  yoloInference: {
    '640x640': { p50: 500, p95: 800, p99: 1000 }, // ms
    '1920x1080': { p50: 1000, p95: 1500, p99: 2000 }
  },
  vlmFallback: {
    rate: 0.10, // 10% max
    latency: { p50: 2000, p95: 3000, p99: 5000 }
  },
  memory: {
    modelLoad: 200, // MB
    perImage: 50, // MB
    peak: 500 // MB
  },
  accuracy: {
    detection: 0.90, // 90% minimum
    falsePositive: 0.05 // 5% maximum
  }
};
```

## Benchmark Report Format
```markdown
# Vision Performance Benchmark Report
Date: 2024-01-15
Device: MacBook Pro M1

## YOLO Inference Latency
| Image Size | P50 | P95 | P99 | Baseline | Status |
|------------|-----|-----|-----|----------|---------|
| 640x640    | 450ms | 720ms | 950ms | 500ms | ✅ PASS |
| 1920x1080  | 980ms | 1420ms | 1880ms | 1000ms | ✅ PASS |

## Resource Usage
- Model Load: 185MB
- Peak Memory: 465MB
- GPU Usage: 45%

## Recommendations
- All metrics within acceptable ranges
- Consider GPU acceleration for 4K images
```