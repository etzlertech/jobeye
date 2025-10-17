# Quickstart: Job Assignment and Crew Hub Dashboard

**Feature**: Job Assignment and Crew Hub Dashboard
**Date**: 2025-10-16
**Purpose**: End-to-end test scenarios to validate feature implementation

---

## Overview

This document provides step-by-step test scenarios for validating the Job Assignment and Crew Hub Dashboard feature. These scenarios should be executed manually or automated as E2E tests after implementation.

**Test Users**:
- **Supervisor**: `super@tophand.tech` / `demo123` (role: manager)
- **Crew Member**: `crew@tophand.tech` / `demo123` (role: technician)

**Environment**: https://jobeye-production.up.railway.app/

---

## Prerequisites

### Database Setup
```sql
-- Verify test accounts exist
SELECT email, role FROM users_extended
WHERE email IN ('super@tophand.tech', 'crew@tophand.tech');

-- Should return:
-- super@tophand.tech | manager
-- crew@tophand.tech  | technician

-- Verify job_assignments table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'job_assignments';

-- Verify RLS policies
SELECT policyname FROM pg_policies
WHERE tablename = 'job_assignments';
```

### Sample Data
```sql
-- Create a test job (if needed)
INSERT INTO jobs (id, tenant_id, job_number, status, priority, scheduled_start)
VALUES (
  'test-job-001',
  (SELECT tenant_id FROM users_extended WHERE email = 'super@tophand.tech'),
  'TEST-2025-001',
  'scheduled',
  'high',
  NOW() + INTERVAL '1 day'
);

-- Create 3-5 checklist items for the job
INSERT INTO job_checklist_items (id, tenant_id, job_id, item_name, status)
VALUES
  (gen_random_uuid(), (...), 'test-job-001', '20ft Container', 'pending'),
  (gen_random_uuid(), (...), 'test-job-001', 'Forklift', 'pending'),
  (gen_random_uuid(), (...), 'test-job-001', 'Pallet Jack', 'pending');
```

---

## Scenario 1: Supervisor Assigns Crew to Job

### Test Steps

**1.1 Login as Supervisor**
```
1. Navigate to https://jobeye-production.up.railway.app/
2. Login with super@tophand.tech / demo123
3. Verify dashboard loads successfully
4. Verify tenant badge shows "Demo Company • Manager"
```

**1.2 Navigate to Job Details**
```
5. Click on a scheduled job from the dashboard
6. Verify job details page opens
7. Verify job has status="scheduled"
8. Verify "Assign Crew" button is visible
```

**1.3 Assign Crew Member**
```
9. Click "Assign Crew" button
10. Select crew member from dropdown (crew@tophand.tech)
11. Click "Assign" to confirm
12. Verify success message appears
13. Verify crew member appears in "Assigned Crew" section
14. Verify assignment timestamp is displayed
```

**Expected API Call**:
```http
POST /api/jobs/{jobId}/assign
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "user_ids": ["7c9e6679-7425-40de-944b-e07fc1f90ae7"]
}
```

**Expected Response**:
```json
{
  "success": true,
  "assignments": [
    {
      "id": "...",
      "tenant_id": "...",
      "job_id": "...",
      "user_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "assigned_by": "...",
      "assigned_at": "2025-10-16T15:30:00Z",
      "created_at": "2025-10-16T15:30:00Z",
      "updated_at": "2025-10-16T15:30:00Z"
    }
  ],
  "message": "Successfully assigned 1 crew member to job"
}
```

**1.4 Verify Database State**
```sql
-- Verify assignment was created
SELECT * FROM job_assignments
WHERE job_id = 'test-job-001'
  AND user_id = (SELECT user_id FROM users_extended WHERE email = 'crew@tophand.tech');

-- Verify sync trigger updated jobs.assigned_to
SELECT assigned_to FROM jobs WHERE id = 'test-job-001';
-- Should match crew member's user_id
```

---

## Scenario 2: Crew Member Views Assigned Jobs

### Test Steps

**2.1 Login as Crew Member**
```
1. Logout from supervisor account
2. Login with crew@tophand.tech / demo123
3. Verify crew dashboard loads
4. Verify tenant badge shows "Demo Company • Technician"
```

**2.2 View Crew Hub Dashboard**
```
5. Navigate to /crew-hub (or verify redirect from home)
6. Verify "My Jobs" section is visible
7. Verify assigned job appears in the list
8. Verify job tile shows:
   - Job number (TEST-2025-001)
   - Customer name
   - Property address
   - Scheduled start time (earliest first)
   - Load status (e.g., "0/3 items loaded")
   - Status badge (e.g., "Scheduled")
```

**Expected API Call**:
```http
GET /api/crew/jobs?status=scheduled
Authorization: Bearer {jwt_token}
```

**Expected Response**:
```json
{
  "success": true,
  "jobs": [
    {
      "id": "test-job-001",
      "job_number": "TEST-2025-001",
      "status": "scheduled",
      "priority": "high",
      "scheduled_start": "2025-10-17T08:00:00Z",
      "customer_name": "Acme Corp",
      "property_address": "123 Main St",
      "assigned_at": "2025-10-16T15:30:00Z",
      "total_items": 3,
      "loaded_items": 0,
      "load_percentage": 0.0,
      "is_fully_loaded": false
    }
  ],
  "total_count": 1,
  "has_more": false
}
```

**2.3 Verify Sort Order**
```
9. If multiple jobs assigned, verify sorted by scheduled_start ASC
10. Job with earliest scheduled time appears first ("next to load")
```

---

## Scenario 3: Crew Accesses Item Load List

### Test Steps

**3.1 Open Job with Incomplete Items**
```
1. From Crew Hub, click on job tile with loaded_items < total_items
2. Verify navigation to /jobs/{jobId}/load-list
3. Verify Item Load List screen displays
4. Verify job header shows job number and customer
5. Verify checklist items are visible
```

**3.2 Verify Item Display**
```
6. Verify each item shows:
   - Item name (e.g., "20ft Container")
   - Item type/category
   - Quantity (if applicable)
   - Load status badge ("Pending", "Loaded", "Verified")
7. Verify items can be marked as loaded (checkbox or button)
```

**3.3 Update Load Status**
```
8. Mark first item as "Loaded"
9. Verify UI updates immediately (optimistic update)
10. Verify load progress updates (e.g., "1/3 items loaded")
11. Return to Crew Hub
12. Verify job tile shows updated progress
```

---

## Scenario 4: Crew Views Fully Loaded Job

### Test Steps

**4.1 Mark All Items as Loaded**
```
1. Navigate to Item Load List for a job
2. Mark all items as "Loaded" (3/3 items)
3. Verify load progress shows "3/3 items loaded" (100%)
4. Return to Crew Hub dashboard
```

**4.2 Open Fully Loaded Job**
```
5. Click on job tile with is_fully_loaded = true
6. Verify navigation to /jobs/{jobId} (job details, not load list)
7. Verify job details page is read-only (spec FR-013b)
8. Verify "All items loaded" message or indicator
9. Verify crew CANNOT add/remove items or edit job details
```

**Expected Behavior**:
- Job tiles with `loaded_items === total_items` navigate to read-only job details
- Job tiles with `loaded_items < total_items` navigate to editable Item Load List

---

## Scenario 5: Multiple Crew Assigned to Same Job

### Test Steps

**5.1 Assign Second Crew Member**
```
1. Login as supervisor (super@tophand.tech)
2. Navigate to job details for TEST-2025-001
3. Click "Assign Crew" button
4. Select a second crew member from dropdown
5. Click "Assign"
6. Verify both crew members appear in "Assigned Crew" list
```

**Expected API Call**:
```http
POST /api/jobs/{jobId}/assign
Content-Type: application/json

{
  "user_ids": ["8d0e7780-8536-51ef-b827-f18gc2g01bf8"]
}
```

**5.2 Verify Both Crew See Job**
```
7. Login as first crew member
8. Verify job appears in their Crew Hub
9. Logout, login as second crew member
10. Verify same job appears in their Crew Hub
11. Both crew can view and update Item Load List independently
```

**5.3 Verify Concurrent Updates**
```
12. Have both crew members open Item Load List simultaneously
13. Crew A marks item 1 as loaded
14. Crew B marks item 2 as loaded
15. Verify both updates are persisted
16. Verify load progress updates correctly (2/3 items)
```

**Database Verification**:
```sql
-- Verify multiple assignments exist
SELECT user_id, assigned_at FROM job_assignments
WHERE job_id = 'test-job-001';

-- Should return 2 rows with different user_ids
```

---

## Scenario 6: Supervisor Removes Crew Assignment

### Test Steps

**6.1 Unassign Crew Member**
```
1. Login as supervisor
2. Navigate to job details
3. Verify "Assigned Crew" section shows 2 crew members
4. Click "Remove" button next to first crew member
5. Confirm removal in confirmation dialog
6. Verify crew member disappears from list
7. Verify success message appears
```

**Expected API Call**:
```http
DELETE /api/jobs/{jobId}/unassign?user_id={userId}
Authorization: Bearer {jwt_token}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Successfully removed crew member from job",
  "removed_assignment": {
    "id": "...",
    "job_id": "...",
    "user_id": "..."
  }
}
```

**6.2 Verify Crew No Longer Sees Job**
```
8. Logout from supervisor account
9. Login as removed crew member
10. Navigate to Crew Hub
11. Verify job NO LONGER appears in "My Jobs" list
12. Verify attempting to access job details returns 403/404
```

**Database Verification**:
```sql
-- Verify assignment was deleted
SELECT * FROM job_assignments
WHERE job_id = 'test-job-001'
  AND user_id = (SELECT user_id FROM users_extended WHERE email = 'crew@tophand.tech');

-- Should return 0 rows
```

---

## Scenario 7: RLS Isolation Testing

### Test Steps

**7.1 Verify Crew Can Only See Own Assignments**
```
1. Login as crew member A
2. Query API: GET /api/crew/jobs
3. Note the job IDs returned
4. Logout, login as crew member B (different user)
5. Query API: GET /api/crew/jobs
6. Verify crew member B does NOT see crew member A's jobs
7. Verify only jobs assigned to crew member B are returned
```

**7.2 Verify Tenant Isolation**
```
8. Create a test user in a DIFFERENT tenant
9. Assign a job to that user
10. Login as crew member in first tenant
11. Verify crew member cannot see jobs from second tenant
12. Query job_assignments table should filter by tenant_id via RLS
```

**Database Query**:
```sql
-- As crew member (authenticated)
SELECT * FROM job_assignments;

-- RLS policy should automatically filter to:
-- WHERE tenant_id = (current JWT app_metadata.tenant_id)
--   AND (user_id = auth.uid() OR user has supervisor role)
```

---

## Scenario 8: Error Handling

### Test Steps

**8.1 Assign Non-Existent Crew**
```
1. Login as supervisor
2. Attempt API call: POST /api/jobs/{jobId}/assign
   Body: {"user_ids": ["invalid-uuid-12345"]}
3. Verify 400 Bad Request response
4. Verify error message: "Invalid user ID format"
```

**8.2 Assign Non-Crew User**
```
1. Attempt to assign a customer (role='customer') to a job
2. Verify 400 Bad Request response
3. Verify error message: "Only users with role='technician' can be assigned to jobs"
```

**8.3 Duplicate Assignment**
```
1. Assign crew member to job
2. Attempt to assign SAME crew member again
3. Verify 400 Bad Request OR success with "already assigned" message
4. Verify only ONE assignment exists in database (UNIQUE constraint)
```

**8.4 Non-Supervisor Attempts Assignment**
```
1. Login as crew member (role='technician')
2. Attempt API call: POST /api/jobs/{jobId}/assign
3. Verify 403 Forbidden response
4. Verify error message: "Only supervisors can assign jobs"
```

**8.5 Assign to Completed Job**
```
1. Update job status to 'completed'
2. Attempt to assign crew member
3. Verify 422 Unprocessable Entity response
4. Verify error message: "Cannot assign to completed or cancelled jobs"
```

---

## Scenario 9: UI Design Consistency

### Test Steps

**9.1 Verify Crew Hub Matches Supervisor Dashboard**
```
1. Login as supervisor
2. Take screenshot of supervisor dashboard
3. Note: Layout (grid), spacing, fonts, colors, component styles
4. Logout, login as crew member
5. Take screenshot of Crew Hub
6. Compare screenshots:
   - ✅ Same 2-column grid layout for job tiles
   - ✅ Same font family, sizes, weights
   - ✅ Same color scheme (primary, secondary, accents)
   - ✅ Same button styles and spacing
   - ✅ Same card shadows and borders
```

**9.2 Verify Job Tile Components**
```
7. Verify job tiles on Crew Hub include:
   - Job number (prominent)
   - Customer name
   - Property address/location
   - Scheduled start time
   - Load status badge (e.g., "3/5 items loaded")
   - Status badge (e.g., "Scheduled", "In Progress")
   - Priority indicator (if applicable)
8. Compare to supervisor dashboard job tiles
9. Verify components are visually identical
```

---

## Scenario 10: Performance Testing

### Test Steps

**10.1 Dashboard Load Time**
```
1. Clear browser cache
2. Login as crew member with 10+ assigned jobs
3. Start timer when navigating to Crew Hub
4. Stop timer when page fully renders
5. Verify load time < 3 seconds (constitution requirement)
```

**10.2 Assignment API Response Time**
```
1. Use network tab in browser dev tools
2. Perform job assignment (POST /api/jobs/{jobId}/assign)
3. Measure API response time
4. Verify response time < 500ms (technical context goal)
```

**10.3 Concurrent Load Testing**
```
1. Have 3 crew members login simultaneously
2. All navigate to Crew Hub at same time
3. Verify all dashboards load successfully
4. Verify no database connection errors
5. Verify RLS filtering works correctly under load
```

---

## Acceptance Criteria Validation

### Functional Requirements Coverage

| Requirement | Scenario | Pass/Fail |
|-------------|----------|-----------|
| FR-001: Supervisor assigns crew to job | Scenario 1 | |
| FR-001a: Multiple crew to same job | Scenario 5 | |
| FR-002: View assigned crew | Scenario 1.3 step 13 | |
| FR-003: Remove crew assignment | Scenario 6 | |
| FR-004: Notify crew (deferred) | N/A - Phase 2 | |
| FR-005: Role validation | Scenario 8.2, 8.4 | |
| FR-006: Crew Hub matches design | Scenario 9 | |
| FR-007: "My Jobs" section | Scenario 2 | |
| FR-008: Sort by scheduled_start | Scenario 2.3 | |
| FR-009: 2-column grid | Scenario 9.1 | |
| FR-010: Show load progress | Scenario 2.2 step 8 | |
| FR-013a: Navigate to load list | Scenario 3 | |
| FR-013b: Navigate to details (fully loaded) | Scenario 4 | |

### Non-Functional Requirements

| Requirement | Measurement | Target | Pass/Fail |
|-------------|-------------|--------|-----------|
| NFR-001: Dashboard load time | Scenario 10.1 | < 3s | |
| NFR-002: Assignment API time | Scenario 10.2 | < 500ms | |
| NFR-003: Visual consistency | Scenario 9 | Match supervisor | |

### Security Requirements

| Requirement | Scenario | Pass/Fail |
|-------------|----------|-----------|
| RLS: Tenant isolation | Scenario 7.2 | |
| RLS: Crew sees own jobs only | Scenario 7.1 | |
| AuthZ: Only supervisors assign | Scenario 8.4 | |
| AuthZ: Role validation | Scenario 8.2 | |

---

## Automation Notes

### E2E Test Implementation

```typescript
// Example Playwright test for Scenario 1
describe('Job Assignment Flow', () => {
  test('supervisor can assign crew to job', async ({ page }) => {
    // 1. Login as supervisor
    await page.goto('https://jobeye-production.up.railway.app/');
    await page.fill('input[name="email"]', 'super@tophand.tech');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // 2. Navigate to job
    await page.waitForSelector('[data-testid="job-tile"]');
    await page.click('[data-testid="job-tile"]:first-child');

    // 3. Assign crew
    await page.click('[data-testid="assign-crew-button"]');
    await page.selectOption('[data-testid="crew-select"]', {
      label: 'crew@tophand.tech'
    });
    await page.click('[data-testid="confirm-assign-button"]');

    // 4. Verify success
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Successfully assigned');
    await expect(page.locator('[data-testid="assigned-crew-list"]'))
      .toContainText('crew@tophand.tech');
  });
});
```

### API Contract Tests

```typescript
// Example Jest test for API contract
describe('POST /api/jobs/:jobId/assign', () => {
  it('should assign crew to job', async () => {
    const response = await fetch(`/api/jobs/${jobId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      },
      body: JSON.stringify({
        user_ids: [crewUserId]
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.assignments).toHaveLength(1);
    expect(data.assignments[0].job_id).toBe(jobId);
    expect(data.assignments[0].user_id).toBe(crewUserId);
  });
});
```

---

## Rollback Plan

If critical issues are found during testing:

1. **Database Rollback**:
   ```sql
   -- Drop job_assignments table
   DROP TABLE IF EXISTS job_assignments CASCADE;

   -- Drop trigger
   DROP TRIGGER IF EXISTS trigger_sync_assigned_to ON job_assignments;
   DROP FUNCTION IF EXISTS sync_job_assigned_to();
   ```

2. **Code Rollback**:
   - Revert API route files
   - Revert Crew Hub UI components
   - Revert domain repositories/services

3. **Verify**:
   - Existing `jobs.assigned_to` field still functional
   - Supervisor dashboard still works
   - No impact to other features

---

## Completion Checklist

Before marking feature as complete:

- [ ] All 10 scenarios pass manually
- [ ] E2E tests automated (Playwright)
- [ ] API contract tests pass (Jest)
- [ ] RLS tests pass (7.1, 7.2)
- [ ] Performance targets met (10.1, 10.2)
- [ ] UI design reviewed and approved
- [ ] Test accounts verified in production
- [ ] Database migration applied successfully
- [ ] Railway deployment successful
- [ ] Documentation updated (README, API docs)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-16
**Next Review**: After Phase 2 implementation
