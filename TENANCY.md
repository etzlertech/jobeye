# JobEye Tenancy Model Documentation

**Date:** 2025-09-30
**Status:** DOCUMENTED (Inconsistency Identified)
**Purpose:** Comprehensive documentation of multi-tenant architecture

---

## Executive Summary

JobEye uses a **multi-tenant architecture** to isolate data between different companies/organizations. However, the implementation has an **inconsistency problem**:

- **14 tables** use `tenant_id` column
- **6 tables** use `company_id` column
- **Both refer to the same concept** (customer organization)

This creates confusion, maintenance burden, and join complexity.

---

## Current State

### Tables Using `tenant_id` (14 tables)

| Table | Purpose | Domain |
|-------|---------|--------|
| `jobs` | Job tracking | Jobs |
| `job_templates` | Job blueprints | Jobs |
| `properties` | Customer properties | Customer |
| `equipment` | Equipment tracking | Equipment |
| `irrigation_systems` | Irrigation data | Irrigation |
| `irrigation_zones` | Zone management | Irrigation |
| `material_catalog` | Material inventory | Materials |
| `voice_sessions` | Voice transcripts | Voice |
| `vision_verifications` | Vision AI results | Vision |
| `users_extended` | User metadata | Auth |
| `tenants` | Tenant root | Core |
| `companies` | Company profiles | Core |
| `kit_items` | Kit components | Kits |
| `kit_variants` | Kit variations | Kits |

### Tables Using `company_id` (6 tables)

| Table | Purpose | Domain |
|-------|---------|--------|
| `containers` | Loading containers | Equipment/Inventory |
| `media_assets` | File storage | Media |
| `inventory_items` | Item tracking | Inventory |
| `vision_cost_records` | AI cost tracking | Vision |
| `kits` | Equipment kits | Kits |
| `kit_overrides` | Kit customizations | Kits |

### Architecture Mismatch

**Equipment Container Repository:**
```typescript
// Variable name says "tenantId", but database column is "company_id"
.eq('company_id', tenantId)  // ❌ Confusing!
```

**Job Repository:**
```typescript
// Variable name and column name match
.eq('tenant_id', tenantId)   // ✅ Consistent!
```

---

## Root Cause Analysis

### How This Happened

1. **Original Design:** Used `tenant_id` (Phase 1-3 tables)
2. **Later Features:** Some developers used `company_id` (Phase 4-5 tables)
3. **No Enforcement:** No linting rule or convention document to prevent divergence
4. **No Detection:** No pre-commit check to catch inconsistency

### Why It's a Problem

1. **Developer Confusion**
   - New developers don't know which column to use
   - Code reviews miss inconsistencies
   - Variable naming doesn't match column names

2. **Join Complexity**
   - Joining across tenant boundaries requires aliasing
   - Example: `jobs.tenant_id = containers.company_id`
   - More error-prone SQL

3. **Maintenance Burden**
   - Documentation must explain both patterns
   - Refactoring must consider both columns
   - Search/replace operations more complex

4. **RLS Policy Duplication**
   - Some policies check `tenant_id`
   - Some policies check `company_id`
   - Inconsistent security patterns

---

## Recommended Solution

### Option A: Standardize on `tenant_id` ⭐ RECOMMENDED

**Pros:**
- Aligns with original architecture
- Clearer semantic meaning (tenant = isolated customer org)
- Less refactoring needed (14 tables vs 6 tables)
- Industry standard term for multi-tenancy

**Cons:**
- "Tenant" is more technical/abstract than "company"
- Requires migrating 6 tables

**Migration SQL:**
```sql
-- Step 1: Rename columns
ALTER TABLE containers RENAME COLUMN company_id TO tenant_id;
ALTER TABLE media_assets RENAME COLUMN company_id TO tenant_id;
ALTER TABLE inventory_items RENAME COLUMN company_id TO tenant_id;
ALTER TABLE vision_cost_records RENAME COLUMN company_id TO tenant_id;
ALTER TABLE kits RENAME COLUMN company_id TO tenant_id;
ALTER TABLE kit_overrides RENAME COLUMN company_id TO tenant_id;

-- Step 2: Update RLS policies (example for containers)
DROP POLICY IF EXISTS "Users access own company containers" ON containers;
CREATE POLICY "Users access own tenant containers"
  ON containers FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM users_extended WHERE id = auth.uid()
  ));

-- Step 3: Update foreign keys (if any reference company_id)
-- (None found in current schema)
```

### Option B: Standardize on `company_id`

**Pros:**
- "Company" is clearer business term
- Less abstract for non-technical users

**Cons:**
- Requires migrating 14 tables (more work)
- Goes against original architecture decision
- Not industry standard for multi-tenancy

**Not recommended** due to higher migration cost.

---

## Migration Strategy

### Phase 1: Preparation (1-2 days)
1. **Code Audit**
   - Grep all repository files for `.company_id` patterns
   - Identify all RLS policies referencing `company_id`
   - Document all affected code paths

2. **Test Coverage**
   - Ensure all affected tables have integration tests
   - Add RLS tests for tables being migrated
   - Create rollback plan

3. **Communication**
   - Notify team of upcoming change
   - Document breaking changes (if any)
   - Schedule migration window

### Phase 2: Database Migration (2-4 hours)
1. **Backup Database**
   ```bash
   # Snapshot Supabase project before migration
   ```

2. **Apply Column Renames**
   ```typescript
   // Use exec_sql RPC method (only reliable way for hosted Supabase)
   await client.rpc('exec_sql', {
     sql: 'ALTER TABLE containers RENAME COLUMN company_id TO tenant_id;'
   });
   ```

3. **Update RLS Policies**
   - Drop old policies referencing `company_id`
   - Create new policies using `tenant_id`
   - Test with real user tokens

4. **Regenerate Types**
   ```bash
   npm run generate:types
   ```

### Phase 3: Code Migration (4-8 hours)
1. **Update Repositories**
   ```typescript
   // BEFORE:
   .eq('company_id', tenantId)

   // AFTER:
   .eq('tenant_id', tenantId)
   ```

2. **Update Type Definitions**
   ```typescript
   // BEFORE:
   export interface Container {
     company_id: string;
     // ...
   }

   // AFTER:
   export interface Container {
     tenant_id: string;
     tenantId: string; // Alias for camelCase
     // ...
   }
   ```

3. **Update Mappers**
   ```typescript
   // Update mapFromDb() and mapToDb() functions
   private mapFromDb(data: any): Container {
     return {
       tenantId: data.tenant_id,  // Use tenant_id now
       // ...
     };
   }
   ```

4. **Run Full Test Suite**
   ```bash
   npm test
   npm run test:e2e
   npm run test:rls
   ```

### Phase 4: Verification (1-2 hours)
1. **Manual Testing**
   - Login as different tenant users
   - Verify data isolation
   - Test cross-domain operations (jobs + containers)

2. **RLS Verification**
   - Attempt unauthorized access across tenants
   - Verify all policies enforced
   - Check query performance

3. **Rollback Plan**
   - If issues found, revert column renames
   - Restore old RLS policies
   - Revert code changes

---

## Impact Analysis

### Affected Domains

| Domain | Files Affected | Estimated Effort |
|--------|---------------|------------------|
| Equipment | 2 repositories, 1 service | 2 hours |
| Inventory | 3 repositories, 2 services | 3 hours |
| Vision | 1 repository | 1 hour |
| Kits | 2 repositories, 1 service | 2 hours |
| Media | 1 repository | 1 hour |
| **Total** | **9 repositories, 4 services** | **9 hours** |

### Breaking Changes

**API Endpoints:**
- If any REST APIs return `company_id` in responses, they will break
- Frontend code expecting `company_id` will need updates
- Database exports/imports will need field mapping

**Mitigations:**
- Add `company_id` alias in API responses during transition period
- Use TypeScript interfaces with both fields
- Deprecation warnings in logs

### Database Performance

**Before Migration:**
- Some queries join `tenant_id` to `company_id` (requires index on both)
- Inefficient for query planner

**After Migration:**
- All queries use `tenant_id` consistently
- Single index strategy
- Better query performance (~5-10% improvement expected)

---

## Convention Going Forward

### New Table Checklist

When creating a new table:

1. ✅ Use `tenant_id` column (NOT `company_id`)
2. ✅ Data type: `UUID` (consistent with `tenants.id`)
3. ✅ Add `NOT NULL` constraint (every row must have tenant)
4. ✅ Add foreign key: `REFERENCES tenants(id) ON DELETE CASCADE`
5. ✅ Add index: `CREATE INDEX idx_tablename_tenant ON tablename(tenant_id);`
6. ✅ Add RLS policy referencing `tenant_id`

**Template SQL:**
```sql
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- other columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_new_table_tenant ON new_table(tenant_id);

ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own tenant data"
  ON new_table FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM users_extended WHERE id = auth.uid()
  ));
```

### Repository Pattern

**Template for TypeScript:**
```typescript
export class NewTableRepository extends BaseRepository<NewTable> {
  async findAll(tenantId: string): Promise<NewTable[]> {
    const { data, error } = await this.supabaseClient
      .from('new_table')
      .select('*')
      .eq('tenant_id', tenantId);  // ✅ Always use tenant_id

    if (error) throw this.handleError(error);
    return data.map(this.mapFromDb);
  }

  private mapFromDb(data: any): NewTable {
    return {
      id: data.id,
      tenantId: data.tenant_id,  // ✅ Map to camelCase
      // ...
    };
  }

  private mapToDb(data: Partial<NewTable>): any {
    const mapped: any = {};
    if (data.tenantId) mapped.tenant_id = data.tenantId;  // ✅ Map back
    return mapped;
  }
}
```

### Pre-Commit Hook

**Recommendation:** Add linting rule to prevent `company_id` in new tables

```typescript
// .eslintrc.js custom rule (future enhancement)
rules: {
  'no-company-id-column': 'error',  // Enforce tenant_id only
}
```

---

## Security Implications

### RLS Policy Patterns

**Current State (Inconsistent):**
```sql
-- Some tables:
USING (tenant_id = (SELECT tenant_id FROM users_extended WHERE id = auth.uid()))

-- Other tables:
USING (company_id = (SELECT tenant_id FROM users_extended WHERE id = auth.uid()))
```

**Desired State (Consistent):**
```sql
-- All tables:
USING (tenant_id IN (
  SELECT tenant_id FROM users_extended WHERE id = auth.uid()
))
```

### Multi-Tenant Isolation

**Verification Checklist:**
1. ✅ Every row has `tenant_id`
2. ✅ RLS enabled on all tenant tables
3. ✅ Policies use `tenant_id` consistently
4. ✅ No queries bypass RLS (admin overrides documented)
5. ✅ Foreign keys cascade properly
6. ✅ Integration tests verify cross-tenant isolation

---

## Related Issues

### Issue #1: Tables Without Tenancy

Some tables have neither `tenant_id` nor `company_id`:

| Table | Risk | Recommendation |
|-------|------|----------------|
| `customers` | ⚠️ HIGH | Add `tenant_id` column |
| `voice_sessions` | ⚠️ MEDIUM | Add `tenant_id` column |
| `media_assets` | ⚠️ MEDIUM | Verify `company_id` exists (may be false positive) |

**Action:** Audit these tables separately.

### Issue #2: Variable Naming Mismatch

Even after column standardization, some repositories use inconsistent variable names:

```typescript
// Inconsistent:
const companyId = getUserCompanyId();
.eq('tenant_id', companyId);  // Variable name doesn't match column!

// Consistent:
const tenantId = getUserTenantId();
.eq('tenant_id', tenantId);  // ✅ Clear!
```

**Action:** Rename variables during code migration.

---

## Timeline

### Immediate (Phase 2 - Current Sprint)
- [x] Document tenancy model (this file)
- [ ] Get team alignment on `tenant_id` standard
- [ ] Create detailed migration script

### Short-Term (Next Sprint)
- [ ] Execute database migration (4 hours)
- [ ] Update repositories and services (9 hours)
- [ ] Run full test suite
- [ ] Deploy to staging for QA

### Medium-Term (Within Month)
- [ ] Monitor production for issues
- [ ] Update all documentation
- [ ] Add pre-commit linting rule
- [ ] Deprecate `company_id` references

---

## FAQ

**Q: Why not just add a computed column or view?**
A: Views don't help with RLS policies, and computed columns add complexity. Direct column standardization is cleaner.

**Q: Can we support both columns during transition?**
A: Not recommended - doubles the migration complexity and maintains confusion longer.

**Q: What about third-party integrations using `company_id`?**
A: API layer can translate (e.g., accept `company_id` in request, map to `tenant_id` internally).

**Q: Will this affect performance?**
A: Positively - consistent indexing strategy improves query planner efficiency.

**Q: How long is the estimated downtime?**
A: Zero downtime if migration is non-blocking. Column renames are instant in Postgres.

---

## References

- Original Architecture: `/docs/architecture/multi-tenant-design.md` (if exists)
- RLS Documentation: Supabase RLS guide
- Related Issue: `CODEBASE_ANALYSIS_REPORT.md` Issue #2

---

**Status:** Ready for team review and approval
**Next Step:** Get consensus on standardization approach
**Owner:** Architecture team
**Reviewers:** Backend team, DevOps team