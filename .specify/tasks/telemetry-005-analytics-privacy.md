# Task: Privacy-Preserving Analytics

**Slug:** `telemetry-005-analytics-privacy`
**Priority:** Low
**Size:** 1 PR

## Description
Implement client-side event collection with anonymization before server transmission.

## Files to Create
- `src/domains/telemetry/services/analytics-service.ts`
- `src/domains/telemetry/utils/event-anonymizer.ts`
- `src/domains/telemetry/config/analytics-config.ts`

## Files to Modify
- Component files to add event tracking

## Acceptance Criteria
- [ ] Collects user interaction events
- [ ] Strips PII before transmission
- [ ] Batches events for efficiency
- [ ] Respects DNT header
- [ ] Provides opt-out mechanism
- [ ] Minimal bundle size impact

## Test Files
**Create:** `src/__tests__/domains/telemetry/services/analytics-service.test.ts`

Test cases:
- `anonymizes events`
  - Track event with email
  - Assert email removed
  - Assert event type preserved
  - Assert timestamp preserved
  
- `batches events`
  - Track 10 events rapidly
  - Assert single request
  - Assert all events included
  
- `respects privacy settings`
  - Set DNT header
  - Track event
  - Assert no transmission
  
- `handles opt-out`
  - User opts out
  - Track event
  - Assert not sent
  - Assert stored locally only

## Dependencies
- None (standalone)

## Event Schema
```typescript
interface AnalyticsEvent {
  eventType: string;
  timestamp: number;
  metadata: {
    actionType: string;
    duration?: number;
    success: boolean;
    errorType?: string;
    // No PII: names, emails, addresses, etc.
  };
  context: {
    sessionId: string; // Anonymous session
    deviceType: 'mobile' | 'desktop';
    browserType: string;
  };
}

interface AnonymizationRules {
  stripFields: string[]; // Fields to remove
  hashFields: string[]; // Fields to hash
  generalizeFields: { // Fields to generalize
    [field: string]: (value: any) => any;
  };
}
```

## Privacy Configuration
```typescript
export const PRIVACY_CONFIG = {
  // Fields to always remove
  stripFields: [
    'email', 'name', 'phone', 'address',
    'customerName', 'propertyAddress'
  ],
  
  // Fields to hash for correlation
  hashFields: ['userId', 'companyId'],
  
  // Generalization rules
  generalizeFields: {
    timestamp: (ts: number) => Math.floor(ts / 300000) * 300000, // 5-min buckets
    location: (loc: any) => ({ 
      city: loc.city, 
      state: loc.state 
      // Remove street address
    })
  },
  
  // Batching config
  batchSize: 20,
  batchInterval: 30000, // 30 seconds
  
  // Storage
  localStorageKey: 'jobeye-analytics-queue',
  maxQueueSize: 100
};
```

## Opt-Out UI
```typescript
interface PrivacySettings {
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
  performanceMonitoringEnabled: boolean;
}

// Settings UI component
export function PrivacySettingsPanel() {
  // Toggle switches for each setting
  // Clear stored data option
  // Export personal data option
}
```