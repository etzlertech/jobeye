# Quickstart: Task Management Testing Guide

**Feature**: 014-add-task-management
**Date**: 2025-10-19
**Purpose**: Validate all critical user flows and edge cases

## Prerequisites

1. Development environment running (`npm run dev`)
2. Database migrated with `task_definitions` table
3. Test tenants created (Tenant A, Tenant B)
4. Test users with roles:
   - `supervisor-a@test.com` (Tenant A, supervisor role)
   - `supervisor-b@test.com` (Tenant B, supervisor role)
   - `worker-a@test.com` (Tenant A, worker role)

## Test Scenario 1: Create Task Definition

**User**: supervisor-a@test.com
**Goal**: Create a new task definition

### Steps
1. Navigate to `/supervisor/dashboard`
2. Click "Tasks" tile
3. Click "Create Task" button
4. Fill form:
   - Name: "Check brake fluid level"
   - Description: "Inspect brake fluid reservoir and verify fluid is between MIN and MAX marks"
   - Acceptance Criteria: "Fluid level at or above MIN mark, no discoloration, cap properly sealed"
   - Check "Requires photo verification"
   - Leave "Requires supervisor approval" unchecked
   - Leave "Required" checked
5. Click "Save"

### Expected Result
- Task definition created successfully
- Redirected to task list page
- New task appears in list with all fields displayed
- Created timestamp shows current time

### Validation
```sql
SELECT * FROM task_definitions WHERE name = 'Check brake fluid level';
-- Should return 1 row with:
-- - tenant_id = Tenant A's ID
-- - requires_photo_verification = true
-- - requires_supervisor_approval = false
-- - is_required = true
-- - created_by = supervisor-a's user ID
```

---

## Test Scenario 2: View Task Definition List

**User**: supervisor-a@test.com
**Goal**: View all task definitions for Tenant A

### Steps
1. Navigate to `/supervisor/task-definitions`
2. Observe task list

### Expected Result
- All Tenant A's task definitions displayed
- Sorted alphabetically by name
- Each card shows:
  - Task name
  - Description (truncated if long)
  - Flags (photo verification, supervisor approval, required)
- Load time < 2 seconds (NFR-001)

### Validation
- Count matches database: `SELECT COUNT(*) FROM task_definitions WHERE tenant_id = 'tenant-a-id' AND deleted_at IS NULL`
- No Tenant B tasks visible

---

## Test Scenario 3: Edit Task Definition

**User**: supervisor-a@test.com
**Goal**: Update existing task definition

### Steps
1. From task list, click "Check brake fluid level"
2. Click "Edit" button
3. Update:
   - Description: "Inspect brake fluid reservoir and verify fluid is between MIN and MAX marks. Check for leaks or contamination."
   - Check "Requires supervisor approval"
4. Click "Save"

### Expected Result
- Task definition updated successfully
- `updated_at` timestamp changed
- New description saved
- `requires_supervisor_approval` now true
- Other fields unchanged

### Validation
```sql
SELECT * FROM task_definitions WHERE name = 'Check brake fluid level';
-- Verify:
-- - description contains "Check for leaks"
-- - requires_supervisor_approval = true
-- - updated_at > created_at
```

---

## Test Scenario 4: Delete Unused Task Definition

**User**: supervisor-a@test.com
**Goal**: Delete a task definition not used in any templates

### Steps
1. Create new test task:
   - Name: "Test task for deletion"
   - Description: "This will be deleted"
2. Save task
3. From list, click delete icon on "Test task for deletion"
4. Confirm deletion

### Expected Result
- Task definition soft-deleted (deleted_at set)
- Removed from task list
- No error displayed

### Validation
```sql
SELECT * FROM task_definitions WHERE name = 'Test task for deletion';
-- Should return 1 row with deleted_at NOT NULL
```

---

## Test Scenario 5: Attempt to Delete In-Use Task Definition

**User**: supervisor-a@test.com
**Goal**: Verify deletion guard prevents breaking templates

### Setup
1. Create task definition "Oil change procedure"
2. Add this definition to a task template "Vehicle Maintenance"

### Steps
1. From task list, click delete icon on "Oil change procedure"
2. Observe error message

### Expected Result
- Deletion BLOCKED
- Error message displays:
  - "Cannot delete. This task definition is used in N template(s):"
  - List of template names
- Options: "Cancel" or "View Templates"
- Task definition remains active

### Validation
```sql
SELECT deleted_at FROM task_definitions WHERE name = 'Oil change procedure';
-- deleted_at should be NULL (not deleted)

SELECT COUNT(*) FROM task_template_items
WHERE source_definition_id = (SELECT id FROM task_definitions WHERE name = 'Oil change procedure');
-- Should return > 0
```

---

## Test Scenario 6: Add Task Definition to Template

**User**: supervisor-a@test.com
**Goal**: Integrate task definition into task template

### Steps
1. Navigate to `/supervisor/templates`
2. Open existing template or create new one: "Daily Inspection"
3. Click "Add Task from Library"
4. Select "Check brake fluid level"
5. Confirm addition

### Expected Result
- Task added to template
- Template item contains:
  - Copied task_description from definition
  - Copied acceptance_criteria
  - Copied flags (photo verification, supervisor approval, required)
  - `source_definition_id` references original definition
- Template can be saved

### Validation
```sql
SELECT tti.*, td.name AS source_name
FROM task_template_items tti
JOIN task_definitions td ON tti.source_definition_id = td.id
WHERE td.name = 'Check brake fluid level';

-- Verify:
-- - task_description matches definition's description
-- - source_definition_id is NOT NULL
-- - requires_photo_verification matches definition
```

---

## Test Scenario 7: Worker Permission Check

**User**: worker-a@test.com
**Goal**: Verify workers cannot access task management

### Steps
1. Login as worker-a@test.com
2. Navigate to `/supervisor/dashboard`
3. Attempt to access `/supervisor/task-definitions`

### Expected Result
- Dashboard redirects worker to worker dashboard
- Direct navigation to `/supervisor/task-definitions` returns 403 Forbidden
- No "Tasks" tile visible on worker dashboard

### Validation
- API call to `GET /api/task-definitions` returns 403
- Role check in middleware blocks access

---

## Test Scenario 8: Cross-Tenant Isolation

**User**: supervisor-b@test.com
**Goal**: Verify RLS prevents cross-tenant access

### Steps
1. Login as supervisor-b@test.com (Tenant B)
2. Navigate to `/supervisor/task-definitions`
3. Observe task list

### Expected Result
- Only Tenant B's task definitions visible
- None of Tenant A's definitions appear
- Attempt to access Tenant A's task by ID returns 404

### Validation
```sql
-- As Tenant B user (via RLS simulation)
SET request.jwt.claims = '{"app_metadata":{"tenant_id":"tenant-b-uuid"}}';

SELECT * FROM task_definitions;
-- Should only return Tenant B's definitions

-- Attempt to access Tenant A's definition
SELECT * FROM task_definitions WHERE id = 'tenant-a-task-id';
-- Should return 0 rows (RLS blocks)
```

---

## Performance Validation

### Test: Task List Load Time

**Goal**: Verify NFR-001 (< 2 seconds with 100 tasks)

### Setup
1. Seed database with 100 task definitions for Tenant A

### Steps
1. Navigate to `/supervisor/task-definitions`
2. Measure page load time (Network tab)

### Expected Result
- Total load time < 2 seconds
- Initial render < 500ms
- Full list rendered < 1 second

---

## Edge Case Tests

### EC-1: Empty Name Validation
**Input**: name = "" (empty string)
**Expected**: 400 error, "Name is required"

### EC-2: Exceeds Max Length
**Input**: description = 3000 characters
**Expected**: 400 error, "Description must be 2000 characters or less"

### EC-3: Null Acceptance Criteria
**Input**: acceptance_criteria = null
**Expected**: 201 created successfully, field stored as NULL

### EC-4: Boolean Default Values
**Input**: Omit all boolean flags
**Expected**:
- requires_photo_verification = false
- requires_supervisor_approval = false
- is_required = true

### EC-5: Concurrent Edit Conflict
**User A**: Opens definition for edit
**User B**: Deletes same definition
**User A**: Attempts to save
**Expected**: 404 error, "Task definition no longer exists"

---

## Regression Tests

After implementing this feature, verify existing functionality:

1. **Task Templates Still Work**
   - Create template without using library
   - Edit existing templates
   - Delete templates

2. **Workflow Tasks Still Work**
   - Create job from template
   - Complete tasks
   - Photo verification works

3. **RLS Still Enforced**
   - Templates remain tenant-isolated
   - Workflow tasks remain tenant-isolated

---

## Test Data Setup Script

```sql
-- Run as service role
INSERT INTO task_definitions (tenant_id, name, description, requires_photo_verification, is_required, created_by)
VALUES
  ('tenant-a-uuid', 'Check tire pressure', 'Verify all tires at recommended PSI', true, true, 'supervisor-a-uuid'),
  ('tenant-a-uuid', 'Inspect windshield wipers', 'Check for cracks or deterioration', false, true, 'supervisor-a-uuid'),
  ('tenant-a-uuid', 'Test headlights', 'Verify all headlights functioning', false, true, 'supervisor-a-uuid'),
  ('tenant-b-uuid', 'Check battery voltage', 'Measure voltage with multimeter', true, true, 'supervisor-b-uuid');
```

---

## Success Criteria Checklist

- [ ] Scenario 1: Create task definition
- [ ] Scenario 2: View task list
- [ ] Scenario 3: Edit task definition
- [ ] Scenario 4: Delete unused task definition
- [ ] Scenario 5: Deletion guard prevents breaking templates
- [ ] Scenario 6: Add definition to template
- [ ] Scenario 7: Worker permission check
- [ ] Scenario 8: Cross-tenant isolation (RLS)
- [ ] Performance: List load < 2 seconds with 100 tasks
- [ ] All edge cases handled correctly
- [ ] No regression in existing features

---

**Quickstart Complete**: 2025-10-19
**Ready for**: Task generation and implementation
