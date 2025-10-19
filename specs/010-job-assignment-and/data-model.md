# Data Model: Job Assignment and Crew Hub Dashboard

**Feature**: Job Assignment and Crew Hub Dashboard
**Date**: 2025-10-16
**Status**: Phase 1 Design

> **⚠️ DEPRECATION NOTICE (2025-10-19)**: References to `job_checklist_items` in this document are now **RETIRED**. The table has been dropped from the schema. Load status tracking now uses `item_transactions` (check_out/check_in) as the single source of truth. See migration `20251019_drop_job_checklist_items.sql` for details.

---

## Overview

This document defines the data model for the Job Assignment feature. The primary entity is `JobAssignment`, a junction table enabling many-to-many relationships between Jobs and Users (crew members).

**Design Principles**:
- Clean separation: Assignments as first-class entities, not embedded arrays
- Multi-tenant isolation: Every table includes `tenant_id` with RLS
- Audit trail: Track who assigned, when assigned
- Backward compatibility: Sync trigger maintains legacy `assigned_to` field

---

## 1. Primary Entity: JobAssignment

### 1.1 Database Schema

```sql
-- Job Assignments (many-to-many junction table)
CREATE TABLE IF NOT EXISTS job_assignments (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant isolation (CONSTITUTIONAL REQUIREMENT)
  tenant_id uuid NOT NULL REFERENCES tenants(id),

  -- Core relationships
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users_extended(user_id) ON DELETE CASCADE,

  -- Audit trail
  assigned_by uuid REFERENCES users_extended(user_id), -- Supervisor who made assignment
  assigned_at timestamptz DEFAULT NOW(),

  -- Standard metadata
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  -- Prevent duplicate assignments
  UNIQUE(tenant_id, job_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_assignments_tenant
  ON job_assignments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_job
  ON job_assignments(job_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_user
  ON job_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_composite
  ON job_assignments(tenant_id, user_id); -- Crew dashboard query optimization
```

### 1.2 Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (CONSTITUTIONAL PATTERN)
CREATE POLICY "tenant_isolation" ON job_assignments
  FOR ALL USING (
    tenant_id::text = (
      current_setting('request.jwt.claims', true)::json
      -> 'app_metadata' ->> 'tenant_id'
    )
  );

-- Additional policies for role-based access
CREATE POLICY "crew_view_own_assignments" ON job_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users_extended
      WHERE user_id = auth.uid()
        AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY "supervisor_manage_assignments" ON job_assignments
  FOR INSERT, UPDATE, DELETE USING (
    EXISTS (
      SELECT 1 FROM users_extended
      WHERE user_id = auth.uid()
        AND role IN ('manager', 'admin')
    )
  );
```

### 1.3 TypeScript Type Definition

```typescript
/**
 * Job Assignment Entity
 * Represents a crew member assigned to a job
 */
export interface JobAssignment {
  /** Unique assignment ID */
  id: string;

  /** Tenant ID for multi-tenant isolation */
  tenant_id: string;

  /** Job ID being assigned */
  job_id: string;

  /** User ID of crew member assigned */
  user_id: string;

  /** User ID of supervisor who made assignment */
  assigned_by: string | null;

  /** Timestamp when assignment was created */
  assigned_at: string; // ISO 8601 timestamp

  /** Standard metadata */
  created_at: string;
  updated_at: string;
}

/**
 * Job Assignment with related entities (for API responses)
 */
export interface JobAssignmentWithDetails extends JobAssignment {
  job: Job;
  user: UserProfile;
  assigned_by_user?: UserProfile;
}

/**
 * Assignment request payload
 */
export interface AssignJobRequest {
  job_id: string;
  user_ids: string[]; // Support bulk assignment
}

/**
 * Assignment response
 */
export interface AssignJobResponse {
  success: boolean;
  assignments: JobAssignment[];
  message: string;
}
```

### 1.4 Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `tenant_id` | NOT NULL, valid UUID, exists in tenants table | "Invalid tenant ID" |
| `job_id` | NOT NULL, valid UUID, exists in jobs table | "Invalid job ID" |
| `user_id` | NOT NULL, valid UUID, exists in users_extended with role='technician' | "User must be a crew member" |
| `assigned_by` | nullable UUID, if provided must exist in users_extended | "Invalid supervisor ID" |
| `unique(tenant_id, job_id, user_id)` | No duplicate assignments | "Crew member already assigned to this job" |

### 1.5 Business Rules

1. **Role Validation**: Only users with `role = 'technician'` can be assigned to jobs
2. **Tenant Isolation**: All assignments scoped to single tenant (no cross-tenant assignments)
3. **Cascade Deletion**: Deleting a job removes all assignments (ON DELETE CASCADE)
4. **Audit Trail**: `assigned_by` captures who made the assignment for accountability
5. **Backward Compat**: Trigger keeps `jobs.assigned_to` in sync with first assignment

---

## 2. Extended Entities

### 2.1 Job Entity Extensions

**New Computed Fields** (via JOIN, not stored):

```typescript
export interface Job {
  // ... existing 48 fields from jobs table ...

  // NEW: Assignment relationships (computed via JOIN)
  assigned_crew?: UserProfile[];      // Array of assigned crew members
  assigned_crew_ids?: string[];       // Array of user IDs
  assignment_count?: number;          // Count of assigned crew

  // NEW: Load progress (computed from job_checklist_items)
  total_items?: number;               // Count of checklist items
  loaded_items?: number;              // Count of items with status='loaded'
  load_percentage?: number;           // (loaded_items / total_items) * 100
}

/**
 * Job with assignment details (for Crew Hub API)
 */
export interface JobWithAssignment extends Job {
  assigned_at: string;                // When crew member was assigned
  assigned_by: string | null;         // Who assigned the crew member
  assigned_by_user?: UserProfile;     // Supervisor profile
}
```

**Modified Fields**:
```typescript
// DEPRECATED: Legacy single assignment field (maintained by trigger)
assigned_to?: string | null;  // @deprecated Use job_assignments table instead

// DEPRECATED: Unused team array field
assigned_team?: string[] | null;  // @deprecated Never used, consider removal
```

### 2.2 User Entity Extensions

**New Computed Fields** (via JOIN, not stored):

```typescript
export interface UserProfile {
  // ... existing fields from users_extended ...

  // NEW: Assignment relationships (computed via JOIN)
  assigned_jobs?: Job[];              // Array of jobs assigned to user
  assigned_job_ids?: string[];        // Array of job IDs
  assignment_count?: number;          // Count of assigned jobs

  // NEW: Role helpers
  is_crew?: boolean;                  // role === 'technician'
  is_supervisor?: boolean;            // role === 'manager'
}
```

**Role Enum** (existing, from users_extended):
```typescript
export enum UserRole {
  CUSTOMER = 'customer',
  TECHNICIAN = 'technician',  // Crew member
  MANAGER = 'manager',         // Supervisor
  ADMIN = 'admin',
}
```

### 2.3 Checklist Item Entity (existing)

**Table**: `job_checklist_items` (no schema changes needed)

**Used for Load Progress Calculation**:
```sql
-- Query to get load status for a job
SELECT
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE status = 'loaded') as loaded_items,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'loaded')::decimal / COUNT(*)) * 100,
    1
  ) as load_percentage
FROM job_checklist_items
WHERE job_id = $1
  AND tenant_id = $2;
```

---

## 3. Relationships

### 3.1 Entity Relationship Diagram

```
┌─────────────────┐
│    Tenants      │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐         ┌─────────────────┐
│      Jobs       │◄───────┬┤ Job Assignments │
└────────┬────────┘ 1      │└────────┬────────┘
         │                 │         │ N
         │ 1               │ N       │
         │                 │         │ 1
         │ N               │    ┌────▼──────────┐
┌────────▼────────┐        └────┤ Users Extended│
│  Job Checklist  │             └───────────────┘
│     Items       │
└─────────────────┘
```

### 3.2 Cardinality

| Relationship | Type | Description |
|-------------|------|-------------|
| Tenant → Jobs | 1:N | One tenant has many jobs |
| Tenant → Users | 1:N | One tenant has many users |
| Tenant → Job Assignments | 1:N | One tenant has many assignments |
| Job → Job Assignments | 1:N | One job can have many crew assigned |
| User → Job Assignments | 1:N | One user can be assigned to many jobs |
| Job → Checklist Items | 1:N | One job has many checklist items |
| Job Assignments → User (assigned_by) | N:1 | Many assignments created by one supervisor |

---

## 4. Backward Compatibility Strategy

### 4.1 Sync Trigger for Legacy `assigned_to` Field

**Purpose**: Maintain `jobs.assigned_to` field for existing code during transition period

**Implementation**:
```sql
-- Trigger function to sync first assignment to jobs.assigned_to
CREATE OR REPLACE FUNCTION sync_job_assigned_to()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: Update jobs.assigned_to with first assignment
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs
    SET assigned_to = NEW.user_id,
        updated_at = NOW()
    WHERE id = NEW.job_id
      AND assigned_to IS NULL; -- Only if not already assigned
    RETURN NEW;
  END IF;

  -- On DELETE: Clear jobs.assigned_to if no assignments remain
  IF TG_OP = 'DELETE' THEN
    UPDATE jobs j
    SET assigned_to = (
      SELECT user_id
      FROM job_assignments
      WHERE job_id = OLD.job_id
      LIMIT 1
    ),
    updated_at = NOW()
    WHERE id = OLD.job_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to job_assignments table
CREATE TRIGGER trigger_sync_assigned_to
  AFTER INSERT OR DELETE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_assigned_to();
```

**Behavior**:
- **INSERT**: Sets `jobs.assigned_to` to first crew member assigned
- **DELETE**: Updates `jobs.assigned_to` to next crew member, or NULL if none remain
- **UPDATE**: Not needed (assignments are immutable, delete + insert instead)

### 4.2 Migration Path

**Phase 1** (this feature):
- Create `job_assignments` table
- Backfill existing `assigned_to` values → `job_assignments`
- Install sync trigger
- New UI uses `job_assignments` table
- Legacy UI continues using `assigned_to` field (works via trigger)

**Phase 2** (future):
- Migrate all code to use `job_assignments` table
- Remove sync trigger
- Deprecate `assigned_to` and `assigned_team` columns
- Database cleanup migration (optional column removal)

---

## 5. State Transitions

### 5.1 Assignment Lifecycle

```
┌──────────────┐
│ Unassigned   │  (job exists, no assignments)
└──────┬───────┘
       │
       │ Supervisor assigns crew
       ▼
┌──────────────┐
│  Assigned    │  (1+ job_assignments rows exist)
└──────┬───────┘
       │
       │ Multiple transitions possible:
       │
       ├──► Add more crew (INSERT job_assignments)
       │
       ├──► Remove crew (DELETE job_assignments)
       │
       ├──► Job completed/cancelled (assignments remain for history)
       │
       └──► Job deleted (assignments CASCADE deleted)
```

**Notes**:
- Assignment deletion doesn't change job status
- Job completion doesn't delete assignments (preserved for audit)
- Job deletion cascades to assignments (ON DELETE CASCADE)

### 5.2 Load Status Transitions

```
Job with Items
       │
       ▼
┌──────────────────┐
│ Items: 0/N       │  (No items loaded)
│ Status: Pending  │
└────────┬─────────┘
         │
         │ Crew loads items
         ▼
┌──────────────────┐
│ Items: M/N       │  (Some items loaded, M < N)
│ Status: Partial  │
└────────┬─────────┘
         │
         │ Crew finishes loading
         ▼
┌──────────────────┐
│ Items: N/N       │  (All items loaded)
│ Status: Complete │
└──────────────────┘
```

**UI Behavior** (from spec FR-013):
- If `loaded_items < total_items`: Navigate to Item Load List (editable)
- If `loaded_items === total_items`: Navigate to Job Details (read-only)

---

## 6. Query Patterns

### 6.1 Common Queries

**1. Assign crew to job**:
```sql
INSERT INTO job_assignments (tenant_id, job_id, user_id, assigned_by)
VALUES ($1, $2, $3, $4)
ON CONFLICT (tenant_id, job_id, user_id) DO NOTHING
RETURNING *;
```

**2. Get all crew assigned to job**:
```sql
SELECT
  ja.*,
  u.email, u.display_name, u.role
FROM job_assignments ja
JOIN users_extended u ON u.user_id = ja.user_id
WHERE ja.job_id = $1
  AND ja.tenant_id = $2
ORDER BY ja.assigned_at ASC;
```

**3. Get all jobs assigned to crew member** (Crew Hub):
```sql
SELECT
  j.*,
  ja.assigned_at,
  ja.assigned_by,
  (SELECT COUNT(*) FROM job_checklist_items WHERE job_id = j.id) as total_items,
  (SELECT COUNT(*) FROM job_checklist_items WHERE job_id = j.id AND status = 'loaded') as loaded_items
FROM jobs j
JOIN job_assignments ja ON ja.job_id = j.id
WHERE ja.user_id = $1
  AND ja.tenant_id = $2
  AND j.status = 'scheduled'
ORDER BY j.scheduled_start ASC;
```

**4. Remove crew assignment**:
```sql
DELETE FROM job_assignments
WHERE tenant_id = $1
  AND job_id = $2
  AND user_id = $3
RETURNING *;
```

**5. Get assignment history for job**:
```sql
SELECT
  ja.*,
  u.email as crew_email,
  u.display_name as crew_name,
  s.email as supervisor_email,
  s.display_name as supervisor_name
FROM job_assignments ja
JOIN users_extended u ON u.user_id = ja.user_id
LEFT JOIN users_extended s ON s.user_id = ja.assigned_by
WHERE ja.job_id = $1
  AND ja.tenant_id = $2
ORDER BY ja.assigned_at DESC;
```

---

## 7. Performance Characteristics

### 7.1 Expected Data Volumes

| Entity | Estimated Rows | Growth Rate |
|--------|----------------|-------------|
| Jobs | 1,000 - 10,000 | 10-50 jobs/day |
| Users (Crew) | 10 - 100 | 1-5 users/month |
| Job Assignments | 1,000 - 50,000 | 10-100 assignments/day |

### 7.2 Index Coverage

| Query Pattern | Covering Index | Expected Performance |
|---------------|----------------|---------------------|
| Assign crew to job | `idx_job_assignments_job` | <10ms |
| List crew for job | `idx_job_assignments_job` | <20ms |
| List jobs for crew | `idx_job_assignments_composite(tenant_id, user_id)` | <50ms |
| Remove assignment | `idx_job_assignments_job` | <10ms |
| Dashboard query (JOIN jobs) | `idx_jobs_scheduled_start` + composite index | <200ms |

### 7.3 Scalability Notes

- **Small Scale** (10 crew, 100 jobs): All queries <50ms
- **Medium Scale** (50 crew, 1000 jobs): Dashboard queries ~100-200ms
- **Large Scale** (100 crew, 10,000 jobs): Consider pagination (10-20 jobs per crew typical)

**Optimization Opportunities** (if needed):
1. Materialize load status in jobs table (denormalize total_items, loaded_items)
2. Add partial index: `WHERE status = 'scheduled'` for active jobs
3. Partition job_assignments by tenant_id (if multi-tenant grows >100 tenants)

---

## 8. Data Integrity Constraints

### 8.1 Database Constraints

| Constraint | Type | Purpose |
|------------|------|---------|
| `job_assignments.id PRIMARY KEY` | Uniqueness | Every assignment has unique ID |
| `UNIQUE(tenant_id, job_id, user_id)` | Uniqueness | Prevent duplicate assignments |
| `tenant_id NOT NULL REFERENCES tenants(id)` | Foreign Key | Enforce tenant existence |
| `job_id NOT NULL REFERENCES jobs(id) ON DELETE CASCADE` | Foreign Key | Enforce job existence, cascade delete |
| `user_id NOT NULL REFERENCES users_extended(user_id) ON DELETE CASCADE` | Foreign Key | Enforce user existence, cascade delete |
| `assigned_by REFERENCES users_extended(user_id)` | Foreign Key | Enforce supervisor existence (nullable) |

### 8.2 Application-Level Validations

```typescript
// TypeScript validation schema (using Zod)
export const JobAssignmentSchema = z.object({
  tenant_id: z.string().uuid(),
  job_id: z.string().uuid(),
  user_id: z.string().uuid(),
  assigned_by: z.string().uuid().nullable(),
});

// Business rule validations (in service layer)
export async function validateJobAssignment(
  assignment: JobAssignment,
  userRole: UserRole
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Rule 1: Only crew members can be assigned
  const user = await getUserById(assignment.user_id);
  if (user.role !== 'technician') {
    errors.push('Only crew members (technicians) can be assigned to jobs');
  }

  // Rule 2: Only supervisors can assign
  if (userRole !== 'manager' && userRole !== 'admin') {
    errors.push('Only supervisors can assign jobs');
  }

  // Rule 3: Job must exist and be in assignable state
  const job = await getJobById(assignment.job_id);
  if (!job) {
    errors.push('Job not found');
  } else if (job.status === 'completed' || job.status === 'cancelled') {
    errors.push('Cannot assign crew to completed or cancelled jobs');
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 9. Testing Requirements

### 9.1 Unit Tests (Data Model)

- ✅ `JobAssignment` schema validation (valid/invalid UUIDs, NULL handling)
- ✅ `validateJobAssignment` business rules (role checks, job status checks)
- ✅ Load percentage calculation logic (0/N, M/N, N/N cases)

### 9.2 Integration Tests (Database)

- ✅ Insert job assignment (success case)
- ✅ Duplicate assignment prevention (UNIQUE constraint)
- ✅ Foreign key constraints (invalid tenant/job/user IDs)
- ✅ Cascade deletion (deleting job removes assignments)
- ✅ Sync trigger (assigned_to field updates correctly)

### 9.3 RLS Tests (Security)

- ✅ Tenant isolation: User A cannot see User B's assignments (different tenants)
- ✅ Crew can view own assignments only
- ✅ Supervisor can view all assignments in their tenant
- ✅ Supervisor can create/delete assignments
- ✅ Crew cannot create/delete assignments

---

## 10. Future Extensions

### 10.1 Potential Schema Additions (Phase 2+)

**Assignment Metadata**:
```sql
-- Track assignment acceptance/rejection by crew
accepted boolean DEFAULT NULL,
accepted_at timestamptz,
rejected_reason text,

-- Track assignment completion
completed_at timestamptz,
```

**Assignment Notifications**:
```sql
-- Link to notification system
notified boolean DEFAULT false,
notified_at timestamptz,
notification_method text, -- 'email', 'push', 'sms'
```

**Historical Tracking**:
```sql
-- Soft delete for audit trail
deleted_at timestamptz,
deleted_by uuid REFERENCES users_extended(user_id),
```

### 10.2 Computed Fields (Future Materialization)

Currently computed via JOIN, could be materialized for performance:

**On jobs table**:
```sql
-- Denormalized assignment count
assignment_count integer DEFAULT 0,

-- Denormalized load status
total_checklist_items integer DEFAULT 0,
loaded_checklist_items integer DEFAULT 0,
```

**Trade-offs**:
- ✅ Faster dashboard queries (no JOIN needed)
- ❌ More complex update logic (triggers to maintain consistency)
- ❌ Data duplication (source of truth in checklist_items)

**Recommendation**: Start with JOINs, materialize only if performance issues at scale.

---

## 11. Data Model Summary

**Status**: ✅ Phase 1 Complete

**Entities Defined**:
1. ✅ `job_assignments` table (new, primary entity)
2. ✅ `Job` extensions (computed fields via JOIN)
3. ✅ `User` extensions (role helpers, computed fields)

**Relationships**:
- ✅ Many-to-many between Jobs and Users (via job_assignments)
- ✅ Audit trail (assigned_by → users_extended)
- ✅ Tenant isolation (all entities scoped to tenant_id)

**Constraints**:
- ✅ Foreign keys with cascade rules
- ✅ Unique constraint (no duplicate assignments)
- ✅ RLS policies for multi-tenant security

**Backward Compatibility**:
- ✅ Sync trigger maintains legacy `assigned_to` field
- ✅ Migration path defined (Phase 1 → Phase 2)

**Performance**:
- ✅ Indexes for all query patterns
- ✅ Expected performance <200ms for dashboard queries
- ✅ Scalability analysis (10 - 100 crew, 1,000 - 10,000 jobs)

**Testing**:
- ✅ Unit, integration, RLS test requirements defined
- ✅ Validation rules documented

**Ready for**: Phase 1 API contracts and quickstart scenarios.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-16
**Next Phase**: API contracts design
