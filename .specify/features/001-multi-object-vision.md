# Feature Specification: 001-multi-object-vision

## Overview
Multi-object vision system enabling field technicians to verify entire job loads with a single photo, using hybrid YOLO + VLM processing for cost-effective, offline-capable load verification.

## Current Implementation Status

### ✅ Already Implemented

#### Infrastructure
- **PWA Foundation**
  - `public/manifest.json` with app shortcuts for "Create Job" and "Verify Load"
  - `public/service-worker.js` with offline caching, background sync, and push notifications
  - `PWAProvider` component with online/offline detection and sync orchestration
  - `OfflineIndicator` component with voice announcements
  - Dedicated `/offline` page listing available offline capabilities

- **Database Schema** (migrations 005-008)
  - `containers` table with types (truck, trailer, van, bin)
  - `inventory_images` table for storing vision captures
  - `job_checklist_items` table for expected items
  - `load_verifications` table for vision results
  - RLS policies on all tables for multi-tenant isolation

#### Core Services
- **Vision Processing**
  - `MultiObjectVisionService` with YOLO detection support (95.24% test coverage)
  - Hybrid pipeline structure (local first, VLM fallback)
  - Confidence thresholds and multi-object detection

- **Container Management**
  - `ContainerService` for CRUD operations on containers
  - Support for truck, trailer, van, bin types
  - Company-scoped container queries

- **Job & Load Management**
  - `JobLoadListService` for managing job item lists
  - `JobFromVoiceService` for voice-based job creation
  - `ChecklistVerificationService` for validating loads against checklists

#### API Endpoints
- `/api/containers` - Container CRUD operations
- `/api/inventory/images` - Image upload and management
- `/api/jobs/load-list` - Load list operations
- `/api/jobs/verify-checklist` - Checklist verification
- `/api/jobs/from-voice` - Voice job creation
- `/api/sync/offline-operations` - Offline sync endpoint
- `/api/vision/load-verifications` - Vision-based verification

#### Offline Infrastructure
- Base repository pattern with automatic offline queuing
- localStorage persistence for queued operations
- Optimistic UI updates with fake response generation
- `CustomerOfflineSync` service as reference implementation
- Service worker background sync registration

### ❌ Missing/Incomplete Components

#### Vision Pipeline
- **YOLO Integration**: No actual YOLO model loading/inference code
- **Frame Rate Control**: Missing ~1 fps throttling implementation
- **VLM Fallback Logic**: Threshold-based fallback not wired up
- **Cost Tracking**: No per-request cost recording for vision operations
- **Local Model Storage**: No IndexedDB caching for YOLO weights

#### Voice Integration
- **STT/TTS Services**: Voice synthesis referenced but not implemented
- **Voice Command Queue**: No offline voice command storage
- **Entity Resolution**: Job creation lacks entity disambiguation
- **Confirmation Flows**: Missing voice confirmation dialogues

#### Offline Capabilities
- **Image Queue**: No offline image upload queue
- **Vision Result Cache**: Missing IndexedDB for vision results
- **Sync Conflict UI**: No UI for resolving sync conflicts
- **Progress Indicators**: Missing sync progress visualization

#### Testing & Monitoring
- **RLS Test Suite**: No comprehensive RLS isolation tests
- **Vision Performance Tests**: Missing latency benchmarks
- **Cost Monitoring**: No budget enforcement or alerts
- **Offline E2E Tests**: No Playwright tests for offline flows

## User Stories & Acceptance Criteria

### Story 1: Load Verification with Multi-Object Vision
**As a** field technician  
**I want to** take a single photo of my loaded truck  
**So that** I can verify all required items are present without manual checking

#### Acceptance Criteria
- [ ] YOLO model loads on app initialization (cached in IndexedDB)
- [ ] Camera captures at ~1 fps when verification mode active
- [ ] Local detection runs with <1s latency on mobile devices
- [ ] Objects detected with confidence ≥0.7 show immediate feedback
- [ ] Low confidence (<0.7) triggers VLM analysis automatically
- [ ] VLM requests include cost estimate before execution
- [ ] Detection results map items to specific containers
- [ ] Offline captures queue and sync when connected
- [ ] Voice announces verification results

#### Current Gaps
- YOLO model loading and caching
- Frame rate throttling implementation
- Confidence-based routing logic
- Cost estimation and tracking
- Voice announcement integration

### Story 2: Voice-Driven Job Creation
**As a** field technician  
**I want to** create jobs using voice commands  
**So that** I can work hands-free while handling equipment

#### Acceptance Criteria
- [ ] "Hey JobEye, create job for..." triggers STT capture
- [ ] Entity recognition identifies customer, property, service type
- [ ] Ambiguous entities prompt for clarification
- [ ] Job details confirmed via TTS before saving
- [ ] Offline commands queue with optimistic creation
- [ ] Background sync preserves voice metadata
- [ ] Commands respect daily STT cost budget ($10)

#### Current Gaps
- STT service implementation
- Entity resolution logic
- Confirmation dialogue flows
- Voice command queueing
- Cost budget enforcement

### Story 3: Offline-First Load List Management
**As a** field technician without connectivity  
**I want to** update load lists and verify items  
**So that** I can complete jobs in remote locations

#### Acceptance Criteria
- [ ] Load lists viewable from cache when offline
- [ ] Item additions/removals queue locally
- [ ] Photos attach to items with local preview
- [ ] Sync indicator shows pending operations count
- [ ] Background sync processes queue FIFO
- [ ] Conflicts show resolution UI (local/remote/merge)
- [ ] Voice announces sync completion summary

#### Current Gaps
- Load list caching strategy
- Image attachment queue
- Pending operations counter
- Conflict resolution UI
- Voice sync summaries

### Story 4: Container-Aware Item Tracking
**As a** crew supervisor  
**I want to** track which items are in which containers  
**So that** I can optimize load distribution across vehicles

#### Acceptance Criteria
- [ ] Vision detects container boundaries in images
- [ ] Items associated with detected containers
- [ ] Container capacity warnings when overloaded
- [ ] Transfer items between containers via UI/voice
- [ ] Container history tracks item movements
- [ ] Reports show container utilization rates

#### Current Gaps
- Container boundary detection
- Item-to-container association logic
- Capacity tracking and warnings
- Transfer operation UI/API
- Container history tracking
- Utilization reporting

## Technical Requirements

### Vision Pipeline Architecture
```typescript
interface VisionPipeline {
  // Local YOLO processing
  yolo: {
    modelPath: '/models/yolov11n.onnx';
    targetFPS: 1;
    confidenceThreshold: 0.7; // Per-company configurable
    maxDetections: 50;
    maxProcessingTime: 1500; // 1.5s max per frame
  };
  
  // VLM fallback triggers
  vlm: {
    provider: 'openai' | 'anthropic';
    costPerRequest: 0.10;
    timeoutMs: 5000;
    triggers: {
      lowConfidence: 0.7;      // Configurable per company
      tooManyObjects: 20;      // More than 20 objects
      missingExpected: true;   // Expected items not detected
    };
  };
  
  // Result caching
  cache: {
    store: 'IndexedDB';
    ttl: 86400; // 24 hours
    maxSize: '100MB';
  };
}
```

### Offline Queue Schema
```typescript
interface OfflineQueue {
  voice: {
    commands: VoiceCommand[];
    maxSize: 1000;                    // 1000 entries max
    syncPriority: 'high';
  };
  
  images: {
    uploads: PendingUpload[];
    maxSize: '500MB';                  // 500MB total
    compression: 0.8;
    evictionPolicy: 'LRU';             // Least recently used
    warnBeforeEvict: true;
  };
  
  operations: {
    crud: CRUDOperation[];
    maxSize: 10000;                    // 10,000 entries max
    maxRetries: 3;
    backoffMs: [1000, 5000, 15000];
    timeSensitiveExpiry: 86400000;     // 24h for job status changes
  };
  
  forceSyncAfter: 259200000;           // 72 hours
}
```

### RLS Architecture

#### Multi-Tenant Isolation
```sql
-- Standard tenant isolation pattern
CREATE POLICY "tenant_isolation" ON table_name
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');

-- Admin bypass with audit trail
CREATE OR REPLACE FUNCTION admin_bypass_rls(
  target_table TEXT,
  operation TEXT,
  target_id UUID,
  reason TEXT
) RETURNS VOID AS $$
BEGIN
  -- Log the bypass
  INSERT INTO admin_audit_log (
    admin_id, target_table, operation, target_id,
    before_data, after_data, reason, created_at
  ) VALUES (
    auth.uid(), target_table, operation, target_id,
    NULL, NULL, reason, NOW()
  );
  
  -- Operation performed with service role
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Shared Resources Pattern
```sql
-- Global templates table (read-only for tenants)
CREATE TABLE global_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  template_data JSONB,
  is_public BOOLEAN DEFAULT true
);

-- Company-specific copies (copy-on-write)
CREATE TABLE company_templates (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  parent_template_id UUID REFERENCES global_templates(id),
  name TEXT NOT NULL,
  template_data JSONB,
  modified_at TIMESTAMPTZ
);

-- Function to clone template to company
CREATE OR REPLACE FUNCTION clone_template_to_company(
  template_id UUID,
  target_company_id UUID
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO company_templates (company_id, parent_template_id, name, template_data)
  SELECT target_company_id, id, name, template_data
  FROM global_templates WHERE id = template_id
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;
```

#### Multi-Company Context
```typescript
interface UserContext {
  userId: string;
  activeCompanyId: string;        // One active at a time
  availableCompanies: string[];   // All accessible companies
  
  // Context switch function
  switchCompany(companyId: string): Promise<void>;
}
```

### Kit Management System

#### Predefined Kits
```typescript
interface JobKit {
  id: string;
  name: string;
  items: KitItem[];
  containerAssignments: ContainerRule[];
  seasonal?: SeasonalRule;
}

// Default kits
const DEFAULT_KITS = {
  smallYard: {
    name: "Small Yard Kit",
    items: [
      { type: "mower", model: "push", quantity: 1 },
      { type: "trimmer", model: "standard", quantity: 1 },
      { type: "blower", model: "handheld", quantity: 1 }
    ]
  },
  largeYard: {
    name: "Large Yard Kit",
    items: [
      { type: "mower", model: "zero-turn", quantity: 1 },
      { type: "mower", model: "push", quantity: 1 },
      { type: "trimmer", model: "commercial", quantity: 2 },
      { type: "blower", model: "backpack", quantity: 1 }
    ]
  }
};

// Container assignment rules
const CONTAINER_RULES = {
  chemicals: { container: "locked_bin", priority: 1 },
  gas_cans: { container: "truck_bed_rack", priority: 1 },
  mowers: { container: "trailer", fallback: "lowboy", priority: 2 }
};

// Seasonal variations
interface SeasonalRule {
  name: string;
  activeMonths: number[];  // [10, 11] for Oct-Nov
  additions: KitItem[];
}
```

### Telemetry & Metrics

#### Performance Metrics
```typescript
interface PerformanceMetrics {
  vision: {
    latency: { p50: number; p95: number; p99: number };
    yoloProcessingTime: number[];
    vlmFallbackRate: number;
    frameFPS: number;
  };
  
  sync: {
    duration: { p50: number; p95: number; p99: number };
    failureRate: number;
    queueDepth: number;
  };
  
  voice: {
    sttWordErrorRate: number;
    commandSuccessRate: number;
    entityResolutionTime: number;
  };
}
```

#### Cost Allocation
```typescript
interface CostTracking {
  hierarchy: "company" | "job" | "user";
  
  // Company level
  company: {
    daily: { stt: number; tts: number; vlm: number; llm: number };
    monthly: { total: number; byService: Record<string, number> };
  };
  
  // Drill-down capability
  drillDown(companyId: string, level: "job" | "user"): CostBreakdown;
}
```

#### Alert Thresholds
```typescript
interface AlertConfig {
  vision: {
    accuracyDegradation: 0.10;      // Alert if >10% drop
    baselineWindow: "7d";            // Rolling baseline
  };
  
  sync: {
    failureRateThreshold: 0.05;      // >5% failures
    evaluationWindow: "15m";         // Over 15 minutes
  };
  
  cost: {
    dailyBudgetMultiplier: 1.0;      // Alert at 100% of budget
    dayOverDayIncrease: 0.30;        // >30% increase
  };
}
```

#### Privacy-Preserving Analytics
```typescript
interface ClientEvent {
  eventType: string;
  timestamp: number;
  // No raw data (images, transcripts, PII)
  metadata: {
    actionType: string;
    duration?: number;
    success: boolean;
    errorType?: string;
  };
}
```

## Implementation Priority

### Phase 1: Vision Pipeline Completion (Week 1)
1. Integrate YOLO.js with model caching
2. Implement FPS throttling and preview
3. Wire confidence-based VLM routing
4. Add cost tracking to all vision operations

### Phase 2: Voice Integration (Week 2)
1. Implement Web Speech API services
2. Build entity resolution for customers/properties
3. Create confirmation dialogue flows
4. Add voice command offline queue

### Phase 3: Offline Hardening (Week 3)
1. Complete image upload queue with compression
2. Add sync progress indicators
3. Build conflict resolution UI
4. Implement voice sync summaries

### Phase 4: Testing & Polish (Week 4)
1. Write comprehensive RLS test suite
2. Add vision performance benchmarks
3. Implement cost monitoring/alerts
4. Create offline E2E test scenarios

## Success Metrics
- Vision processing: 90%+ handled locally (YOLO)
- VLM invocation rate: <10% of total captures
- Average cost per verification: <$0.50
- Offline sync success rate: >95%
- Load verification time: <30s per truck
- Voice command success rate: >85%
- Test coverage: ≥80% across all services