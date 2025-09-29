# Task: Request Caps and Downgrade Rules

**Slug:** `telemetry-004-request-caps`
**Priority:** Low
**Size:** 1 PR

## Description
Implement request rate limiting and automatic model downgrade when approaching limits.

## Files to Create
- `src/domains/telemetry/services/rate-limiter.ts`
- `src/domains/telemetry/services/model-selector.ts`
- `src/domains/telemetry/config/downgrade-rules.ts`

## Files to Modify
- AI service files to check limits before requests

## Acceptance Criteria
- [ ] Tracks request rates per service
- [ ] Enforces per-minute/hour/day caps
- [ ] Downgrades to cheaper models near limits
- [ ] Queues requests when rate limited
- [ ] Provides clear limit status
- [ ] Resets counters on schedule

## Test Files
**Create:** `src/__tests__/domains/telemetry/services/rate-limiter.test.ts`

Test cases:
- `enforces rate limits`
  - Set limit to 10/minute
  - Make 10 requests
  - Assert 11th blocked
  - Assert retry-after header
  
- `resets on schedule`
  - Hit minute limit
  - Wait 1 minute
  - Assert requests allowed again
  
- `tracks multiple limits`
  - Set minute/hour/day limits
  - Assert all tracked
  - Assert most restrictive applied

**Create:** `src/__tests__/domains/telemetry/services/model-selector.test.ts`

Test cases:
- `downgrades at 80% limit`
  - Use 80% of GPT-4 quota
  - Request model
  - Assert GPT-3.5 returned
  
- `selects by cost priority`
  - Multiple models available
  - Assert cheapest selected
  - Assert quality threshold met

## Dependencies
- `telemetry-001-cost-tracking` - For budget status

## Configuration
```typescript
interface RateLimitConfig {
  service: string;
  limits: {
    perMinute?: number;
    perHour?: number;
    perDay?: number;
  };
  strategy: 'fixed-window' | 'sliding-window';
}

interface ModelTier {
  name: string;
  model: string;
  costPerUnit: number;
  qualityScore: number;
  capabilities: string[];
}

// Downgrade rules
export const MODEL_TIERS = {
  llm: [
    { name: 'premium', model: 'gpt-4', costPerUnit: 0.03, qualityScore: 1.0 },
    { name: 'standard', model: 'gpt-3.5-turbo', costPerUnit: 0.002, qualityScore: 0.8 },
    { name: 'basic', model: 'gpt-3.5-turbo-instruct', costPerUnit: 0.0015, qualityScore: 0.6 }
  ],
  vlm: [
    { name: 'premium', model: 'gpt-4-vision', costPerUnit: 0.10, qualityScore: 1.0 },
    { name: 'standard', model: 'claude-3-sonnet', costPerUnit: 0.05, qualityScore: 0.85 }
  ]
};

interface DowngradeRule {
  triggerThreshold: 0.8; // 80% of limit
  minimumQuality: 0.6;
  preferenceOrder: ['cost', 'quality'];
}
```

## Rate Limiter Interface
```typescript
interface RateLimiter {
  checkLimit(service: string, units?: number): Promise<LimitStatus>;
  consumeQuota(service: string, units: number): Promise<void>;
  getRemainingQuota(service: string): Promise<QuotaInfo>;
}

interface LimitStatus {
  allowed: boolean;
  reason?: 'rate_limit' | 'budget_limit';
  retryAfter?: number; // seconds
  suggestedModel?: string;
}

interface QuotaInfo {
  minute: { used: number; limit: number };
  hour: { used: number; limit: number };
  day: { used: number; limit: number };
  resetTimes: {
    minute: Date;
    hour: Date;
    day: Date;
  };
}
```