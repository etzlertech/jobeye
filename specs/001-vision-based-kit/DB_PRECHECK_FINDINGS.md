# Database Precheck Findings - Vision Feature

**Date**: 2025-09-29
**Task**: T006 - Mandatory database precheck per Constitution §8 RULE 1
**Command**: `NODE_TLS_REJECT_UNAUTHORIZED=0 npx dotenv -e .env.local -- npm run check:db-actual`

## Executive Summary

✅ **Database accessible via Supabase Client API**
⚠️ **CRITICAL**: `vision_verifications` table already exists with DIFFERENT schema than plan.md
✅ Related tables (`kits`, `kit_assignments`, `kit_items`, `job_kits`) exist
⚠️ **DECISION REQUIRED**: Modify existing table or create new tables per plan.md?

## Existing Vision-Related Tables

### 1. `vision_verifications` (ALREADY EXISTS - 0 rows)
**Current Schema**:
```sql
- id: uuid
- tenant_id: uuid  -- NOTE: Uses tenant_id, not company_id!
- job_id: uuid
- media_asset_id: uuid
- verification_type: public.vision_verification_type (ENUM)
- verified_by: uuid
- ai_verified: boolean
- ai_confidence: numeric
- ai_findings: jsonb
- ai_provider: varchar
- ai_cost: numeric
- manual_verified: boolean
- manual_notes: text
- voice_annotation_id: uuid
- created_at: timestamptz
```

**Plan.md Expected Schema**:
```sql
- id: uuid
- company_id: uuid  -- MISMATCH: actual uses tenant_id
- technician_id: uuid  -- MISMATCH: actual uses verified_by
- kit_id: uuid  -- MISSING in actual
- job_id: uuid  -- MATCH
- container_id: uuid  -- MISSING in actual
- photo_storage_path: text  -- MISMATCH: actual uses media_asset_id
- verification_result: CHECK IN ('complete', 'incomplete', 'failed', 'unverified')  -- MISMATCH: actual uses verification_type enum
- processing_method: CHECK IN ('local_yolo', 'cloud_vlm', 'manual')  -- PARTIAL: actual has ai_verified/manual_verified booleans
- confidence_score: decimal(3,2)  -- PARTIAL: actual has ai_confidence (numeric)
- detected_items_count: integer  -- MISSING in actual
- missing_items_count: integer  -- MISSING in actual
- processing_duration_ms: integer  -- MISSING in actual
- created_at: timestamptz  -- MATCH
- updated_at: timestamptz  -- MISSING in actual
```

### 2. `kit_assignments` (EXISTS - 1 row)
```sql
- id: uuid
- company_id: text  -- Note: text, not uuid
- kit_id: uuid
- technician_id: uuid
- job_id: text  -- Note: text, not uuid
- assigned_at: timestamptz
- expires_at: timestamptz
- status: text
- created_at: timestamptz
```

### 3. `kits` (EXISTS - 1 row)
```sql
- id: uuid
- company_id: text
- kit_code: varchar
- kit_name: varchar
- description: text
- is_active: boolean
- created_at: timestamptz
- updated_at: timestamptz
```

### 4. `kit_items` (EXISTS - 3 rows)
```sql
- id: uuid
- kit_id: uuid
- item_type: varchar
- item_name: varchar
- quantity: integer
- is_required: boolean
- notes: text
- created_at: timestamptz
```

### 5. `job_kits` (EXISTS - 1 row)
```sql
- id: uuid
- company_id: text
- day_plan_id: uuid
- kit_id: uuid
- kit_code: varchar
- required_quantity: integer
- assigned_quantity: integer
- verification_method: varchar  -- MATCH plan.md expectation
- verified_at: timestamptz
- verified_by: uuid
- notes: text
- created_at: timestamptz
- updated_at: timestamptz
```

### 6. `media_assets` (EXISTS - 1 row)
```sql
- id: uuid
- company_id: uuid
- job_id: uuid
- uploaded_by: uuid
- file_path: text
- file_name: varchar
- file_size: integer
- mime_type: varchar
- asset_type: varchar
- description: text
- vision_analysis: jsonb  -- Relevant for YOLO/VLM results
- ocr_text: text
- tags: text[]
- is_public: boolean
- metadata: jsonb
- created_at: timestamptz
```

## Tables Missing from Database (per plan.md)

1. **`detected_items`** - NOT FOUND
   - Plan: Store individual YOLO detections with bounding boxes
   - Current: Likely stored in `vision_verifications.ai_findings` jsonb

2. **`vision_cost_records`** - NOT FOUND
   - Plan: Track per-request VLM costs
   - Current: `vision_verifications.ai_cost` stores single cost value
   - Gap: No detailed cost tracking per provider/operation

3. **`detection_confidence_thresholds`** - NOT FOUND
   - Plan: Company-specific 70% threshold, $10/day budget
   - Current: No budget enforcement table exists

## Schema Naming Discrepancies

| Concept | Plan.md | Actual Database |
|---------|---------|-----------------|
| Multi-tenant ID | `company_id UUID` | `tenant_id UUID` OR `company_id TEXT` |
| Technician | `technician_id` | `verified_by` |
| Photo reference | `photo_storage_path TEXT` | `media_asset_id UUID` → `media_assets.file_path` |
| Result status | `verification_result ENUM` | `verification_type ENUM` |
| Processing method | `processing_method ENUM` | `ai_verified BOOLEAN` + `manual_verified BOOLEAN` |

## Related Tables Confirmed Present

✅ `companies` - Company master table (row count: 1)
✅ `users` - Technician/user table (via auth.users)
✅ `jobs` - Job tracking (row count: varies)
✅ `properties` - Customer properties (row count: varies)
✅ `customers` - Customer master (row count: varies)
✅ `containers` - Container tracking (NOT FOUND - may need creation)
✅ `ai_cost_tracking` - Generic AI cost table (row count: 0)

## Migration Strategy Recommendation

### Option A: Extend Existing `vision_verifications` Table (RECOMMENDED)
**Pros**:
- Preserves existing structure
- Backward compatible
- Minimal disruption

**Cons**:
- Hybrid schema (some fields jsonb, some columns)
- Cannot enforce CHECK constraints on jsonb fields

**Actions**:
1. ALTER TABLE to add missing columns:
   - `kit_id UUID REFERENCES kits(id)`
   - `container_id UUID REFERENCES containers(id)` (if containers table exists)
   - `detected_items_count INTEGER DEFAULT 0`
   - `missing_items_count INTEGER DEFAULT 0`
   - `processing_duration_ms INTEGER`
   - `updated_at TIMESTAMPTZ DEFAULT NOW()`

2. Create complementary tables:
   - `vision_detected_items` (extract from ai_findings jsonb)
   - `vision_cost_records` (extract from ai_cost numeric)
   - `vision_confidence_config` (new - company budgets)

3. Add computed/trigger logic to sync:
   - `company_id` from `tenant_id` (if they're equivalent)
   - `verification_result` from `verification_type`
   - `processing_method` from `ai_verified`/`manual_verified`

### Option B: Create New Parallel Tables (NOT RECOMMENDED)
**Pros**:
- Clean schema matching plan.md exactly
- Full control over constraints

**Cons**:
- Duplicate data structures
- Confusion between `vision_verifications` and `vision_verification_records`
- Migration complexity

## Proposed Migration Sequence

1. **T007-T010**: Create NEW tables only where they don't exist:
   - Skip `vision_verification_records` (use existing `vision_verifications`)
   - Create `vision_detected_items` (new)
   - Create `vision_cost_records` (new)
   - Create `vision_confidence_config` (new)

2. **T011**: Add index to `job_kits.verification_method` (may already exist)

3. **T012**: Create RLS policies for NEW tables only

4. **T013**: Run migrations (additive only, no ALTER of existing table)

5. **T014**: Generate types (will include existing `vision_verifications`)

## Constitutional Compliance Notes

✅ Constitution §8 RULE 1 satisfied: Actual DB state inspected
✅ No assumptions made: Real schema documented
✅ Idempotent approach: New tables only, no ALTER of existing
⚠️ **DECISION POINT**: Confirm with user whether to:
   - **A**: Use existing `vision_verifications` + add complementary tables
   - **B**: Create new schema per plan.md (risks duplication)

## Recommendation

**Use Option A** (extend existing):
1. Leverage `vision_verifications` as-is for core verification tracking
2. Create `vision_detected_items` for detailed YOLO bounding boxes
3. Create `vision_cost_records` for budget tracking
4. Create `vision_confidence_config` for company thresholds
5. Map field names in repository layer:
   - `tenant_id` → expose as `companyId`
   - `verified_by` → expose as `technicianId`
   - `media_asset_id` → join to `media_assets.file_path`