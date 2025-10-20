# Job Load Refactor - Implementation Plan (Main Branch)

**Branch:** `main` (as requested)
**Created:** 2025-10-20
**Updated:** 2025-10-20 (Clarifications Added)
**Status:** Phase 0 - Ready for Approval

---

## Clarifications

### Session 2025-10-20

1. **Q: Timeline for Phase-Out - calendar weeks or sprints? Who approves phase transitions?**
   - A: Implementation sprints with approval gates. Week 1 ends at Phase 0 approval; subsequent gates (Phase 1 schema, Phase 2 dual-read, etc.) require sign-off by product/engineering lead before proceeding.

2. **Q: Default location IDs for item_transactions - create in migration or config?**
   - A: Add migration that inserts tenant's default yard/warehouse into locations table and capture UUID in tenant settings. API uses this ID instead of null for from_location_id.

3. **Q: VLM item name → ID mapping - how to handle fuzzy matches (e.g., "lawn mower" vs "Lawn Mower (21-inch)")?**
   - A: Build fuzzy matcher: normalize both detected labels and inventory names (lowercase, strip punctuation). Try exact match first; if none, use similarity metric (Levenshtein, startsWith, contains). If multiple items tie or confidence < threshold, return "requires manual confirmation" - item stays unchecked rather than matching wrong asset.

4. **Q: Concurrent editing during dual-write - what if supervisor updates equipment list while crew is verifying load?**
   - A: Add optimistic versioning. Before writing merged list, read current version of workflow_task_item_associations/jobs.checklist_items; if unchanged since crew fetched, commit; if changed (e.g., supervisor removed item), show "list updated, review new requirements" notice and reload. Guard writes with updated_at check.

5. **Q: Migration rollout - deploy to all tenants simultaneously or gradual tenant-by-tenant?**
   - A: Tenant feature flag approach. Run dual-read/write in parallel for pilot tenant (internal/staging). Once validated, flip flag for all tenants in one release. DB migration runs once globally (adds columns, seeds default locations); staged rollout is config toggle controlling code path.

---

## Executive Summary

This plan addresses the critical gaps identified in the validation report to enable the Job Load feature to work with the unified `items` table architecture instead of the legacy `jobs.checklist_items` JSON field.

**Key Issues Addressed:**
1. ❌ Enum mismatch: `'tool'` item_type doesn't exist
2. ❌ Missing `jobs.load_verified` column
3. ❌ `CrewWorkflowService` queries non-existent `job_equipment` table
4. ❌ Empty `workflow_task_item_associations` table (0 rows)
5. ⚠️ Need dual-read/write strategy for backward compatibility

---

## Phase 0: Research & Schema Analysis

### 0.1 Live Database Verification (COMPLETED ✅)

**MCP Queries Executed:**
```sql
-- Query 1: Schema inspection
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('items', 'jobs', 'workflow_tasks', 'workflow_task_item_associations')
-- Timestamp: 2025-10-20T14:32:00Z

-- Query 2: Enum values
SELECT enumlabel FROM pg_enum WHERE typname = 'item_type';
-- Result: 'equipment', 'material' (no 'tool')

-- Query 3: Association table status
SELECT COUNT(*) FROM workflow_task_item_associations;
-- Result: 0 rows

-- Query 4: Missing tables check
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('job_equipment', 'maintenance_reports');
-- Result: job_equipment DOES NOT EXIST
```

**Findings:**
- ✅ `items` table: 42 columns, fully structured
- ✅ `workflow_task_item_associations` table: EXISTS but empty
- ❌ `job_equipment` table: DOES NOT EXIST (referenced by CrewWorkflowService)
- ❌ `jobs.load_verified` column: DOES NOT EXIST (only `tool_reload_verified`)
- ⚠️ `item_type` enum: Only `'equipment'` and `'material'` (no `'tool'`)

---

## Phase 1: Schema Updates & Migrations

### 1.1 Enum Strategy for "Tools" - RECOMMENDED APPROACH

**Decision:** Use `item_type = 'equipment'` + `category` field (NO enum changes needed)

**Rationale:**
- ✅ No enum migration required (avoids risky ALTER TYPE operations)
- ✅ Leverages existing `category` TEXT field (items.category:24)
- ✅ Flexible for future equipment categorization
- ✅ Aligns with existing `category = 'vehicle'` pattern

**Implementation:**
```sql
-- NO migration needed - use existing schema:
-- items.item_type IN ('equipment', 'material')
-- items.category IN ('hand_tool', 'power_tool', 'vehicle', 'attachment', ...)
```

**Filter Patterns:**
```typescript
// Supervisor inventory pages
Tools:     item_type = 'equipment' AND category IN ('hand_tool', 'power_tool')
Materials: item_type = 'material'
Vehicles:  item_type = 'equipment' AND category = 'vehicle'
```

---

### 1.2 Add Missing `jobs` Columns & Default Locations

**Migration:** `supabase/migrations/20251020_add_load_verification_columns.sql`

```sql
-- Add load verification tracking columns
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS load_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS load_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS load_verification_method TEXT CHECK (load_verification_method IN ('ai_vision', 'manual', 'voice'));

-- Create index for quick filtering
CREATE INDEX IF NOT EXISTS idx_jobs_load_verified
  ON jobs(load_verified)
  WHERE load_verified = false;

-- Backfill from existing tool_reload_verified column
UPDATE jobs
SET load_verified = tool_reload_verified,
    load_verification_method = 'manual'
WHERE tool_reload_verified = true
  AND load_verified IS NULL;

COMMENT ON COLUMN jobs.load_verified IS 'Indicates if required items have been verified before job start';
COMMENT ON COLUMN jobs.load_verified_at IS 'Timestamp when load verification was completed';
COMMENT ON COLUMN jobs.load_verification_method IS 'Method used: ai_vision (VLM), manual (checklist), or voice (command)';
```

**Migration:** `supabase/migrations/20251020_create_default_locations.sql`

```sql
-- Create default yard/warehouse location for each tenant (for item_transactions)
-- Note: Assumes locations or containers table exists; adjust table name as needed

DO $$
DECLARE
  v_tenant RECORD;
  v_location_id UUID;
BEGIN
  FOR v_tenant IN SELECT id, name FROM tenants LOOP
    -- Check if default location already exists
    SELECT id INTO v_location_id
    FROM locations
    WHERE tenant_id = v_tenant.id
      AND name = 'Default Yard/Warehouse';

    -- Create if not exists
    IF v_location_id IS NULL THEN
      INSERT INTO locations (
        tenant_id,
        name,
        location_type,
        is_default,
        metadata
      )
      VALUES (
        v_tenant.id,
        'Default Yard/Warehouse',
        'yard', -- or 'warehouse', adjust to match your enum
        true,
        jsonb_build_object(
          'created_by', 'migration',
          'purpose', 'default_location_for_item_transactions'
        )
      )
      RETURNING id INTO v_location_id;

      RAISE NOTICE 'Created default location % for tenant %', v_location_id, v_tenant.name;
    END IF;
  END LOOP;
END $$;

-- Add helper function to get tenant's default location
CREATE OR REPLACE FUNCTION get_default_location_id(p_tenant_id UUID)
RETURNS UUID AS $$
  SELECT id
  FROM locations
  WHERE tenant_id = p_tenant_id
    AND is_default = true
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_default_location_id IS
  'Returns the default yard/warehouse location ID for a tenant, used by item_transactions';
```

**Rollback Plan:**
```sql
-- If needed, remove columns (data preserved in tool_reload_verified)
ALTER TABLE jobs
  DROP COLUMN IF EXISTS load_verified,
  DROP COLUMN IF EXISTS load_verified_at,
  DROP COLUMN IF EXISTS load_verification_method;
```

---

### 1.3 Seeding Strategy for `workflow_task_item_associations`

**Problem:** Table exists but is empty (0 rows). Jobs created from templates need item associations.

**Solution:** Create instantiation logic when jobs are created.

**Migration:** `supabase/migrations/20251020_create_job_template_instantiation.sql`

```sql
-- Function to instantiate task items from templates
CREATE OR REPLACE FUNCTION instantiate_task_items_from_template(
  p_job_id UUID,
  p_template_id UUID,
  p_tenant_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_inserted_count INTEGER := 0;
  v_task_mapping RECORD;
  v_template_task_id UUID;
  v_workflow_task_id UUID;
BEGIN
  -- For each task in the template
  FOR v_task_mapping IN
    SELECT tt.id as template_task_id, wt.id as workflow_task_id
    FROM task_templates tt
    JOIN workflow_tasks wt ON wt.template_id = tt.id
    WHERE wt.job_id = p_job_id
      AND tt.job_template_id = p_template_id
      AND wt.tenant_id = p_tenant_id
  LOOP
    -- Copy item associations from template to workflow task
    INSERT INTO workflow_task_item_associations (
      tenant_id,
      workflow_task_id,
      item_id,
      kit_id,
      quantity,
      is_required,
      status,
      source_template_association_id
    )
    SELECT
      p_tenant_id,
      v_task_mapping.workflow_task_id,
      ttia.item_id,
      ttia.kit_id,
      ttia.quantity,
      ttia.is_required,
      'pending'::task_item_status,
      ttia.id
    FROM task_template_item_associations ttia
    WHERE ttia.task_template_id = v_task_mapping.template_task_id
      AND ttia.tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_inserted_count = v_inserted_count + ROW_COUNT;
  END LOOP;

  RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION instantiate_task_items_from_template IS
  'Copies item requirements from task templates to workflow tasks when a job is created from a template';
```

**Trigger to Auto-Instantiate:**
```sql
-- Trigger when workflow_tasks are created with a template_id
CREATE OR REPLACE FUNCTION trigger_instantiate_task_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Only instantiate if this task came from a template
  IF NEW.template_id IS NOT NULL THEN
    PERFORM instantiate_task_items_from_template(
      NEW.job_id,
      (SELECT job_template_id FROM task_templates WHERE id = NEW.template_id),
      NEW.tenant_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_instantiate_task_items
  AFTER INSERT ON workflow_tasks
  FOR EACH ROW
  WHEN (NEW.template_id IS NOT NULL)
  EXECUTE FUNCTION trigger_instantiate_task_items();
```

---

## Phase 2: Service Refactors

### 2.1 CrewWorkflowService - Replace `job_equipment` Usage

**Files to Update:**
- `/Users/travisetzler/Documents/GitHub/jobeye/src/domains/crew/services/crew-workflow.service.ts:217-259`

**Current (BROKEN):**
```typescript
// Line 217-220: Queries non-existent table
const { data: jobEquipment, error } = await client
  .from('job_equipment')  // ❌ TABLE DOESN'T EXIST
  .select('equipment_id, equipment:equipment_id(name)')
```

**Refactored:**
```typescript
async verifyLoad(
  jobId: string,
  photoBlob: Blob,
  crewId: string,
  tenantId: string,
  manualItems?: string[]
): Promise<LoadVerificationResult> {
  try {
    const supabase = await createServerClient();
    const client = supabase as any;

    // NEW: Query via workflow_tasks → associations → items
    const { data: taskItems, error } = await client
      .from('workflow_tasks')
      .select(`
        id,
        workflow_task_item_associations!inner (
          id,
          item_id,
          quantity,
          is_required,
          status,
          items!inner (
            id,
            name,
            item_type,
            category
          )
        )
      `)
      .eq('job_id', jobId)
      .eq('tenant_id', tenantId)
      .eq('is_deleted', false);

    if (error) {
      console.error('[CrewWorkflowService] Failed to load task items:', error);

      // FALLBACK: Try jobs.checklist_items for backward compatibility
      const { data: job } = await client
        .from('jobs')
        .select('checklist_items')
        .eq('id', jobId)
        .single();

      if (job?.checklist_items && Array.isArray(job.checklist_items)) {
        const requiredItems = job.checklist_items.map((item: any, idx: number) => ({
          id: `legacy-${idx}`,
          name: item.name || item
        }));

        return this.performVerification(
          jobId,
          tenantId,
          requiredItems,
          manualItems,
          'checklist_fallback'
        );
      }

      throw error;
    }

    // Flatten items from all tasks
    const requiredItems = taskItems.flatMap((task: any) =>
      task.workflow_task_item_associations
        .filter((assoc: any) => assoc.is_required)
        .map((assoc: any) => ({
          id: assoc.item_id,
          associationId: assoc.id,
          name: assoc.items.name,
          quantity: assoc.quantity,
          currentStatus: assoc.status
        }))
    );

    return this.performVerification(
      jobId,
      tenantId,
      requiredItems,
      manualItems,
      'workflow_associations'
    );

  } catch (error) {
    throw new AppError('Failed to verify load', { cause: error });
  }
}

private async performVerification(
  jobId: string,
  tenantId: string,
  requiredItems: any[],
  manualItemIds: string[] | undefined,
  source: 'workflow_associations' | 'checklist_fallback'
): Promise<LoadVerificationResult> {
  const supabase = await createServerClient();
  const client = supabase as any;

  const verifiedItemIds = manualItemIds ?? [];
  const missingItems = requiredItems
    .filter((item) => !verifiedItemIds.includes(item.id))
    .map((item) => item.name);

  const isFullyVerified = missingItems.length === 0;

  // Update jobs table
  await client
    .from('jobs')
    .update({
      load_verified: isFullyVerified,
      load_verified_at: new Date().toISOString(),
      load_verification_method: manualItemIds ? 'manual' : 'ai_vision'
    })
    .eq('id', jobId)
    .eq('tenant_id', tenantId);

  // Update association statuses if using workflow model
  if (source === 'workflow_associations' && verifiedItemIds.length > 0) {
    const verifiedAssociationIds = requiredItems
      .filter((item) => verifiedItemIds.includes(item.id))
      .map((item) => item.associationId);

    await client
      .from('workflow_task_item_associations')
      .update({
        status: 'verified',
        loaded_at: new Date().toISOString(),
        loaded_by: manualItemIds ? undefined : 'system_ai'
      })
      .in('id', verifiedAssociationIds);
  }

  return {
    verified: isFullyVerified,
    verifiedItems: requiredItems
      .filter((item) => verifiedItemIds.includes(item.id))
      .map((item) => item.name),
    missingItems,
    method: manualItemIds ? 'manual' : 'ai_vision',
    confidence: manualItemIds ? 1 : undefined
  };
}
```

**Similar Fix for `getAssignedJobs()`:**
```typescript
// Line 98-122: Also queries job_equipment
async getAssignedJobs(
  crewId: string,
  tenantId: string,
  date?: string
): Promise<JobSummary[]> {
  // ... existing code ...

  // OLD:
  // job_equipment!inner (...)

  // NEW:
  const { data: assignments, error } = await client
    .from('job_assignments')
    .select(`
      job_id,
      jobs!inner (
        id,
        scheduled_date,
        scheduled_time,
        status,
        special_instructions,
        load_verified,
        customers!inner (name),
        properties!inner (address),
        workflow_tasks!inner (
          workflow_task_item_associations!inner (
            is_required,
            items!inner (
              id,
              name
            )
          )
        )
      )
    `)
    .eq('crew_id', crewId)
    .eq('tenant_id', tenantId)
    .eq('jobs.scheduled_date', targetDate)
    .order('jobs.scheduled_time');

  if (error) throw new AppError('Failed to fetch jobs');

  return assignments?.map((assignment: any) => {
    const job = assignment.jobs;

    // Flatten required equipment from all tasks
    const requiredEquipment = job.workflow_tasks
      ?.flatMap((task: any) =>
        task.workflow_task_item_associations
          ?.filter((assoc: any) => assoc.is_required)
          ?.map((assoc: any) => assoc.items?.name)
          ?.filter(Boolean) ?? []
      ) ?? [];

    return {
      id: job.id,
      customerName: job.customers?.name ?? 'Unknown',
      propertyAddress: job.properties?.address ?? 'Unknown',
      scheduledTime: job.scheduled_time,
      status: job.status,
      specialInstructions: job.special_instructions,
      requiredEquipment: [...new Set(requiredEquipment)], // dedupe
      loadVerified: Boolean(job.load_verified)
    };
  }) || [];
}
```

---

### 2.2 Dual-Read / Dual-Write Transition Strategy

**Goal:** Support both `jobs.checklist_items` (legacy) and `workflow_task_item_associations` (new) during migration.

**Strategy:**

```typescript
// Repository layer helper
class JobLoadRepository {
  /**
   * Read items with fallback strategy
   */
  async getRequiredItems(jobId: string, tenantId: string) {
    // 1. Try new workflow associations model
    const workflowItems = await this.getItemsFromWorkflow(jobId, tenantId);

    if (workflowItems.length > 0) {
      return {
        source: 'workflow_associations' as const,
        items: workflowItems
      };
    }

    // 2. Fallback to legacy checklist_items
    const checklistItems = await this.getItemsFromChecklist(jobId, tenantId);

    if (checklistItems.length > 0) {
      console.warn(`[JobLoadRepository] Job ${jobId} using legacy checklist_items`);
      return {
        source: 'checklist_items' as const,
        items: checklistItems
      };
    }

    // 3. Return empty (new job with no items yet)
    return {
      source: 'none' as const,
      items: []
    };
  }

  /**
   * Write items to BOTH stores during transition (with optimistic versioning)
   */
  async saveRequiredItems(
    jobId: string,
    tenantId: string,
    items: EquipmentItem[],
    lastUpdatedAt?: string // Client's last known updated_at timestamp
  ): Promise<{ success: boolean; conflict?: boolean; latestData?: any }> {
    const supabase = await createServerClient();

    // OPTIMISTIC VERSIONING: Check if data changed since client last fetched
    if (lastUpdatedAt) {
      const { data: currentJob } = await supabase
        .from('jobs')
        .select('updated_at, checklist_items')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (currentJob && currentJob.updated_at > lastUpdatedAt) {
        // Data was modified by another user (e.g., supervisor)
        console.warn(`[JobLoadRepository] Concurrent edit detected for job ${jobId}`);
        return {
          success: false,
          conflict: true,
          latestData: currentJob.checklist_items
        };
      }
    }

    try {
      // Write to NEW model (workflow associations)
      await this.saveToWorkflowAssociations(jobId, tenantId, items);

      // Write to OLD model (checklist JSON) for backward compatibility
      const { error } = await supabase
        .from('jobs')
        .update({
          checklist_items: items.map(item => ({
            name: item.name,
            checked: item.checked,
            category: item.category
          })),
          updated_at: new Date().toISOString() // Bump version
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      console.log(`[JobLoadRepository] Dual-write complete for job ${jobId}`);
      return { success: true, conflict: false };

    } catch (error) {
      console.error(`[JobLoadRepository] Dual-write failed:`, error);
      throw error;
    }
  }

  private async getItemsFromWorkflow(jobId: string, tenantId: string) {
    // ... query workflow_task_item_associations ...
  }

  private async getItemsFromChecklist(jobId: string, tenantId: string) {
    // ... query jobs.checklist_items ...
  }

  private async saveToWorkflowAssociations(
    jobId: string,
    tenantId: string,
    items: EquipmentItem[]
  ) {
    // ... update workflow_task_item_associations statuses ...
  }
}
```

**Phase-Out Plan (Sprint-Based with Approval Gates):**
1. **Sprint 1 (Week 1):** Phase 0 approval → Deploy dual-read fallback to pilot tenant
2. **Sprint 2 (Week 2):** Monitor pilot tenant usage, verify workflow associations populate correctly
3. **Sprint 3 (Week 3):** Engineering lead approval → Enable for all tenants via feature flag
4. **Sprint 4 (Week 4):** Monitor production usage, track legacy checklist_items access (should be < 5%)
5. **Sprint 5 (Week 5):** Product lead approval → Remove checklist_items fallback code
6. **Sprint 6 (Week 6):** Mark jobs.checklist_items column as deprecated (schedule for future removal)

**Approval Gates:**
- Phase 0 → Phase 1: User approval (plan review)
- Phase 1 → Phase 2: Engineering lead (schema changes deployed)
- Phase 2 → Phase 3: Product lead (dual-write behavior validated)
- Phase 3 → Phase 4: Engineering lead (API endpoints functional)
- Phase 4 → Phase 5: Product lead (tests passing, ready for production)

**Feature Flag Implementation:**

```typescript
// .env.local or environment config
USE_WORKFLOW_ASSOCIATIONS=true
PILOT_TENANT_IDS=uuid1,uuid2,uuid3 // Comma-separated for staged rollout

// src/lib/feature-flags.ts
export function useWorkflowAssociations(tenantId: string): boolean {
  const globalFlag = process.env.USE_WORKFLOW_ASSOCIATIONS === 'true';
  const pilotTenants = (process.env.PILOT_TENANT_IDS || '').split(',');

  // During pilot phase, only enable for pilot tenants
  if (pilotTenants.length > 0 && !globalFlag) {
    return pilotTenants.includes(tenantId);
  }

  // After pilot, respect global flag
  return globalFlag;
}

// Usage in JobLoadRepository
async getRequiredItems(jobId: string, tenantId: string) {
  const useWorkflow = useWorkflowAssociations(tenantId);

  if (useWorkflow) {
    // Try new workflow associations model
    const workflowItems = await this.getItemsFromWorkflow(jobId, tenantId);
    if (workflowItems.length > 0) {
      return { source: 'workflow_associations', items: workflowItems };
    }
  }

  // Fallback to legacy checklist_items
  const checklistItems = await this.getItemsFromChecklist(jobId, tenantId);
  if (checklistItems.length > 0) {
    console.warn(`[JobLoadRepository] Job ${jobId} using legacy checklist_items`);
    return { source: 'checklist_items', items: checklistItems };
  }

  return { source: 'none', items: [] };
}
```

---

### 2.3 VLM Fuzzy Matching for Item Name → ID Resolution

**Problem:** VLM detections return labels like "lawn mower" but database has "Lawn Mower (21-inch Honda)". Need robust matching.

**Solution:** Multi-stage matching with confidence scoring.

**Implementation:**

```typescript
// src/domains/vision/services/vlm-item-matcher.service.ts

interface FuzzyMatchResult {
  itemId: string | null;
  itemName: string | null;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'manual_required';
  candidates?: Array<{ id: string; name: string; score: number }>;
}

class VlmItemMatcher {
  /**
   * Match VLM detection label to database item
   */
  async matchDetectionToItem(
    detectionLabel: string,
    tenantId: string,
    jobId?: string
  ): Promise<FuzzyMatchResult> {
    const supabase = await createServerClient();

    // Get candidate items (job-specific or tenant-wide)
    const { data: items } = jobId
      ? await this.getJobRequiredItems(jobId, tenantId)
      : await this.getTenantItems(tenantId);

    if (!items || items.length === 0) {
      return {
        itemId: null,
        itemName: null,
        confidence: 0,
        matchType: 'manual_required'
      };
    }

    // Stage 1: Exact match (case-sensitive)
    const exactMatch = items.find(item => item.name === detectionLabel);
    if (exactMatch) {
      return {
        itemId: exactMatch.id,
        itemName: exactMatch.name,
        confidence: 1.0,
        matchType: 'exact'
      };
    }

    // Stage 2: Normalized match (lowercase, stripped punctuation)
    const normalizedLabel = this.normalize(detectionLabel);
    const normalizedMatch = items.find(item =>
      this.normalize(item.name) === normalizedLabel
    );
    if (normalizedMatch) {
      return {
        itemId: normalizedMatch.id,
        itemName: normalizedMatch.name,
        confidence: 0.95,
        matchType: 'normalized'
      };
    }

    // Stage 3: Fuzzy match (similarity scoring)
    const scoredItems = items.map(item => ({
      ...item,
      score: this.calculateSimilarity(normalizedLabel, this.normalize(item.name))
    }));

    // Sort by score descending
    scoredItems.sort((a, b) => b.score - a.score);

    const topMatch = scoredItems[0];
    const FUZZY_THRESHOLD = 0.70; // 70% similarity required

    // Check if top match is clear winner (no ties)
    const tieMatches = scoredItems.filter(
      item => item.score >= FUZZY_THRESHOLD && item.score === topMatch.score
    );

    if (tieMatches.length > 1) {
      // Multiple items with same score - require manual confirmation
      return {
        itemId: null,
        itemName: null,
        confidence: topMatch.score,
        matchType: 'manual_required',
        candidates: tieMatches.slice(0, 3).map(item => ({
          id: item.id,
          name: item.name,
          score: item.score
        }))
      };
    }

    if (topMatch.score >= FUZZY_THRESHOLD) {
      return {
        itemId: topMatch.id,
        itemName: topMatch.name,
        confidence: topMatch.score,
        matchType: 'fuzzy'
      };
    }

    // No confident match - require manual selection
    return {
      itemId: null,
      itemName: null,
      confidence: topMatch.score,
      matchType: 'manual_required',
      candidates: scoredItems.slice(0, 3).map(item => ({
        id: item.id,
        name: item.name,
        score: item.score
      }))
    };
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Combine multiple similarity metrics

    // 1. Starts-with bonus
    if (str2.startsWith(str1) || str1.startsWith(str2)) {
      return 0.9;
    }

    // 2. Contains check
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.85;
    }

    // 3. Levenshtein distance (normalized)
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    const similarity = 1 - (distance / maxLength);

    return similarity;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async getJobRequiredItems(jobId: string, tenantId: string) {
    const supabase = await createServerClient();
    return supabase
      .from('workflow_task_item_associations')
      .select('item_id, items!inner(id, name)')
      .eq('workflow_tasks.job_id', jobId)
      .eq('tenant_id', tenantId);
  }

  private async getTenantItems(tenantId: string) {
    const supabase = await createServerClient();
    return supabase
      .from('items')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
  }
}
```

**Usage in Job Load Screen:**

```typescript
// When VLM detection received
const matcher = new VlmItemMatcher();

for (const detection of vlmDetections) {
  const match = await matcher.matchDetectionToItem(
    detection.label,
    tenantId,
    jobId
  );

  if (match.matchType === 'manual_required') {
    // Show UI for manual selection
    showManualSelectionDialog({
      detectedLabel: detection.label,
      candidates: match.candidates,
      onSelect: (selectedItemId) => {
        markItemAsVerified(selectedItemId);
      }
    });
  } else if (match.confidence >= 0.70) {
    // Auto-mark item as verified
    markItemAsVerified(match.itemId!);
  }
}
```

**Benefit:** Robust matching reduces false positives while handling real-world label variations.

---

## Phase 3: API & UI Wiring

### 3.1 `/api/crew/jobs/[jobId]/equipment` - Updated Structure

**File:** `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/crew/jobs/[jobId]/equipment/route.ts`

**Current Implementation:**
```typescript
// Lines 56-66: Reads jobs.checklist_items
const { data: job } = await supabase
  .from('jobs')
  .select('id, checklist_items')
  .eq('id', jobId)
  .single();

const equipment = job?.checklist_items || [];
```

**Refactored Implementation:**
```typescript
import { JobLoadRepository } from '@/domains/jobs/repositories/job-load.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;

    // Use repository with dual-read strategy
    const repo = new JobLoadRepository();
    const { source, items } = await repo.getRequiredItems(
      jobId,
      request.headers.get('x-tenant-id') // or from auth context
    );

    return NextResponse.json({
      equipment: items,
      job_id: jobId,
      source: source, // 'workflow_associations' | 'checklist_items' | 'none'
      migration_status: source === 'workflow_associations' ? 'migrated' : 'legacy'
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const body = await request.json();
    const { equipment } = body;

    if (!Array.isArray(equipment)) {
      return NextResponse.json(
        { error: 'Equipment array is required' },
        { status: 400 }
      );
    }

    // Use repository with dual-write strategy
    const repo = new JobLoadRepository();
    await repo.saveRequiredItems(
      jobId,
      request.headers.get('x-tenant-id'),
      equipment
    );

    return NextResponse.json({
      success: true,
      equipment: equipment,
      dual_write: true // Indicates both stores updated
    });

  } catch (error) {
    return handleApiError(error);
  }
}
```

---

### 3.2 `/api/crew/jobs/[jobId]/load-verify` - New Verification Flow

**File:** `/Users/travisetzler/Documents/GitHub/jobeye/src/app/api/crew/jobs/[jobId]/load-verify/route.ts`

**Current:** Already uses CrewWorkflowService (which we're fixing)

**Update Required:** None to API route, but ensure it uses refactored service.

**Additional Enhancement:** Log to `item_transactions` for audit trail

```typescript
// After verification succeeds, log transaction
if (result.verified) {
  // Create check-out transaction for each verified item
  await Promise.all(
    result.verifiedItems.map(itemName =>
      client.from('item_transactions').insert({
        tenant_id: tenantId,
        transaction_type: 'check_out',
        item_id: /* lookup item_id from name */,
        quantity: 1,
        from_location_id: /* warehouse/yard location */,
        to_user_id: crewId,
        job_id: jobId,
        notes: `Load verified via ${result.method}`,
        confidence_score: result.confidence,
        metadata: {
          verification_method: result.method,
          verified_at: new Date().toISOString()
        }
      })
    )
  );
}
```

---

### 3.3 Crew Dashboard - "Verify Load" CTA

**File:** `/Users/travisetzler/Documents/GitHub/jobeye/src/app/crew/page.tsx`

**Current State:**
```typescript
// The dashboard expects job.loadVerified but API doesn't return it
```

**Fix Required:**

1. **Update `/api/crew/jobs/today` response:**
```typescript
// Ensure this endpoint returns load_verified column
const { data: jobs } = await supabase
  .from('jobs')
  .select(`
    id,
    customer_name,
    property_address,
    scheduled_time,
    status,
    load_verified,  // ← ADD THIS
    load_verified_at
  `)
  // ... filters ...
```

2. **Update Crew Dashboard UI:**
```typescript
// src/app/crew/page.tsx
export default function CrewDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    const response = await fetch('/api/crew/jobs/today');
    const data = await response.json();
    setJobs(data.jobs);
  };

  // Find first unverified job
  const nextUnverifiedJob = jobs.find(job => !job.load_verified);

  return (
    <div>
      {nextUnverifiedJob && (
        <div className="urgent-cta">
          <h3>⚠️ Load Verification Required</h3>
          <p>Job: {nextUnverifiedJob.customer_name}</p>
          <button onClick={() => router.push('/crew/job-load')}>
            Verify Load Now
          </button>
        </div>
      )}

      {/* Rest of dashboard */}
    </div>
  );
}
```

---

### 3.4 Supervisor Inventory Pages - Filter Strategy

**Files:**
- `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/tools/page.tsx`
- `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/materials/page.tsx`
- `/Users/travisetzler/Documents/GitHub/jobeye/src/app/(authenticated)/supervisor/vehicles/page.tsx`

**Create `/api/items` endpoint:**
```typescript
// src/app/api/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const type = searchParams.get('type'); // 'equipment' | 'material'
    const category = searchParams.get('category'); // 'hand_tool', 'vehicle', etc.
    const status = searchParams.get('status'); // 'active', 'maintenance', etc.
    const assignedToJob = searchParams.get('assigned_to_job'); // job_id

    let query = supabase
      .from('items')
      .select('*')
      .order('name');

    // Apply filters
    if (type) {
      query = query.eq('item_type', type);
    }

    if (category) {
      const categories = category.split(',');
      query = query.in('category', categories);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (assignedToJob) {
      query = query.eq('assigned_to_job_id', assignedToJob);
    }

    const { data: items, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      items: items || [],
      count: items?.length || 0
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
```

**Update Supervisor Pages:**
```typescript
// src/app/(authenticated)/supervisor/tools/page.tsx
const loadTools = async () => {
  const response = await fetch('/api/items?type=equipment&category=hand_tool,power_tool');
  const data = await response.json();
  setTools(data.items);
};

// src/app/(authenticated)/supervisor/materials/page.tsx
const loadMaterials = async () => {
  const response = await fetch('/api/items?type=material');
  const data = await response.json();
  setMaterials(data.items);
};

// src/app/(authenticated)/supervisor/vehicles/page.tsx
const loadVehicles = async () => {
  const response = await fetch('/api/items?type=equipment&category=vehicle');
  const data = await response.json();
  setVehicles(data.items);
};
```

---

## Phase 4: Instrumentation & Tests

### 4.1 Item Transactions - Audit Trail

**Usage Pattern:**
```typescript
// Every load verification should create transactions
async function logLoadVerificationTransaction(
  tenantId: string,
  jobId: string,
  itemId: string,
  crewId: string,
  method: 'ai_vision' | 'manual',
  confidence?: number
) {
  const supabase = await createServerClient();

  // Get tenant's default location via helper function
  const { data: locationData } = await supabase
    .rpc('get_default_location_id', { p_tenant_id: tenantId });

  await supabase.from('item_transactions').insert({
    tenant_id: tenantId,
    transaction_type: 'check_out',
    item_id: itemId,
    quantity: 1,
    from_location_id: locationData, // ✅ Uses tenant's default yard/warehouse
    to_user_id: crewId,
    job_id: jobId,
    notes: `Load verified for job via ${method}`,
    confidence_score: confidence,
    metadata: {
      verification_method: method,
      verified_at: new Date().toISOString(),
      source: 'crew_job_load_screen'
    }
  });
}
```

**Benefit:** Full audit trail of when items were loaded, who loaded them, and verification confidence.

---

### 4.2 Integration/Unit Tests to Update

**Tests Requiring Updates:**

1. **CrewWorkflowService Tests**
   - File: `tests/domains/crew/services/crew-workflow.test.ts`
   - Update: Mock `workflow_task_item_associations` instead of `job_equipment`
   - Add: Test dual-read fallback to `checklist_items`

```typescript
// tests/domains/crew/services/crew-workflow.test.ts
describe('CrewWorkflowService', () => {
  describe('verifyLoad', () => {
    it('should verify load using workflow associations', async () => {
      // Mock workflow_tasks query with associations
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            workflow_tasks: [
              {
                workflow_task_item_associations: [
                  { item_id: 'item-1', items: { name: 'Lawn Mower' }, is_required: true }
                ]
              }
            ]
          }
        })
      });

      const result = await service.verifyLoad('job-1', blob, 'crew-1', 'tenant-1', ['item-1']);

      expect(result.verified).toBe(true);
      expect(result.verifiedItems).toContain('Lawn Mower');
    });

    it('should fallback to checklist_items if associations are empty', async () => {
      // Mock empty workflow query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      });

      // Mock checklist_items fallback
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { checklist_items: [{ name: 'Trimmer', checked: false }] }
        })
      });

      const result = await service.verifyLoad('job-1', blob, 'crew-1', 'tenant-1');

      expect(result.missingItems).toContain('Trimmer');
    });
  });
});
```

2. **Equipment API Tests**
   - File: `tests/api/crew/job-equipment.test.ts` (create if missing)
   - Test: GET returns items from workflow associations
   - Test: PUT dual-writes to both stores

```typescript
// tests/api/crew/job-equipment.test.ts
describe('GET /api/crew/jobs/[jobId]/equipment', () => {
  it('should return equipment from workflow associations', async () => {
    const response = await fetch('/api/crew/jobs/test-job-id/equipment');
    const data = await response.json();

    expect(data.source).toBe('workflow_associations');
    expect(data.equipment).toHaveLength(3);
    expect(data.migration_status).toBe('migrated');
  });

  it('should fallback to checklist_items for legacy jobs', async () => {
    // Mock job with no workflow associations
    const response = await fetch('/api/crew/jobs/legacy-job-id/equipment');
    const data = await response.json();

    expect(data.source).toBe('checklist_items');
    expect(data.migration_status).toBe('legacy');
  });
});

describe('PUT /api/crew/jobs/[jobId]/equipment', () => {
  it('should dual-write to both workflow and checklist', async () => {
    const equipment = [
      { name: 'Mower', checked: true, category: 'primary' }
    ];

    const response = await fetch('/api/crew/jobs/test-job-id/equipment', {
      method: 'PUT',
      body: JSON.stringify({ equipment })
    });
    const data = await response.json();

    expect(data.dual_write).toBe(true);

    // Verify both stores were updated
    // ...assertions...
  });
});
```

3. **Job Load Screen E2E Tests**
   - File: `tests/e2e/crew-job-load.test.ts`
   - Update: Verify VLM detections update `workflow_task_item_associations.status`

```typescript
// tests/e2e/crew-job-load.test.ts
import { test, expect } from '@playwright/test';

test.describe('Job Load Verification', () => {
  test('should update association status when items verified', async ({ page }) => {
    await page.goto('/crew/job-load');

    // Select job
    await page.click('text=Demo Customer');

    // Start camera
    await page.click('text=START');

    // Mock VLM detection response
    await page.route('**/api/vision/vlm-detect', route => {
      route.fulfill({
        json: {
          detections: [
            { label: 'Lawn Mower', confidence: 0.95, source: 'gemini' }
          ]
        }
      });
    });

    // Wait for detection
    await expect(page.locator('text=Lawn Mower')).toHaveClass(/checked/);

    // Verify database updated (via API check)
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/crew/jobs/test-job/equipment');
      const data = await res.json();
      return data.equipment[0].status;
    });

    expect(status).toBe('verified');
  });
});
```

4. **RLS Policy Tests**
   - File: `tests/integration/rls/workflow-task-items-rls.test.ts` (create)
   - Test: Tenant isolation for `workflow_task_item_associations`

```typescript
// tests/integration/rls/workflow-task-items-rls.test.ts
describe('workflow_task_item_associations RLS', () => {
  it('should prevent cross-tenant access', async () => {
    // Create two tenants with items
    const tenant1Client = createClient(tenant1User);
    const tenant2Client = createClient(tenant2User);

    // Tenant 1 creates association
    await tenant1Client.from('workflow_task_item_associations').insert({
      workflow_task_id: 'task-1',
      item_id: 'item-1',
      tenant_id: tenant1Id
    });

    // Tenant 2 tries to read it
    const { data } = await tenant2Client
      .from('workflow_task_item_associations')
      .select('*')
      .eq('item_id', 'item-1');

    expect(data).toHaveLength(0); // RLS blocked
  });
});
```

---

## Implementation Checklist

### ✅ Completed (Validation Phase)
- [x] Live database schema inspection via MCP
- [x] Identify enum mismatch (`'tool'` doesn't exist)
- [x] Identify missing `jobs.load_verified` column
- [x] Identify broken `CrewWorkflowService` queries
- [x] Document dual-read/write strategy

### 📋 Phase 1: Schema (Estimated: 2 hours)
- [ ] Create migration `20251020_add_load_verification_columns.sql`
- [ ] Create migration `20251020_create_job_template_instantiation.sql`
- [ ] Test migrations on local Supabase instance
- [ ] Apply migrations to production via `scripts/apply-migration.ts`
- [ ] Verify columns exist via MCP query
- [ ] Seed 3-5 test jobs with workflow associations

### 📋 Phase 2: Service Refactors (Estimated: 4 hours)
- [ ] Create `JobLoadRepository` with dual-read/write logic
- [ ] Refactor `CrewWorkflowService.verifyLoad()`
- [ ] Refactor `CrewWorkflowService.getAssignedJobs()`
- [ ] Add item_transactions logging
- [ ] Unit test repository fallback logic
- [ ] Integration test dual-write behavior

### 📋 Phase 3: API & UI (Estimated: 3 hours)
- [ ] Create `/api/items` endpoint with filters
- [ ] Update `/api/crew/jobs/[jobId]/equipment` GET handler
- [ ] Update `/api/crew/jobs/[jobId]/equipment` PUT handler
- [ ] Update `/api/crew/jobs/today` to return `load_verified`
- [ ] Update crew dashboard to show "Verify Load" CTA
- [ ] Update supervisor tools/materials/vehicles pages
- [ ] Test end-to-end flow: supervisor → crew → verification

### 📋 Phase 4: Testing & Documentation (Estimated: 2 hours)
- [ ] Update CrewWorkflowService tests
- [ ] Create equipment API tests
- [ ] Update job-load E2E tests
- [ ] Create RLS isolation tests
- [ ] Document dual-read/write transition timeline
- [ ] Update API documentation (OpenAPI/Swagger)

### 📋 Phase 5: Monitoring & Rollout (Estimated: 2 hours)
**Strategy:** Tenant feature flag with staged rollout

- [ ] Add `USE_WORKFLOW_ASSOCIATIONS` feature flag to environment config
- [ ] Implement tenant-level flag check in JobLoadRepository
- [ ] Add logging for source='checklist_items' usage (track legacy access rate)
- [ ] Create dashboard query to track migration progress by tenant
- [ ] **Pilot Rollout (Sprint 1):**
  - [ ] Enable flag for internal/staging tenant only
  - [ ] Verify workflow associations populate correctly
  - [ ] Monitor errors and performance for 48 hours
- [ ] **Full Rollout (Sprint 3):**
  - [ ] Engineering lead approval
  - [ ] Enable flag globally for all tenants (one release)
  - [ ] Monitor for 48 hours, track legacy checklist access (should be <5%)
- [ ] **Cleanup (Sprint 5):**
  - [ ] Product lead approval
  - [ ] Remove checklist_items fallback logic
  - [ ] Mark column for deprecation

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration fails partially | High | Use idempotent SQL, test rollback scripts |
| RLS blocks legitimate queries | Medium | Test with actual user JWTs before prod deploy |
| Dual-write increases latency | Low | Monitor API response times, optimize if >200ms |
| Legacy jobs missing associations | Medium | Fallback to `checklist_items` ensures continuity |
| VLM detections don't map to item_id | Medium | Use fuzzy matching + manual override UI |

---

## Rollback Plan

If critical issues arise:

```sql
-- 1. Revert to jobs.checklist_items only
UPDATE jobs SET load_verified = tool_reload_verified WHERE load_verified IS NULL;

-- 2. Disable new code paths via feature flag
-- Set environment variable: USE_WORKFLOW_ASSOCIATIONS=false

-- 3. Drop new columns (data preserved in checklist_items)
ALTER TABLE jobs
  DROP COLUMN IF EXISTS load_verified,
  DROP COLUMN IF EXISTS load_verified_at,
  DROP COLUMN IF EXISTS load_verification_method;

-- 4. Remove trigger (associations table remains, just unused)
DROP TRIGGER IF EXISTS auto_instantiate_task_items ON workflow_tasks;
```

---

## Success Criteria

1. ✅ All supervisor inventory pages display items from `items` table
2. ✅ Crew job load screen verifies items via `workflow_task_item_associations`
3. ✅ `jobs.load_verified` column populates correctly
4. ✅ VLM detections map to actual `items.id` values
5. ✅ Dual-read fallback works for legacy jobs
6. ✅ All tests pass (unit, integration, E2E)
7. ✅ Zero RLS policy violations in logs
8. ✅ Item transactions audit trail captures all load events

---

## Next Steps

**Awaiting Approval:**
1. Review this plan with team
2. Approve schema changes (migrations)
3. Approve dual-read/write strategy
4. Set timeline for Phase 1 execution

**Once Approved:**
1. Execute Phase 1 (schema migrations)
2. Execute Phase 2 (service refactors)
3. Execute Phase 3 (API/UI wiring)
4. Execute Phase 4 (testing)
5. Execute Phase 5 (monitoring & rollout)

---

**Plan Author:** Claude Code
**Validation Date:** 2025-10-20
**Clarifications Date:** 2025-10-20
**Estimated Total Effort:** 16 hours (was 12h, +4h for fuzzy matching, feature flags, optimistic versioning, default locations)
**Target Branch:** `main` (as requested)

---

## Implementation Breakdown (Updated)

| Phase | Component | Original | Added | Total |
|-------|-----------|----------|-------|-------|
| 1 | Schema migrations | 2h | +0.5h (locations) | 2.5h |
| 2 | Service refactors | 4h | +2h (fuzzy match) + 1h (opt. versioning) | 7h |
| 3 | API & UI wiring | 3h | - | 3h |
| 4 | Testing & docs | 2h | - | 2h |
| 5 | Monitoring & rollout | 1h | +1h (feature flags) | 2h |
| **TOTAL** | | **12h** | **+4.5h** | **16.5h** |
