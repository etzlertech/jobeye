# Quickstart Guide: Task-Item Association

**Feature**: 015-task-item-association
**Purpose**: Verify task-level item association functionality
**Estimated Time**: 15 minutes

## Prerequisites

- [ ] Development environment running (Next.js dev server)
- [ ] Database migrations applied
- [ ] Test tenant and user accounts created
- [ ] Sample items and kits in inventory
- [ ] At least one task template created

## Test Scenario 1: Add Items to Template Task

**Goal**: Associate required equipment with a task template item

### Steps

1. **Navigate to Task Templates**
   ```
   Browser: https://localhost:3000/supervisor/templates
   ```
   - ✅ See list of templates
   - ✅ Click "Edit" on any template

2. **Open Template Editor**
   - ✅ See list of template task items
   - ✅ Click to expand any task item accordion

3. **Add Item to Task**
   - ✅ See "Required Items" section below task description
   - ✅ Click "Add Item" button
   - ✅ Item browser modal opens
   - ✅ See list of inventory items
   - ✅ Select "Push Mower" (or any test item)
   - ✅ Modal closes
   - ✅ See "Push Mower" in Required Items list
   - ✅ Shows quantity: 1 (default)
   - ✅ Shows "Required" badge

4. **Edit Item Association**
   - ✅ Click on item card
   - ✅ Can change quantity (e.g., 2)
   - ✅ Can toggle required/optional
   - ✅ Can add notes (e.g., "Ensure blade is sharp")
   - ✅ Save changes
   - ✅ See updated values in item card

5. **Add Kit to Task**
   - ✅ Click "Add Kit" button
   - ✅ Kit browser modal opens
   - ✅ See list of available kits
   - ✅ Select "Small Yard Kit" (or any test kit)
   - ✅ Modal closes
   - ✅ See "Small Yard Kit" in Required Items list
   - ✅ Can expand kit to see contents (optional UI feature)

6. **Remove Item Association**
   - ✅ Click remove/delete icon on item card
   - ✅ Confirm deletion
   - ✅ Item removed from Required Items list

7. **Save Template**
   - ✅ Click "Save Template" button
   - ✅ Success message appears
   - ✅ Page reloads or updates
   - ✅ Item associations persist (reload page to verify)

**Expected Database State**:
```sql
SELECT * FROM task_template_item_associations
WHERE template_item_id = '[the task item ID]';
```
- Should show associations with correct item_id or kit_id
- quantity, is_required, notes should match UI inputs

## Test Scenario 2: Instantiate Template with Items

**Goal**: Verify item associations copy to workflow tasks

### Steps

1. **Create Job from Template**
   ```
   Browser: https://localhost:3000/supervisor/jobs/create
   ```
   - ✅ Select template with item associations (from Scenario 1)
   - ✅ Fill job details (client, site, etc.)
   - ✅ Click "Create Job"
   - ✅ Job created successfully

2. **View Job Details**
   - ✅ Navigate to job detail page
   - ✅ See "Equipment Needed" section (or similar)
   - ✅ Tab for "Job-Level Items" (existing feature)
   - ✅ Tab for "Task-Level Items" (new feature)

3. **Verify Task Equipment Tab**
   - ✅ Click "Task-Level Items" tab
   - ✅ See list grouped by task
   - ✅ Each task shows associated items/kits
   - ✅ Quantities match template
   - ✅ Required/optional status matches template
   - ✅ All items show status: "Pending"

**Expected Database State**:
```sql
SELECT wt.task_description, wtia.*
FROM workflow_tasks wt
JOIN workflow_task_item_associations wtia ON wt.id = wtia.workflow_task_id
WHERE wt.job_id = '[the new job ID]';
```
- Should show workflow_task_item_associations for each task
- source_template_association_id should link back to template
- status should be 'pending'
- loaded_at, loaded_by should be NULL

## Test Scenario 3: Load Equipment for Task

**Goal**: Worker marks equipment as loaded

### Steps

1. **Navigate to Workflow Task**
   ```
   Browser: https://localhost:3000/worker/tasks/[task-id]
   (or from job detail, click task to view)
   ```
   - ✅ See task description
   - ✅ See "Required Equipment" section

2. **View Equipment List**
   - ✅ See list of items/kits for this task
   - ✅ Each shows quantity needed
   - ✅ Required items have "Required" badge
   - ✅ Each shows status: "Pending" or icon

3. **Mark Item as Loaded**
   - ✅ Click "Mark Loaded" button/checkbox on first item
   - ✅ Status updates to "Loaded"
   - ✅ Shows timestamp or "just now"
   - ✅ Shows loaded by current user

4. **Attempt to Complete Task with Missing Required Item**
   - ✅ Leave at least one required item as "Pending"
   - ✅ Try to mark task as complete
   - ✅ Validation error appears
   - ✅ Error message: "Required items not loaded" (or similar)
   - ✅ Task status remains incomplete

5. **Load All Required Items**
   - ✅ Mark all required items as "Loaded"
   - ✅ Optional items can stay pending
   - ✅ Try to complete task again
   - ✅ Task successfully marked complete

**Expected Database State**:
```sql
SELECT * FROM workflow_task_item_associations
WHERE workflow_task_id = '[the task ID]' AND status = 'loaded';
```
- loaded items should have status='loaded'
- loaded_at should be timestamped
- loaded_by should be current user ID

## Test Scenario 4: Supervisor Override

**Goal**: Supervisor customizes item requirements for specific job

### Steps

1. **View Job as Supervisor**
   ```
   Browser: https://localhost:3000/supervisor/jobs/[job-id]
   ```
   - ✅ See job detail page
   - ✅ Click "Edit Equipment" (or "Customize Tasks")

2. **Add Custom Item to Task**
   - ✅ Select a specific task
   - ✅ Click "Add Item" for that task
   - ✅ Item browser opens
   - ✅ Select additional item not in template (e.g., "Leaf Blower")
   - ✅ Item added to task
   - ✅ Item does NOT have source_template_association_id (custom addition)

3. **Remove Template Item**
   - ✅ Find item that came from template (has template link)
   - ✅ Click remove
   - ✅ Confirmation: "This will only affect this job"
   - ✅ Confirm deletion
   - ✅ Item removed from THIS job only

4. **Verify Template Unchanged**
   - ✅ Navigate back to template edit page
   - ✅ Original item still in template
   - ✅ Template not affected by job-level changes

**Expected Database State**:
```sql
-- Custom item (no template link)
SELECT * FROM workflow_task_item_associations
WHERE workflow_task_id = '[task ID]' AND source_template_association_id IS NULL;

-- Template still has original association
SELECT * FROM task_template_item_associations
WHERE template_item_id = '[template item ID]';
```

## Test Scenario 5: Performance Validation

**Goal**: Verify system performs well with many associations

### Steps

1. **Create Large Template**
   - ✅ Template with 10 tasks
   - ✅ Each task has 5 item associations (50 total)
   - ✅ Save completes in < 2 seconds

2. **Instantiate to Job**
   - ✅ Create job from large template
   - ✅ Job creation completes in < 1 second
   - ✅ All 50 associations copied to workflow_task_item_associations

3. **Load Job Equipment View**
   ```
   Browser: https://localhost:3000/supervisor/jobs/[job-id]
   ```
   - ✅ Equipment tab loads in < 1 second
   - ✅ All tasks and items visible
   - ✅ No N+1 query issues (check network tab / DB logs)

4. **Check Database Performance**
   ```sql
   EXPLAIN ANALYZE
   SELECT wt.*, wtia.*, i.name as item_name, k.name as kit_name
   FROM workflow_tasks wt
   LEFT JOIN workflow_task_item_associations wtia ON wt.id = wtia.workflow_task_id
   LEFT JOIN items i ON wtia.item_id = i.id
   LEFT JOIN kits k ON wtia.kit_id = k.id
   WHERE wt.job_id = '[job ID]';
   ```
   - ✅ Query execution time < 100ms
   - ✅ Indexes used (check query plan)

## Test Scenario 6: RLS and Tenant Isolation

**Goal**: Verify tenant isolation works correctly

### Steps

1. **Login as Tenant A User**
   - ✅ Create template with item associations
   - ✅ Create job from template
   - ✅ Note template ID and job ID

2. **Login as Tenant B User**
   - ✅ Try to access Tenant A's template URL
   - ✅ 404 or Unauthorized error
   - ✅ Try to access Tenant A's job URL
   - ✅ 404 or Unauthorized error

3. **Direct Database Query (Admin)**
   ```sql
   -- Should NOT return Tenant A's data for Tenant B
   SELECT * FROM task_template_item_associations
   WHERE tenant_id = '[Tenant B ID]';
   ```
   - ✅ No cross-tenant data visible

4. **RLS Policy Test**
   ```sql
   SET request.jwt.claims = '{"app_metadata": {"tenant_id": "[Tenant B ID]"}}';
   SELECT * FROM task_template_item_associations; -- Should only show Tenant B data
   ```

## Success Criteria

### Functional Validation
- [x] Can add items to template tasks
- [x] Can add kits to template tasks
- [x] Can edit item quantities and required/optional status
- [x] Can remove item associations
- [x] Template instantiation copies associations correctly
- [x] Worker can mark items as loaded
- [x] Required items block task completion
- [x] Supervisor can override template associations
- [x] Job-level changes don't affect template

### Performance Validation
- [x] Template save < 2 seconds (10 tasks, 50 associations)
- [x] Job creation < 1 second
- [x] Job equipment view load < 1 second
- [x] Database query < 100ms

### Security Validation
- [x] RLS policies enforce tenant isolation
- [x] Cross-tenant access blocked
- [x] Role-based permissions work (supervisor vs. worker)

### Data Integrity
- [x] Foreign key constraints prevent orphans
- [x] XOR constraint enforced (item_id XOR kit_id)
- [x] Cascade deletes work correctly
- [x] Unique constraints prevent duplicates

## Rollback Test

If issues found:

1. **Disable Feature Flag** (if using feature flags)
   ```
   FEATURE_TASK_ITEM_ASSOCIATIONS=false
   ```

2. **Rollback Migration**
   ```sql
   -- Run rollback SQL from data-model.md
   DROP TABLE IF EXISTS workflow_task_item_associations;
   DROP TABLE IF EXISTS task_template_item_associations;
   DROP TYPE IF EXISTS task_item_status;
   ```

3. **Verify System Still Works**
   - ✅ Templates work without item associations
   - ✅ Jobs work without task equipment
   - ✅ No errors in console or logs

## Troubleshooting

### Issue: Item associations not showing
**Check**:
- Database migration applied?
- RLS policies created?
- Browser console errors?
- Network tab shows successful API calls?

### Issue: Tenant isolation not working
**Check**:
- JWT contains app_metadata.tenant_id?
- RLS policy uses correct path?
- Supabase client configured correctly?

### Issue: Performance degradation
**Check**:
- Indexes created on foreign keys?
- Query plan shows index usage?
- N+1 query problem (check DB logs)?

### Issue: Cannot complete task (required items)
**Check**:
- All required items marked 'loaded' or 'verified'?
- Business rule logic in service layer correct?
- Status transitions allowed?

## Next Steps

After quickstart validation:
1. Run full test suite (unit + integration)
2. User acceptance testing with real supervisors/workers
3. Performance testing with production-scale data
4. Security audit (penetration testing on RLS)
5. Deploy to staging environment
6. Monitor for issues before production release
