# Complete RLS Policy Definitions

**Timestamp**: 2025-10-15T01:35:00Z
**Applied**: 2025-10-15T01:34:48Z

## Constitution-Approved Pattern

All policies follow Constitution §1 approved pattern:

```sql
tenant_id::text = (
  current_setting('request.jwt.claims', true)::json
  -> 'app_metadata'
  ->> 'tenant_id'
)
```

---

## 1. customers_tenant_isolation

**Table**: customers
**Command**: ALL
**Role**: authenticated
**Status**: ✅ Active

### Complete Definition

```sql
CREATE POLICY customers_tenant_isolation ON customers
FOR ALL TO authenticated
USING (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
)
WITH CHECK (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);
```

### Validation
- ✅ Name: `customers_tenant_isolation`
- ✅ Role: `authenticated`
- ✅ USING: Constitution pattern
- ✅ WITH CHECK: Matches USING
- ✅ Old policy removed: `customers_demo_access`

---

## 2. properties_tenant_isolation

**Table**: properties
**Command**: ALL
**Role**: authenticated
**Status**: ✅ Active

### Complete Definition

```sql
CREATE POLICY properties_tenant_isolation ON properties
FOR ALL TO authenticated
USING (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
)
WITH CHECK (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);
```

### Validation
- ✅ Name: `properties_tenant_isolation`
- ✅ Role: `authenticated`
- ✅ USING: Constitution pattern
- ✅ WITH CHECK: Matches USING
- ✅ Old policies removed:
  - `"Users can manage their tenant's properties"`
  - `"Users can view their tenant's properties"`

---

## 3. items_tenant_isolation

**Table**: items
**Command**: ALL
**Role**: authenticated
**Status**: ✅ Active

### Complete Definition

```sql
CREATE POLICY items_tenant_isolation ON items
FOR ALL TO authenticated
USING (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
)
WITH CHECK (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);
```

### Validation
- ✅ Name: `items_tenant_isolation`
- ✅ Role: `authenticated` (changed from `public`)
- ✅ USING: Constitution pattern
- ✅ WITH CHECK: Matches USING (added)

---

## 4. jobs_tenant_isolation

**Table**: jobs
**Command**: ALL
**Role**: authenticated
**Status**: ✅ Active

### Complete Definition

```sql
CREATE POLICY jobs_tenant_isolation ON jobs
FOR ALL TO authenticated
USING (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
)
WITH CHECK (
  tenant_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);
```

### Validation
- ✅ Name: `jobs_tenant_isolation`
- ✅ Role: `authenticated`
- ✅ USING: Constitution pattern
- ✅ WITH CHECK: Matches USING
- ✅ Old policies removed:
  - `"Users can manage their tenant's jobs"`
  - `"Users can view their tenant's jobs"`

---

## 5. job_checklist_items_tenant_isolation

**Table**: job_checklist_items
**Command**: ALL
**Role**: authenticated
**Status**: ✅ Active

### Complete Definition

```sql
CREATE POLICY job_checklist_items_tenant_isolation ON job_checklist_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_checklist_items.job_id
    AND j.tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata'
      ->> 'tenant_id'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_checklist_items.job_id
    AND j.tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata'
      ->> 'tenant_id'
    )
  )
);
```

### Validation
- ✅ Name: `job_checklist_items_tenant_isolation`
- ✅ Role: `authenticated`
- ✅ USING: Constitution pattern (via JOIN to jobs)
- ✅ WITH CHECK: Matches USING (added)

**Special Note**: This table enforces tenant isolation via relationship with the `jobs` table, which has a direct `tenant_id` column. This is by design, as `job_checklist_items` does not have its own `tenant_id` column.

---

## Summary

### All Policies Applied Successfully

| # | Table | Policy Name | Role | USING | WITH CHECK | Old Policies Removed |
|---|-------|-------------|------|-------|------------|---------------------|
| 1 | customers | customers_tenant_isolation | authenticated | ✅ Constitution | ✅ Yes | ✅ 1 policy |
| 2 | properties | properties_tenant_isolation | authenticated | ✅ Constitution | ✅ Yes | ✅ 2 policies |
| 3 | items | items_tenant_isolation | authenticated | ✅ Constitution | ✅ Yes | ✅ Recreated |
| 4 | jobs | jobs_tenant_isolation | authenticated | ✅ Constitution | ✅ Yes | ✅ 2 policies |
| 5 | job_checklist_items | job_checklist_items_tenant_isolation | authenticated | ✅ Constitution | ✅ Yes | ✅ Recreated |

**Total**: 5/5 tables (100%) Constitution §1 compliant

### Old Policies Confirmed GONE

1. ✅ `customers_demo_access` - REMOVED
2. ✅ `"Users can manage their tenant's properties"` - REMOVED
3. ✅ `"Users can view their tenant's properties"` - REMOVED
4. ✅ `"Users can manage their tenant's jobs"` - REMOVED
5. ✅ `"Users can view their tenant's jobs"` - REMOVED

All old policies using hardcoded tenant IDs or `tenant_assignments` lookups have been successfully removed and replaced with Constitution-compliant policies.

---

**Document Generated**: 2025-10-15T01:35:00Z
**Validation Method**: Script execution confirmation + idempotent re-run verification
**Status**: ✅ All policies validated and active
