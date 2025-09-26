# JobEye v4 — Voice→Checklist & Vision Check-off MVP (Agent-Executable Plan)

**Mission (P0)**

1. **Dispatcher** creates a scheduled job + checklist **by voice** and assigns it to **Field Tech**.
2. **Field Tech** completes items **by phone camera**; a **VLM** auto-verifies evidence and checks off items when confidence passes thresholds.
3. Ship quickly and safely by **reusing JobEye v3** primitives: RLS, partitions, cost ledger, Realtime private channels.

---

## 0. Definition of Done (P0)

* Voice job create succeeds **≥85%** without edits on clean commands; retries within 24h remain **idempotent**.
* Auto-check-off for clear scenes **≥70%** with **<2%** false accepts; manual confirm flow covers the rest.
* **No cross-company leakage** (RLS tests pass). **Realtime** uses **private channels** only.
* **Cost guards**: model usage throttled per v3 thresholds; never exceeds daily cap.

---

## 1. Assumptions (agent must verify or create)

* Backend: Next.js 14 API Routes, TypeScript, Supabase Edge Functions + separate **queue-worker**.
* DB: Postgres 15 (Supabase), extensions from v3 enabled.
* Mobile: React Native (or web PWA) using Supabase auth + Realtime.
* Providers: ASR (OpenAI Whisper or equivalent), LLM (GPT-4.x class), VLM (vision-capable models).
* JobEye baseline is deployed (RLS, multi-tenant, auth, voice logger).

---

## 2. Migrations (DDL) — additive & safe

> Run as a single migration: `supabase/migrations/2025-10-voice-vision-p0.sql`

### 2.1 Fix auth helper (precedence bug)

```sql
-- Ensure this overrides any prior definition
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid;
$$ LANGUAGE sql STABLE;
```

*Why:* Avoids casting the literal `'sub'`; required by multiple RLS policies.

### 2.2 New tables aligned with JobEye architecture

```sql
-- Add job scheduling tables (Phase 4 domain)
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  job_template_id uuid REFERENCES job_templates(id),
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  due_by timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  priority text DEFAULT 'normal',
  checklist jsonb DEFAULT '[]'::jsonb,
  voice_source_media_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Media storage for voice and images
CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES users(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT valid_type CHECK (type IN ('audio', 'image', 'video'))
);

-- ASR outputs (Phase 3 - Voice Pipeline)
CREATE TABLE voice_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES conversation_sessions(id) ON DELETE RESTRICT,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  language text,
  transcript text NOT NULL,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  words jsonb,
  tokens_used int,
  cost_usd numeric(18,6),
  error text,
  created_at timestamptz DEFAULT now()
);

-- Intent recognition outputs (Phase 3)
CREATE TABLE intent_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid REFERENCES voice_transcripts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  intent text NOT NULL,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  entities jsonb NOT NULL,
  raw_response jsonb,
  tokens_used int,
  cost_usd numeric(18,6),
  created_at timestamptz DEFAULT now()
);

-- Vision verification outputs (Phase 4)
CREATE TABLE vision_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  checklist_item_id text NOT NULL,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  meets_criteria boolean NOT NULL,
  reasons jsonb,
  hints jsonb,
  tokens_used int,
  cost_usd numeric(18,6),
  created_at timestamptz DEFAULT now()
);

-- Idempotency tracking
CREATE TABLE request_deduplication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  response jsonb,
  first_seen timestamptz DEFAULT now(),
  UNIQUE (company_id, request_hash)
);
```

### 2.3 Indexes for performance

```sql
CREATE INDEX idx_jobs_company_scheduled ON jobs(company_id, scheduled_start);
CREATE INDEX idx_jobs_assignee ON jobs(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_media_assets_company_type ON media_assets(company_id, type);
CREATE INDEX idx_voice_transcripts_session ON voice_transcripts(session_id);
CREATE INDEX idx_vision_verifications_job ON vision_verifications(job_id);
```

### 2.4 Updated-at triggers

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_jobs
BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 2.5 RLS policies aligned with JobEye multi-tenant pattern

```sql
-- Enable RLS on all new tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_deduplication ENABLE ROW LEVEL SECURITY;

-- Jobs: users can only see/modify jobs in their company
CREATE POLICY jobs_company_isolation ON jobs
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Media assets: company isolation
CREATE POLICY media_company_isolation ON media_assets
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Voice transcripts: access via session company
CREATE POLICY transcripts_company_isolation ON voice_transcripts
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_sessions cs
    JOIN users u ON u.id = auth.uid()
    WHERE cs.id = voice_transcripts.session_id 
    AND cs.company_id = u.company_id
  )
);

-- Intent recognitions: access via transcript
CREATE POLICY intents_company_isolation ON intent_recognitions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM voice_transcripts vt
    JOIN conversation_sessions cs ON cs.id = vt.session_id
    JOIN users u ON u.id = auth.uid()
    WHERE vt.id = intent_recognitions.transcript_id 
    AND cs.company_id = u.company_id
  )
);

-- Vision verifications: access via job
CREATE POLICY vision_company_isolation ON vision_verifications
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN users u ON u.id = auth.uid()
    WHERE j.id = vision_verifications.job_id 
    AND j.company_id = u.company_id
  )
);

-- Request deduplication: company isolation
CREATE POLICY dedup_company_isolation ON request_deduplication
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));
```

---

## 3. JSON Contracts (strict; validate server-side)

### 3.1 Voice intent (LLM output)

```typescript
interface VoiceJobIntent {
  intent: "create_scheduled_job";
  confidence: number;
  slots: {
    job_type: "mowing" | "trimming" | "cleanup" | "irrigation" | "custom";
    customer_name: string;
    property_name?: string;
    start_at: string; // ISO 8601
    duration_minutes: number;
    assignee_name_or_email: string;
    priority: "low" | "normal" | "high" | "urgent";
    checklist_items: Array<{
      title: string;
      evidence_type: ("photo" | "video")[];
      acceptance_criteria: string;
      vlm_prompt?: string;
    }>;
    notes?: string;
  };
}
```

### 3.2 Checklist stored on `jobs.checklist`

```typescript
interface ChecklistItem {
  id: string; // e.g., "ck-1"
  title: string;
  status: "pending" | "in_progress" | "complete" | "failed";
  evidence_type: ("photo" | "video")[];
  vlm_prompt: string;
  acceptance_criteria: string;
  evidence_media_ids: string[];
  verifications: Array<{
    at: string; // ISO timestamp
    by: string; // user uuid
    confidence: number;
    auto: boolean;
    provider?: string;
  }>;
  notes?: string;
}
```

---

## 4. API Surface (Next.js API Routes)

### 4.1 Voice intake endpoint

```typescript
// src/app/api/voice/intake/route.ts
POST /api/voice/intake
Headers: Authorization: Bearer <jwt>
Body: { session_id: string }
Response: {
  upload_url: string;  // Supabase Storage signed URL
  media_id: string;    // UUID for tracking
  expires_at: string;  // ISO timestamp
}
```

### 4.2 Create job from voice

```typescript
// src/app/api/jobs/from-voice/route.ts
POST /api/jobs/from-voice
Headers: 
  - Authorization: Bearer <jwt>
  - Idempotency-Key: <uuid>
Body: {
  transcript_id: string;
  intent_recognition_id: string;
  confirm_entities?: {
    customer_id?: string;
    property_id?: string;
    assignee_id?: string;
  }
}
Response 201: {
  job_id: string;
  checklist_count: number;
  assignee_id: string;
  scheduled_start: string;
  requires_confirmation?: string[]; // e.g., ["customer", "assignee"]
}
```

### 4.3 Upload evidence & verify

```typescript
// src/app/api/jobs/[jobId]/checklist/[itemId]/evidence/route.ts
POST /api/jobs/{jobId}/checklist/{itemId}/evidence
Headers: Authorization: Bearer <jwt>
Body: { media_id: string }
Response 200: {
  status: "complete" | "needs_more_evidence" | "processing";
  confidence?: number;
  hints?: string[];
  verification_id?: string;
}
```

---

## 5. Domain Services (JobEye Architecture)

### 5.1 Voice domain (Phase 3)

```typescript
// src/domains/voice/services/voice-intake-service.ts
// --- AGENT DIRECTIVE BLOCK ---
// phase: 3
// domain: voice-pipeline
// purpose: Handle voice recording intake and ASR processing
// migrations_touched:
//   - 2025-10-voice-vision-p0.sql
// state_machine:
//   id: voice_intake_fsm
//   states: [uploaded, processing, transcribed, failed]
// estimated_llm_cost:
//   tokens_per_operation: 500
//   operations_per_day: 1000
//   monthly_cost_usd: 15.00
// offline_capability: OPTIONAL
// --- END DIRECTIVE BLOCK ---
```

### 5.2 Intent recognition service (Phase 3)

```typescript
// src/domains/voice/services/intent-recognition-service.ts
// --- AGENT DIRECTIVE BLOCK ---
// phase: 3
// domain: voice-pipeline
// purpose: Parse transcripts into structured job intents
// migrations_touched:
//   - 2025-10-voice-vision-p0.sql
// estimated_llm_cost:
//   tokens_per_operation: 1000
//   operations_per_day: 500
//   monthly_cost_usd: 25.00
// --- END DIRECTIVE BLOCK ---
```

### 5.3 Job creation service (Phase 4)

```typescript
// src/domains/jobs/services/job-from-voice-service.ts
// --- AGENT DIRECTIVE BLOCK ---
// phase: 4
// domain: job-execution
// purpose: Create jobs from voice intents with entity resolution
// migrations_touched:
//   - 2025-10-voice-vision-p0.sql
// state_machine:
//   id: job_creation_fsm
//   states: [parsing, resolving_entities, creating, completed, failed]
// offline_capability: NONE
// --- END DIRECTIVE BLOCK ---
```

### 5.4 Vision verification service (Phase 4)

```typescript
// src/domains/vision/services/checklist-verification-service.ts
// --- AGENT DIRECTIVE BLOCK ---
// phase: 4
// domain: job-execution
// purpose: Verify checklist items using VLM analysis
// migrations_touched:
//   - 2025-10-voice-vision-p0.sql
// estimated_llm_cost:
//   tokens_per_operation: 2000
//   operations_per_day: 2000
//   monthly_cost_usd: 120.00
// --- END DIRECTIVE BLOCK ---
```

---

## 6. Workers & Queue Architecture

### 6.1 ASR Worker

```typescript
// src/workers/voice-transcription-worker.ts
interface ASRWorkerConfig {
  concurrency_per_company: 2;
  retry_config: {
    max_attempts: 3;
    backoff_ms: [1000, 5000, 15000];
  };
  providers: ["openai-whisper", "assembly-ai"];
}
```

### 6.2 Intent Recognition Worker

```typescript
// src/workers/intent-recognition-worker.ts
interface IntentWorkerConfig {
  concurrency_per_company: 1;
  llm_config: {
    model: "gpt-4-turbo";
    temperature: 0.1;
    structured_output: true;
  };
}
```

### 6.3 VLM Verification Worker

```typescript
// src/workers/vision-verification-worker.ts
interface VLMWorkerConfig {
  concurrency_per_company: 2;
  consensus_config: {
    models: ["gpt-4-vision", "claude-3-opus"];
    threshold_multi: 0.80;
    threshold_single: 0.90;
  };
  cost_controls: {
    max_tokens_per_request: 4096;
    downgrade_near_budget: true;
  };
}
```

---

## 7. Realtime Integration

```typescript
// Channel naming for JobEye multi-tenant
const channelPatterns = {
  companyJobs: (companyId: string) => `company:${companyId}:jobs`,
  userAssignments: (userId: string) => `user:${userId}:assignments`,
  jobUpdates: (jobId: string) => `job:${jobId}:updates`
};

// Private channel configuration
const realtimeConfig = {
  private: true,
  presence: { key: 'user_id' }
};
```

---

## 8. Client Components (Phase 5)

### 8.1 Voice Job Creation

```typescript
// src/app/(app)/jobs/voice/page.tsx
// Features:
// - Audio recording with waveform visualization
// - Real-time transcription preview
// - Entity confirmation UI
// - Checklist builder from voice
```

### 8.2 Field Checklist UI

```typescript
// src/app/(app)/jobs/[id]/checklist/page.tsx
// Features:
// - Camera integration
// - Real-time verification status
// - Confidence indicators
// - Hint display for retakes
// - Offline queue visual indicator
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// src/domains/voice/services/__tests__/voice-intake-service.test.ts
// src/domains/jobs/services/__tests__/job-from-voice-service.test.ts
// src/domains/vision/services/__tests__/checklist-verification-service.test.ts
```

### 9.2 Integration Tests

```typescript
// scripts/test/voice-job-e2e.ts
// Full flow: upload audio → transcribe → parse → create job → verify RLS
```

### 9.3 RLS Security Tests

```sql
-- supabase/tests/rls-voice-vision.sql
-- Using pgtap to verify:
-- 1. No cross-company data access
-- 2. Proper user authorization
-- 3. Media asset isolation
```

---

## 10. Rollout Plan

### 10.1 Feature Flags

```typescript
// src/core/config/feature-flags.ts
export const VOICE_FEATURES = {
  ENABLE_VOICE_JOB_CREATION: process.env.NEXT_PUBLIC_ENABLE_VOICE_JOBS === 'true',
  ENABLE_VLM_VERIFICATION: process.env.NEXT_PUBLIC_ENABLE_VLM_VERIFY === 'true',
  VOICE_PROVIDERS: ['openai-whisper'],
  VLM_PROVIDERS: ['gpt-4-vision']
};
```

### 10.2 Monitoring & Observability

```typescript
// Extend existing JobEye audit_logs
interface VoiceAuditEntry {
  entity_type: 'voice_job_create' | 'checklist_verify';
  entity_id: string;
  action: string;
  metadata: {
    tokens_used?: number;
    cost_usd?: number;
    latency_ms?: number;
    confidence?: number;
    provider?: string;
  };
}
```

---

## 11. Implementation Checklist

### Phase 1: Database & Infrastructure
- [ ] Create and run migration `2025-10-voice-vision-p0.sql`
- [ ] Verify RLS policies with pgtap tests
- [ ] Set up Supabase Storage buckets for audio/images
- [ ] Configure cost tracking integration

### Phase 2: Voice Pipeline (Domain Phase 3)
- [ ] Implement voice intake service & API route
- [ ] Create ASR worker with retry logic
- [ ] Build intent recognition service
- [ ] Add voice-specific logging with metadata
- [ ] Create unit tests for voice pipeline

### Phase 3: Job Creation (Domain Phase 4)
- [ ] Implement job-from-voice service
- [ ] Add entity resolution logic
- [ ] Create idempotency middleware
- [ ] Build API route with proper validation
- [ ] Add Realtime notifications

### Phase 4: Vision Verification (Domain Phase 4)
- [ ] Implement VLM verification service
- [ ] Create vision worker with consensus logic
- [ ] Build evidence upload API
- [ ] Add cost controls and throttling
- [ ] Create verification status UI

### Phase 5: Client UI (Domain Phase 5)
- [ ] Build voice job creation screen
- [ ] Create checklist management UI
- [ ] Add camera integration
- [ ] Implement offline queue
- [ ] Add progress indicators

### Phase 6: Testing & Deployment
- [ ] Complete unit test coverage
- [ ] Run end-to-end tests
- [ ] Execute RLS security tests
- [ ] Deploy with feature flags disabled
- [ ] Shadow test on internal company
- [ ] Enable for pilot customers
- [ ] Monitor metrics and costs

---

## 12. Success Metrics

```sql
-- Materialized views for monitoring
CREATE MATERIALIZED VIEW voice_job_metrics AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  AVG(confidence) as avg_confidence,
  SUM(cost_usd) as total_cost
FROM voice_transcripts
GROUP BY 1;

CREATE MATERIALIZED VIEW checklist_verification_metrics AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_verifications,
  COUNT(*) FILTER (WHERE meets_criteria) as auto_approved,
  AVG(confidence) as avg_confidence,
  SUM(cost_usd) as total_cost
FROM vision_verifications
GROUP BY 1;
```

---

This plan is now **agent-executable** within the JobEye codebase, following its Architecture-as-Code patterns and leveraging existing infrastructure for auth, multi-tenant isolation, and logging.