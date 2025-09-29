# Task: Alert Service

**Slug:** `telemetry-003-alert-service`
**Priority:** Medium
**Size:** 1 PR

## Description
Implement alerting system for performance degradation, sync failures, and cost overruns.

## Files to Create
- `src/domains/telemetry/services/alert-service.ts`
- `src/domains/telemetry/models/alert-rules.ts`
- `src/domains/telemetry/utils/alert-evaluator.ts`

## Files to Modify
- `src/domains/telemetry/services/metrics-collector.ts` - Trigger alerts

## Acceptance Criteria
- [ ] Evaluates alert rules on metrics
- [ ] Sends webhook notifications
- [ ] Implements cooldown to prevent spam
- [ ] Tracks alert history
- [ ] Supports multiple channels
- [ ] Includes context in alerts

## Test Files
**Create:** `src/__tests__/domains/telemetry/services/alert-service.test.ts`

Test cases:
- `triggers accuracy degradation alert`
  - Set baseline accuracy to 90%
  - Report accuracy of 75%
  - Assert alert triggered
  - Assert includes degradation %
  
- `triggers sync failure alert`
  - Report 6% failure rate
  - Assert alert triggered
  - Assert evaluated over 15min
  
- `triggers cost overrun alert`
  - Report 130% of yesterday
  - Assert alert triggered
  - Assert includes cost details
  
- `respects cooldown period`
  - Trigger alert
  - Trigger condition again
  - Assert no duplicate alert
  - Wait cooldown period
  - Assert new alert allowed

## Dependencies
- `telemetry-002-metrics-collector` - Metrics source

## Alert Configuration
```typescript
interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '==';
    threshold: number;
    evaluationWindow?: number; // ms
  };
  cooldown: number; // ms
  channels: AlertChannel[];
  metadata?: Record<string, any>;
}

interface AlertChannel {
  type: 'webhook' | 'email' | 'log';
  config: {
    url?: string;
    headers?: Record<string, string>;
    template?: string;
  };
}

// Default alert rules
export const DEFAULT_ALERTS: AlertRule[] = [
  {
    id: 'vision-accuracy-drop',
    name: 'Vision Accuracy Degradation',
    metric: 'vision.accuracy.rate',
    condition: {
      operator: '<',
      threshold: 0.80, // baseline - 10%
      evaluationWindow: 604800000 // 7 days
    },
    cooldown: 3600000, // 1 hour
    channels: [{ type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } }]
  },
  {
    id: 'sync-failure-rate',
    name: 'High Sync Failure Rate',
    metric: 'sync.failure.rate',
    condition: {
      operator: '>',
      threshold: 0.05,
      evaluationWindow: 900000 // 15 minutes
    },
    cooldown: 1800000, // 30 minutes
    channels: [{ type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } }]
  },
  {
    id: 'cost-overrun',
    name: 'Daily Cost Overrun',
    metric: 'cost.budget.daily.percentage',
    condition: {
      operator: '>=',
      threshold: 100
    },
    cooldown: 86400000, // 24 hours
    channels: [{ type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } }]
  }
];
```

## Alert Payload
```typescript
interface AlertPayload {
  rule: AlertRule;
  triggeredAt: Date;
  currentValue: number;
  threshold: number;
  context: {
    metricHistory?: MetricPoint[];
    relatedMetrics?: Record<string, number>;
    affectedCompany?: string;
  };
  message: string;
}
```