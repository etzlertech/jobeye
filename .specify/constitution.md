# JobEye Constitution

## Core Principles

This document establishes the fundamental architectural principles and governance rules for the JobEye Voice-First Field Service Management System.

## 1. Database Architecture: Supabase Multi-Tenant with RLS-First

### Principles
- **Tenant Isolation at Database Level**: Every table includes `company_id` for multi-tenant separation
- **Row Level Security (RLS) Mandatory**: All tables must have RLS policies enabled
- **No Bypass Patterns**: Application code cannot circumvent RLS except through dedicated admin functions
- **Service Role Minimal Use**: Service role key usage limited to admin operations and background jobs

### Implementation Rules
```sql
-- Every table must include:
company_id UUID NOT NULL REFERENCES companies(id),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()

-- RLS pattern for all tables (CRITICAL: use app_metadata path):
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON table_name
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );
```

**CRITICAL NOTE ON RLS POLICIES:**
- RLS policies MUST check `request.jwt.claims -> 'app_metadata' ->> 'company_id'`
- DO NOT use `auth.jwt() ->> 'company_id'` (that path doesn't exist)
- User's company_id is stored in JWT's `app_metadata` object by Supabase Auth
- Set user's company_id via: `auth.admin.createUser({ app_metadata: { company_id: '...' } })`

### Executing Database Changes
**The ONLY reliable method to apply SQL migrations to hosted Supabase:**

```typescript
// Create scripts/apply-migration.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Execute SQL via RPC
const { error } = await client.rpc('exec_sql', {
  sql: 'DROP POLICY IF EXISTS old_policy ON my_table;'
});
```

**Why this method:**
- ❌ `psql` not available in most environments
- ❌ `npx supabase db push` fails with connection errors
- ✅ `client.rpc('exec_sql')` always works via HTTPS

**Examples:**
- `scripts/fix-rls-policies.ts` - Fixed RLS to use app_metadata
- `scripts/apply-job-limit-trigger.ts` - Added database trigger

### Testing Requirements
- Integration tests must verify cross-tenant access denial
- Each repository must include RLS isolation tests
- Admin bypass operations require explicit audit logging
- Test users must have `app_metadata.company_id` set in their JWT

## 2. Hybrid Vision Pipeline Architecture

### Design Rationale
- **Current State**: VLM First approach - all vision tasks processed by cloud Vision Language Models
- **Future State**: Local YOLO Prefilter - Run YOLOv11 locally at ~1 fps for real-time object detection
- **Staged Development**: YOLO infrastructure is developed and staged in some areas but not yet active
- **Cost Optimization Goal**: When YOLO is activated, 90%+ of vision tasks will be handled locally

### Implementation Standards
```typescript
// Vision pipeline configuration
const VISION_CONFIG = {
  yolo: {
    enabled: false,      // Currently staged but not active
    model: 'yolov11n',  // Nano model for edge performance (when activated)
    fps: 1,             // Target frame rate
    confidence: 0.7,    // Minimum confidence for local decision
  },
  vlm: {
    provider: 'openai', // or 'anthropic', 'google'
    maxCost: 0.10,      // Per-request budget limit
    timeout: 5000,      // Milliseconds
    primary: true,      // VLM is primary until YOLO activated
  }
};
```

### Performance Requirements
- VLM requests must complete within 5 seconds (current)
- YOLO inference must complete within 1 second (when activated)
- VLM usage rate will drop below 10% after YOLO activation
- Total vision processing cost < $0.50 per job average (target)

## 3. Voice-First UX with Offline-First PWA

### Progressive Web App Requirements
- **Manifest**: Complete PWA manifest with voice-activation capabilities
- **Service Worker**: Background sync for offline command queuing
- **IndexedDB**: Local storage for voice sessions and commands
- **WebRTC**: Direct voice capture without server round-trips

### Offline Behavior Standards
```typescript
// All voice commands must support offline queueing
interface VoiceCommand {
  id: string;
  timestamp: number;
  transcript: string;
  intent: string;
  offlineCapable: boolean;
  syncPriority: 'high' | 'medium' | 'low';
}

// Service worker must implement:
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-voice-commands') {
    event.waitUntil(syncPendingCommands());
  }
});
```

### Voice Interaction Principles
- Every UI action must have voice equivalent
- Voice commands take precedence over touch/click
- Feedback must be both visual and auditory
- Commands must gracefully degrade when offline

## 4. Cost & Model Governance

### Budget Enforcement
```typescript
interface CostGovernance {
  daily: {
    stt: 10.00,      // Speech-to-text daily limit
    tts: 5.00,       // Text-to-speech daily limit
    vlm: 25.00,      // Vision model daily limit
    llm: 50.00,      // Language model daily limit
  },
  perRequest: {
    stt: 0.10,       // Max per transcription
    tts: 0.05,       // Max per synthesis
    vlm: 0.25,       // Max per vision analysis
    llm: 0.50,       // Max per completion
  }
}
```

### Fallback Tier Strategy
1. **Tier 1**: Premium models (GPT-4, Claude-3) for complex tasks
2. **Tier 2**: Standard models (GPT-3.5, Claude-2) for routine work
3. **Tier 3**: Local models (Whisper, YOLO) for high-volume ops
4. **Tier 4**: Cached responses and template-based fallbacks

### Cost Tracking Requirements
- Every AI operation must record estimated cost
- Daily budgets enforced at repository level
- Cost alerts triggered at 80% threshold
- Monthly reports per company and user

## 5. Development Standards

### Agent Directive Blocks
Every TypeScript/JavaScript file must begin with:
```typescript
/**
 * @file /absolute/path/to/file.ts
 * @phase 1-5
 * @domain DomainName
 * @purpose Brief description
 * @complexity_budget 300
 * @test_coverage ≥80%
 */
```

### Complexity Budget Enforcement
- Default: 300 lines per file
- Maximum: 500 lines with justification
- Violation blocks PR merge
- Refactoring required for overages

### Testing Requirements
- **Unit Tests**: ≥80% coverage mandatory
- **Integration Tests**: Database operations with RLS
- **E2E Tests**: Critical user voice flows
- **Performance Tests**: Vision pipeline latency
- **Cost Tests**: AI operation budget compliance

### Pre-Commit Gates
```yaml
pre-commit:
  - typescript-compile
  - eslint-check
  - directive-validation
  - complexity-check
  - test-coverage (≥80%)
  - dependency-analysis
  - cost-estimation
```

## 6. Architectural Invariants

### Non-Negotiable Rules
1. **No Direct Database Access**: All DB operations through repository pattern
2. **No Synchronous AI Calls**: All AI operations must be async with timeouts
3. **No Untracked Costs**: Every LLM/VLM call must record estimated cost
4. **No Silent Failures**: All errors must be logged with voice context
5. **No Stateless Voice**: All voice interactions must maintain session state

### Performance Baselines
- Page Load: < 3 seconds on 3G
- Voice Response: < 2 seconds for local commands
- Vision Processing: < 1.5 seconds for YOLO detection
- Offline Sync: < 10 seconds when connection restored
- Battery Impact: < 5% per hour of active use

## 7. Evolution & Amendment Process

### Constitutional Changes
1. Proposed changes require architectural decision record (ADR)
2. Performance impact analysis mandatory
3. Cost impact projection required
4. Team review with 48-hour comment period
5. Unanimous approval for core principle changes

### Monitoring & Enforcement
- Automated checks in CI/CD pipeline
- Weekly architecture review meetings
- Monthly cost and performance audits
- Quarterly principle reassessment

## 8. 🚨 NON-NEGOTIABLES (MANDATORY) 🚨

These rules are ABSOLUTE and MUST be followed by all agents and humans working on this codebase. No exceptions.

### ✅ RULE 1: ACTUAL DB PRECHECK (MANDATORY)

**BEFORE proposing or executing ANY migration SQL:**

- [ ] **SET** proper SUPABASE_DB_URL (with PGBouncer) before running any migrations or seed scripts
- [ ] **CONNECT** directly to the Supabase database using service credentials
- [ ] **INSPECT** the ACTUAL state:
  - Tables (names, columns, types) via information_schema
  - Indexes and constraints
  - RLS policies
  - Row counts
  - Current schema version
- [ ] **READ** the actual schema from information_schema to decide when to insert records (e.g., company records)
- [ ] **RUN** `scripts/check-actual-db.ts` (or equivalent) and include findings in ALL plans/tasks
- [ ] **APPLY** migration statements one by one instead of relying on multi-statement DO $$ blocks
- [ ] **USE** idempotent reconciler style:
  ```sql
  -- ✅ CORRECT: Idempotent, single statements
  CREATE TABLE IF NOT EXISTS ...;
  
  -- Check before creating index
  CREATE INDEX IF NOT EXISTS idx_name ON ...;
  
  -- ❌ WRONG: Assumes state, multi-statement blocks
  DO $$ BEGIN
    -- Complex multi-statement logic
  END $$;
  
  -- ❌ WRONG: Non-idempotent
  CREATE TABLE ...
  DROP TABLE ...
  ```
- [ ] **NEVER** drop or rename without an explicit data migration plan approved in the spec

**WHY**: Migration files often drift from actual database state. Tables expected to exist may not exist, or may have different schemas than migration files suggest. Multi-statement blocks can fail partially, leaving the database in an inconsistent state.

### ✅ RULE 2: PUSH AFTER COMMIT (MANDATORY)

**AFTER EVERY commit:**

- [ ] **ATTEMPT** `git push` IMMEDIATELY
- [ ] **IF** push fails due to auth/remote/keys:
  - [ ] **READ** project docs for connection guidance
  - [ ] **VERIFY** remotes and branches: `git remote -v` and `git branch -a`
  - [ ] **ONLY THEN** ask the user for missing tokens/keys or PATs
- [ ] **NEVER** leave a sequence of commits unpushed unless user explicitly instructs otherwise
- [ ] **ALWAYS** inform user of push status:
  ```bash
  # After successful push:
  "✅ Pushed commit abc123 to origin/branch-name"
  
  # After failed push:
  "❌ Push failed: [specific error]. Need GitHub PAT to continue."
  ```

**WHY**: Unpushed commits are lost work. Users expect their commits to be safely stored on the remote immediately.

### Enforcement

1. **Pre-Migration Checklist**: Every migration PR must include output from `check-actual-db.ts`
2. **Post-Commit Hook**: CI/CD will verify all commits are pushed within 5 minutes
3. **Audit Trail**: All database prechecks logged with timestamp and findings
4. **Violations**: Any violation of these rules blocks PR merge and requires remediation

---

Last Updated: 2025-01-27
Version: 1.1.1