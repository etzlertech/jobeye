# Task: Performance Metrics Collector

**Slug:** `telemetry-002-metrics-collector`
**Priority:** Medium
**Size:** 1 PR

## Description
Implement metrics collection for vision, sync, and voice operations with P50/P95/P99 tracking.

## Files to Create
- `src/domains/telemetry/services/metrics-collector.ts`
- `src/domains/telemetry/utils/percentile-calculator.ts`
- `src/domains/telemetry/stores/metrics-store.ts`

## Files to Modify
- All service files to add metric collection calls

## Acceptance Criteria
- [ ] Collects operation latencies
- [ ] Calculates percentiles in sliding window
- [ ] Stores metrics in memory with TTL
- [ ] Exports metrics for monitoring
- [ ] Minimal performance overhead (<1%)
- [ ] Supports custom metric tags

## Test Files
**Create:** `src/__tests__/domains/telemetry/services/metrics-collector.test.ts`

Test cases:
- `records operation metrics`
  - Record 100 vision operations
  - Assert all latencies stored
  - Assert tags preserved
  
- `calculates percentiles`
  - Record known distribution
  - Assert P50 = median
  - Assert P95 accurate
  - Assert P99 accurate
  
- `maintains sliding window`
  - Set 5-minute window
  - Record old metrics
  - Wait 6 minutes
  - Assert old metrics pruned
  
- `exports prometheus format`
  - Record various metrics
  - Export to string
  - Assert Prometheus format
  - Assert all metrics included

## Dependencies
- None (standalone service)

## Metrics Schema
```typescript
interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

interface MetricSummary {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  tags: Record<string, string>;
}

interface CollectorConfig {
  windowSize: 300000; // 5 minutes
  maxMetrics: 10000;
  flushInterval: 60000; // 1 minute
  enabledMetrics: string[];
}
```

## Metric Names
```typescript
// Standardized metric names
export const METRICS = {
  // Vision
  YOLO_INFERENCE_TIME: 'vision.yolo.inference.ms',
  VLM_FALLBACK_RATE: 'vision.vlm.fallback.rate',
  VISION_PIPELINE_TOTAL: 'vision.pipeline.total.ms',
  
  // Voice
  STT_TRANSCRIPTION_TIME: 'voice.stt.transcription.ms',
  TTS_SYNTHESIS_TIME: 'voice.tts.synthesis.ms',
  ENTITY_RESOLUTION_TIME: 'voice.entity.resolution.ms',
  
  // Sync
  SYNC_DURATION: 'sync.duration.ms',
  SYNC_FAILURE_RATE: 'sync.failure.rate',
  SYNC_QUEUE_DEPTH: 'sync.queue.depth',
  
  // Cost
  AI_OPERATION_COST: 'cost.ai.operation.usd',
  DAILY_BUDGET_USAGE: 'cost.budget.daily.percentage'
};
```

## Usage Example
```typescript
// In service code
const startTime = Date.now();
const result = await processVision(image);
metricsCollector.record(METRICS.VISION_PIPELINE_TOTAL, {
  value: Date.now() - startTime,
  tags: { 
    model: 'yolo', 
    fallback: result.usedVLM ? 'true' : 'false' 
  }
});
```