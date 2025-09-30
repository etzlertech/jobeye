# Data Model: Feature 005 - Field Intelligence
**Date:** 2025-09-30
**Task:** T009
**Status:** Complete

---

## Critical Context from DB Precheck (T001)

🚨 **ALL 15 Feature 005 tables ALREADY EXIST in live database** (0 rows each)

**Implications**:
1. Migrations T011-T025 CANNOT use simple CREATE TABLE
2. Must use **schema reconciliation approach** (check existing schema → add missing columns)
3. Must verify RLS policies before creating them

---

## Tenancy Model Decision

### Standard: `tenant_id` (not `company_id`)

**Rationale**:
- Current database: 14 tables use `tenant_id`, 6 tables use `company_id`
- Parallel work (TENANCY.md) standardizing on `tenant_id`
- Feature 005 aligns with standard to avoid future migration

**RLS Pattern** (unchanged):
```sql
-- Even though table uses tenant_id, JWT claim path is still company_id
CREATE POLICY tenant_isolation ON table_name
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );
```

---

## Table Schemas

### 1. safety_checklists

**Purpose**: Reusable safety checklist templates for jobs/equipment

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS safety_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  required_for JSONB DEFAULT '[]'::jsonb,  -- e.g., [{"type": "job_type", "value": "irrigation"}]
  items JSONB DEFAULT '[]'::jsonb,  -- Array of {task, type, photo_required, critical, sequence}
  frequency TEXT CHECK (frequency IN ('per-job', 'daily', 'weekly', 'monthly')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_checklists_tenant ON safety_checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_checklists_required ON safety_checklists USING GIN(required_for);
```

**Sample Data**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "Pre-Drive Trailer Safety",
  "required_for": [{"type": "equipment", "value": "trailer"}],
  "items": [
    {"task": "Hitch locked with pin", "type": "photo", "photo_required": true, "critical": true, "sequence": 1},
    {"task": "Safety chains crossed", "type": "photo", "photo_required": true, "critical": true, "sequence": 2},
    {"task": "Lights functioning", "type": "photo", "photo_required": true, "critical": false, "sequence": 3}
  ],
  "frequency": "per-job"
}
```

### 2. safety_checklist_completions

**Purpose**: Records of completed safety inspections

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS safety_checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES safety_checklists(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  items_completed JSONB DEFAULT '[]'::jsonb,  -- Array of {item_id, value, photo_id, notes}
  location JSONB,  -- {lat, lng}
  signature TEXT,  -- Base64 signature image
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_completions_checklist ON safety_checklist_completions(checklist_id);
CREATE INDEX IF NOT EXISTS idx_safety_completions_job ON safety_checklist_completions(job_id);
CREATE INDEX IF NOT EXISTS idx_safety_completions_user ON safety_checklist_completions(user_id);
```

### 3. daily_routes

**Purpose**: Optimized daily route plans for technicians

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS daily_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'optimized', 'active', 'completed', 'cancelled')),
  optimization_params JSONB DEFAULT '{}'::jsonb,  -- {criteria: 'time', includeLunch: true}
  total_distance_km NUMERIC(10,2),
  estimated_duration_min INT,
  actual_duration_min INT,
  mapbox_route_id TEXT,  -- Mapbox Optimization API response ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_daily_routes_tenant ON daily_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_routes_user_date ON daily_routes(assigned_to, route_date);
CREATE INDEX IF NOT EXISTS idx_daily_routes_date ON daily_routes(route_date);
```

### 4. route_waypoints

**Purpose**: Individual stops on a route (jobs, breaks, material stops)

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS route_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES daily_routes(id) ON DELETE CASCADE,
  waypoint_type TEXT NOT NULL CHECK (waypoint_type IN ('start', 'job', 'break', 'material_stop', 'equipment_swap', 'end')),
  sequence_order INT NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  location JSONB NOT NULL,  -- {lat, lng, address}
  scheduled_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  scheduled_departure TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  estimated_duration_min INT,
  notes TEXT,
  skipped BOOLEAN DEFAULT FALSE,
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_waypoints_route ON route_waypoints(route_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_route_waypoints_job ON route_waypoints(job_id);
```

### 5. route_events

**Purpose**: Audit trail of route lifecycle events

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS route_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES daily_routes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('start', 'arrival', 'departure', 're-optimization', 'delay', 'completion')),
  waypoint_id UUID REFERENCES route_waypoints(id) ON DELETE SET NULL,
  event_time TIMESTAMPTZ DEFAULT NOW(),
  location JSONB,  -- {lat, lng}
  metadata JSONB DEFAULT '{}'::jsonb,  -- {reason, traffic_delay, weather}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_events_route ON route_events(route_id, event_time);
CREATE INDEX IF NOT EXISTS idx_route_events_waypoint ON route_events(waypoint_id);
```

### 6. route_optimizations

**Purpose**: Track route re-optimization requests and costs

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES daily_routes(id) ON DELETE CASCADE,
  optimization_time TIMESTAMPTZ DEFAULT NOW(),
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'job_added', 'job_removed', 'traffic_delay', 'emergency')),
  before_waypoints JSONB DEFAULT '[]'::jsonb,  -- Snapshot of waypoints before
  after_waypoints JSONB DEFAULT '[]'::jsonb,  -- Snapshot after
  distance_saved_km NUMERIC(10,2),
  time_saved_min INT,
  mapbox_request_id TEXT,
  cost_usd NUMERIC(10,4) DEFAULT 0.0000,  -- Track Mapbox API usage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_optimizations_route ON route_optimizations(route_id, optimization_time);
```

### 7. intake_sessions

**Purpose**: Smart capture sessions for customer/vendor/property intake

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS intake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('business_card', 'property', 'vehicle', 'signage')),
  media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  location JSONB,  -- {lat, lng}
  context JSONB DEFAULT '{}'::jsonb,  -- {job_id, property_id, customer_id}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_sessions_tenant ON intake_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_user ON intake_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_type ON intake_sessions(session_type);
```

### 8. intake_extractions

**Purpose**: OCR/VLM extraction results from intake sessions

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS intake_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES intake_sessions(id) ON DELETE CASCADE,
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('ocr', 'vlm', 'hybrid')),
  provider TEXT,  -- 'tesseract', 'gpt-4-vision', etc.
  raw_text TEXT,
  structured_data JSONB DEFAULT '{}'::jsonb,  -- {name, company, phone, email, address}
  confidence_scores JSONB DEFAULT '{}'::jsonb,  -- {name: 0.95, phone: 0.87}
  cost_usd NUMERIC(10,4) DEFAULT 0.0000,
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_extractions_session ON intake_extractions(session_id);
```

### 9. contact_candidates

**Purpose**: Pending customer/vendor contacts from intake awaiting approval

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS contact_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id UUID NOT NULL REFERENCES intake_sessions(id) ON DELETE CASCADE,
  candidate_type TEXT NOT NULL CHECK (candidate_type IN ('customer_contact', 'vendor_contact', 'property_owner')),
  extracted_data JSONB DEFAULT '{}'::jsonb,  -- {name, company, phone, email, address}
  match_confidence NUMERIC(5,2),  -- 0.00-100.00
  existing_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  existing_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_record_id UUID,  -- ID of created customer/vendor after approval
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_candidates_session ON contact_candidates(intake_session_id);
CREATE INDEX IF NOT EXISTS idx_contact_candidates_status ON contact_candidates(status);
CREATE INDEX IF NOT EXISTS idx_contact_candidates_type ON contact_candidates(candidate_type);
```

### 10. property_candidates

**Purpose**: Pending properties from intake awaiting approval

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS property_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id UUID NOT NULL REFERENCES intake_sessions(id) ON DELETE CASCADE,
  extracted_data JSONB DEFAULT '{}'::jsonb,  -- {address, building_type, features, coordinates}
  match_confidence NUMERIC(5,2),
  existing_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_candidates_session ON property_candidates(intake_session_id);
CREATE INDEX IF NOT EXISTS idx_property_candidates_status ON property_candidates(status);
```

### 11. job_tasks

**Purpose**: Individual tasks within a job (voice/OCR created, template-based)

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS job_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  template_task_id UUID,  -- Link to template if from template
  task_name TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
  sequence_order INT NOT NULL,
  required BOOLEAN DEFAULT TRUE,
  depends_on_task_id UUID REFERENCES job_tasks(id) ON DELETE SET NULL,
  estimated_duration_min INT,
  actual_duration_min INT,
  completion_method TEXT CHECK (completion_method IN ('voice', 'photo', 'manual', 'auto')),
  completion_photo_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  completion_evidence JSONB DEFAULT '{}'::jsonb,  -- {vision_confidence, voice_transcript_id}
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voice_transcript_id UUID REFERENCES voice_transcripts(id) ON DELETE SET NULL,
  created_from TEXT CHECK (created_from IN ('voice', 'ocr', 'template', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_tasks_job ON job_tasks(job_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_job_tasks_status ON job_tasks(status);
CREATE INDEX IF NOT EXISTS idx_job_tasks_assigned ON job_tasks(assigned_to);
```

### 12. task_templates

**Purpose**: Reusable task list templates for common job types

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  job_type TEXT,  -- 'lawn_mowing', 'irrigation_repair', etc.
  default_tasks JSONB DEFAULT '[]'::jsonb,  -- Array of {name, description, required, sequence, estimated_duration}
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  usage_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_tenant ON task_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_job_type ON task_templates(job_type);
CREATE INDEX IF NOT EXISTS idx_task_templates_tags ON task_templates USING GIN(tags);
```

### 13. instruction_documents

**Purpose**: PDF/video guidance materials for jobs

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS instruction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('pdf', 'video', 'reference_image', 'sop')),
  media_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  required_viewing BOOLEAN DEFAULT FALSE,
  category TEXT,  -- 'equipment', 'technique', 'safety', 'customer_preference'
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instruction_documents_tenant ON instruction_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instruction_documents_category ON instruction_documents(category);
CREATE INDEX IF NOT EXISTS idx_instruction_documents_tags ON instruction_documents USING GIN(tags);
```

### 14. job_instructions

**Purpose**: Assignment of instruction documents to specific jobs

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS job_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  instruction_id UUID NOT NULL REFERENCES instruction_documents(id) ON DELETE CASCADE,
  required BOOLEAN DEFAULT FALSE,
  viewed_by JSONB DEFAULT '{}'::jsonb,  -- {user_id: {viewed_at, duration, acknowledged}}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, instruction_id)
);

CREATE INDEX IF NOT EXISTS idx_job_instructions_job ON job_instructions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_instructions_instruction ON job_instructions(instruction_id);
```

### 15. job_history_insights

**Purpose**: Learned patterns from historical job data (P2 - foundation only)

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS job_history_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('typical_duration', 'material_usage', 'crew_size', 'seasonal_pattern')),
  insight_key TEXT NOT NULL,
  insight_value JSONB NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,  -- 0.00-1.00
  sample_size INT NOT NULL,  -- Number of jobs used to calculate insight
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, job_type, insight_type, insight_key)
);

CREATE INDEX IF NOT EXISTS idx_job_insights_tenant ON job_history_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_insights_property ON job_history_insights(property_id);
CREATE INDEX IF NOT EXISTS idx_job_insights_customer ON job_history_insights(customer_id);
CREATE INDEX IF NOT EXISTS idx_job_insights_type ON job_history_insights(job_type, insight_type);
```

---

## Extended Tables (T026-T029)

### jobs (T026)

**New Columns**:
```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS arrival_photo_id UUID REFERENCES media_assets(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_quality_score INT CHECK (completion_quality_score BETWEEN 0 AND 100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_supervisor_review BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS supervisor_reviewed_by UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS supervisor_reviewed_at TIMESTAMPTZ;
```

### time_entries (T027)

**New Columns**:
```sql
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('job_work', 'travel', 'break', 'admin', 'equipment_swap'));
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS start_location JSONB;  -- {lat, lng}
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS end_location JSONB;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE;
```

### properties (T028)

**New Columns**:
```sql
ALTER TABLE properties ADD COLUMN IF NOT EXISTS intake_session_id UUID REFERENCES intake_sessions(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS reference_image_id UUID REFERENCES media_assets(id);
```

### customers (T029)

**New Columns**:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS intake_session_id UUID REFERENCES intake_sessions(id);
```

### vendors (T029)

**New Columns**:
```sql
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS intake_session_id UUID REFERENCES intake_sessions(id);

-- Also extend vendor_locations
ALTER TABLE vendor_locations ADD COLUMN IF NOT EXISTS coordinates JSONB;
ALTER TABLE vendor_locations ADD COLUMN IF NOT EXISTS geofence_radius_m INT DEFAULT 100;
```

---

## RLS Policies (All Tables)

**Template** (apply to ALL new tables):
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Check if policy already exists before creating
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'table_name' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON table_name
      FOR ALL USING (
        tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
      );
  END IF;
END $$;
```

**Special Cases**:

1. **safety_checklist_completions**: Additional user access control
```sql
CREATE POLICY tenant_isolation ON safety_checklist_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM safety_checklists sc
      WHERE sc.id = safety_checklist_completions.checklist_id
        AND sc.tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );
```

2. **route_waypoints, route_events, route_optimizations**: Tenant isolation via route_id
```sql
CREATE POLICY tenant_isolation ON route_waypoints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM daily_routes dr
      WHERE dr.id = route_waypoints.route_id
        AND dr.tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );
```

---

## Relationships Diagram

```
tenants (existing)
  ├─> safety_checklists
  │     └─> safety_checklist_completions
  │           └─> jobs (via job_id)
  │
  ├─> daily_routes
  │     ├─> route_waypoints
  │     │     └─> jobs (via job_id)
  │     ├─> route_events
  │     │     └─> route_waypoints (via waypoint_id)
  │     └─> route_optimizations
  │
  ├─> intake_sessions
  │     ├─> intake_extractions
  │     ├─> contact_candidates
  │     │     ├─> customers (match)
  │     │     └─> vendors (match)
  │     └─> property_candidates
  │           └─> properties (match)
  │
  ├─> task_templates
  │
  ├─> instruction_documents
  │     └─> job_instructions
  │           └─> jobs (via job_id)
  │
  └─> job_history_insights
        ├─> properties (via property_id)
        └─> customers (via customer_id)

jobs (extended)
  ├─> job_tasks
  │     ├─> job_tasks (depends_on_task_id)
  │     ├─> media_assets (completion_photo_id)
  │     └─> voice_transcripts (voice_transcript_id)
  ├─> media_assets (arrival_photo_id)
  └─> users (supervisor_reviewed_by)

time_entries (extended)
  └─> jobs (via job_id)

properties (extended)
  ├─> intake_sessions (intake_session_id)
  └─> media_assets (reference_image_id)

customers (extended)
  └─> intake_sessions (intake_session_id)

vendors (extended)
  └─> intake_sessions (intake_session_id)
```

---

## Migration Strategy (T011-T030)

### Step-by-Step Approach

**For NEW tables** (T011-T025):
1. Query `information_schema.columns` to see existing schema
2. `CREATE TABLE IF NOT EXISTS` (will be no-op since tables exist)
3. Check for missing columns, add with `ALTER TABLE IF NOT EXISTS`
4. Check for missing indexes, add with `CREATE INDEX IF NOT EXISTS`
5. Check for RLS policy, add conditionally via `DO $$ BEGIN ... END $$`

**For EXTENDED tables** (T026-T029):
1. Query existing columns
2. `ALTER TABLE ADD COLUMN IF NOT EXISTS` for each new column
3. Verify no column name conflicts

### Example Migration Script

```typescript
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function migrateTable() {
  // Step 1: Check existing schema
  const { data: columns } = await client.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'safety_checklists' AND table_schema = 'public';
    `
  });

  console.log('Existing columns:', columns);

  // Step 2: Create table (no-op if exists)
  const { error: createError } = await client.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS safety_checklists (...);`
  });

  if (createError) throw createError;

  // Step 3: Add missing columns (idempotent)
  const { error: alterError } = await client.rpc('exec_sql', {
    sql: `
      ALTER TABLE safety_checklists ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
    `
  });

  if (alterError) throw alterError;

  // Step 4: Create RLS policy (conditional)
  const { error: rlsError } = await client.rpc('exec_sql', {
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'safety_checklists' AND policyname = 'tenant_isolation'
        ) THEN
          ALTER TABLE safety_checklists ENABLE ROW LEVEL SECURITY;
          CREATE POLICY tenant_isolation ON safety_checklists ...;
        END IF;
      END $$;
    `
  });

  if (rlsError) throw rlsError;

  console.log('✅ Migration complete');
}

migrateTable().catch(console.error);
```

---

## Integration with Existing Features

### Feature 001 (Vision)

**Tables Used**:
- `vision_verifications` - Safety photo verification, completion quality
- `vision_detected_items` - YOLO detection results
- `vision_cost_records` - Budget tracking

**Integration Points**:
- T064 (SafetyVerificationService) → query `vision_detected_items`
- T080 (CompletionWorkflowService) → query `vision_verifications`

### Feature 003 (Voice)

**Tables Used**:
- `voice_transcripts` - Task creation via voice
- `voice_sessions` - Context maintenance

**Integration Points**:
- T078 (TaskVoiceParserService) → link `job_tasks.voice_transcript_id`
- T082 (TimeTrackingService) → create via voice commands

---

## Summary

**Total New Tables**: 15
**Total Extended Tables**: 5
**Total Indexes**: 45+
**Total RLS Policies**: 15

**Key Decisions**:
- ✅ Use `tenant_id` (standardized, not `company_id`)
- ✅ Reconciliation approach (check existing schema, add missing only)
- ✅ Idempotent migrations (IF NOT EXISTS everywhere)
- ✅ Conditional RLS policy creation (DO $$ blocks)
- ✅ Vision integration via existing tables (no new tables needed)

**Next Steps**:
- ✅ T009 COMPLETE: Data model documented with reconciliation strategy
- ⏩ T010: Create API contracts (5 OpenAPI YAML files)
- ⏩ T011-T030: Execute migrations using reconciliation approach

---

**Document Created:** 2025-09-30
**Status:** Complete and ready for migration execution