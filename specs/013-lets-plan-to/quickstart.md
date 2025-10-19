# Quick Start Guide: Template and Task Image Management

**Feature**: 013-lets-plan-to
**Date**: 2025-10-19
**Purpose**: Manual testing scenarios for image upload and display functionality

## Prerequisites

### Environment Setup
- ✅ Supabase project running locally or on hosted instance
- ✅ Database migrations applied (image URL columns added)
- ✅ Storage buckets created (`task-template-images`, `task-images`)
- ✅ RLS policies applied on storage buckets
- ✅ Test user with supervisor role and valid JWT

### Test Data
- ✅ At least one task template exists
- ✅ At least one job exists (for creating tasks)
- ✅ Test images available (JPEG/PNG, < 10MB)
- ✅ Camera-enabled device OR test image files

### Account Credentials
```
Test Supervisor:
- Email: super@tophand.tech
- Password: demo123
- Tenant: Demo Company (should be in JWT app_metadata)
```

---

## Test Scenario 1: Add Image to Task Template

**Objective**: Verify supervisors can upload images to templates via camera or file upload

### Steps

1. **Navigate to Templates Page**
   ```
   URL: http://localhost:3000/supervisor/templates
   Expected: List of task templates displayed
   ```

2. **Open Template Detail/Edit Page**
   ```
   Action: Click on an existing template card
   URL: http://localhost:3000/supervisor/templates/{template_id}/edit
   Expected: Template edit form loads
   ```

3. **Locate Image Upload Section**
   ```
   Expected: "Template Image" section visible
   Initial State: "No image uploaded" message OR "Add Image" button
   ```

4. **Test Camera Capture** (if on mobile/camera-enabled device)
   ```
   Action: Click "Take Photo" button
   Expected: Camera permission prompt
   Action: Allow camera access
   Expected: Live camera preview appears
   Action: Click capture button (camera icon)
   Expected:
     - Camera closes
     - "Processing image..." spinner shows
     - After ~1-2 seconds, preview of captured image appears
     - Three file upload requests made (thumbnail, medium, full)
   ```

5. **Test File Upload** (alternative to camera)
   ```
   Action: Click "Upload Image" button
   Expected: File picker dialog opens
   Action: Select a JPEG or PNG file (< 10MB)
   Expected:
     - File picker closes
     - "Processing image..." spinner shows
     - After ~1-2 seconds, preview of uploaded image appears
     - Three file upload requests made to Supabase Storage
   ```

6. **Verify Database Update**
   ```
   Action: Refresh page or navigate away and back
   Expected:
     - Image persists (not lost on reload)
     - Image displays on template edit page
     - Image URLs populated in database:
       - thumbnail_url
       - medium_url
       - primary_image_url
   ```

7. **Verify Thumbnail on List Page**
   ```
   Action: Navigate back to /supervisor/templates
   Expected:
     - Template card shows thumbnail image (150x150px)
     - Image loads quickly (< 500ms)
   ```

8. **Verify Medium Image on Detail Page**
   ```
   Action: Click template to view details (not edit)
   Expected:
     - Medium-sized image (800x800px) displayed
     - Image clear and properly sized
   ```

### Success Criteria
- ✅ Camera capture works without errors
- ✅ File upload works without errors
- ✅ All three image sizes created and uploaded
- ✅ Database updated with correct URLs
- ✅ Thumbnail appears on list page
- ✅ Medium image appears on detail page
- ✅ Images persist across page reloads

---

## Test Scenario 2: Add Image to Workflow Task

**Objective**: Verify images can be added to individual tasks

### Prerequisites
- Job with at least one task exists
- OR create new task via task detail page

### Steps

1. **Navigate to Task List** (if exists)
   ```
   URL: http://localhost:3000/supervisor/tasks
   OR from job detail page
   Expected: List of tasks displayed
   ```

2. **Open Task Detail Page**
   ```
   Action: Click on a task card
   URL: http://localhost:3000/supervisor/tasks/{task_id}
   Expected: Task detail page loads (NEW PAGE)
   Layout: Similar to template detail (main content + sidebar)
   ```

3. **Add Image to Task**
   ```
   Action: Follow same camera/upload steps as Scenario 1
   Expected: Same behavior (camera capture or file upload)
   Result: Task image uploaded independently
   ```

4. **Verify Task Image Independence**
   ```
   Given: Task was created from template with image
   When: Update task image
   Then: Template image remains unchanged
   When: Update template image
   Then: Task image remains unchanged
   ```

5. **Verify Thumbnail on Task Card**
   ```
   Action: Navigate back to task list
   Expected: Task card shows thumbnail (if list exists)
   ```

### Success Criteria
- ✅ Task Detail page exists and loads correctly
- ✅ Image upload works same as templates
- ✅ Task images independent from template images
- ✅ All three sizes created and stored

---

## Test Scenario 3: Image Inheritance from Template

**Objective**: Verify tasks inherit template images on creation

### Steps

1. **Ensure Template Has Image**
   ```
   Given: Template "Standard Inspection" has image
   Verify: Template thumbnail visible on list page
   ```

2. **Create Task from Template**
   ```
   Action: Create new job OR add tasks to existing job
   Method: Use "Add tasks from template" functionality
   Select: Template with image
   Create: New workflow task(s)
   ```

3. **Verify Image Inheritance**
   ```
   Query Database:
     SELECT thumbnail_url, medium_url, primary_image_url
     FROM workflow_tasks
     WHERE id = '{new_task_id}';

   Expected:
     - All three URLs match template URLs
     - Task has exact same image as template
   ```

4. **Verify UI Display**
   ```
   Action: View newly created task detail page
   Expected:
     - Task image matches template image
     - Image loaded from task-images bucket (not template bucket)
   ```

5. **Update Template Image**
   ```
   Action: Go back to template, replace image with different photo
   Result: Template now has new image
   ```

6. **Verify Existing Task Unchanged**
   ```
   Action: View previously created task
   Expected:
     - Task still shows original image
     - No automatic update occurred
     - "Snapshot" behavior confirmed
   ```

7. **Create New Task from Updated Template**
   ```
   Action: Create another task from same template
   Expected:
     - New task gets NEW template image
     - Old task still has old image
   ```

### Success Criteria
- ✅ Tasks created from template inherit image URLs
- ✅ Template image changes do NOT affect existing tasks
- ✅ New tasks get current template image
- ✅ Each task has independent image storage

---

## Test Scenario 4: Image Replacement

**Objective**: Verify images can be replaced without losing functionality

### Steps

1. **Template with Existing Image**
   ```
   Given: Template has image (from Scenario 1)
   ```

2. **Replace Image**
   ```
   Action: On template edit page, click "Change Image" or re-upload
   Method: Upload different image file
   Expected:
     - Old image preview replaced
     - New processing occurs
     - New URLs generated
     - Database updated with new URLs
   ```

3. **Verify Old Storage Files**
   ```
   Check Supabase Storage:
     Bucket: task-template-images
     Path: {tenant_id}/{template_id}/
   Expected:
     - Old image files still present (not deleted)
     - New image files also present
     - Database points to new files only
   ```

4. **Verify UI Updates**
   ```
   Action: Refresh list page
   Expected:
     - Thumbnail shows new image
   Action: View detail page
   Expected:
     - Medium image shows new image
   ```

### Success Criteria
- ✅ Image replacement works smoothly
- ✅ No 404 errors during transition
- ✅ Old files preserved (soft delete)
- ✅ UI immediately reflects new image

---

## Test Scenario 5: Image Removal

**Objective**: Verify images can be removed/cleared

### Steps

1. **Template with Image**
   ```
   Given: Template has image
   ```

2. **Remove Image**
   ```
   Action: Click "Remove Image" or X button
   Expected:
     - Confirmation dialog (optional)
     - Image preview clears
     - Database URLs set to NULL
   ```

3. **Verify Storage Not Deleted**
   ```
   Check Supabase Storage:
   Expected:
     - Image files still present in bucket
     - Only database URLs cleared
   ```

4. **Verify UI Reflects Removal**
   ```
   List Page: No thumbnail shown (or placeholder icon)
   Detail Page: "No image" or "Add Image" button
   ```

5. **Re-add Image**
   ```
   Action: Upload image again (same or different)
   Expected: Works normally
   ```

### Success Criteria
- ✅ Image removal clears URLs
- ✅ Storage files preserved
- ✅ UI handles NULL gracefully
- ✅ Re-upload works after removal

---

## Test Scenario 6: Permission Validation

**Objective**: Verify only authorized users can upload images

### Steps

1. **Login as Worker** (non-supervisor)
   ```
   Expected: Worker role, not supervisor
   ```

2. **Attempt Template Image Upload**
   ```
   Navigate: /supervisor/templates (if accessible)
   Expected: Either 403 Forbidden OR upload button hidden/disabled
   ```

3. **Attempt Direct API Call**
   ```
   POST /api/task-templates/{id}/image
   Headers: Worker JWT
   Expected: 403 Forbidden response
   ```

4. **Login as Supervisor**
   ```
   Expected: Upload buttons visible and functional
   ```

### Success Criteria
- ✅ Non-supervisors cannot upload template images
- ✅ API enforces permission checks
- ✅ UI hides/disables upload for non-supervisors

---

## Test Scenario 7: Error Handling

**Objective**: Verify graceful handling of errors

### Test Cases

#### 7.1 Invalid Image Format
```
Action: Upload .HEIC or unsupported format
Expected:
  - Clear error message: "HEIC format not supported. Please use JPEG or PNG."
  - Upload cancelled
  - No partial database update
```

#### 7.2 Network Failure During Upload
```
Action: Upload image, disconnect network mid-upload
Expected:
  - Error message: "Upload failed. Please check connection."
  - Retry option OR clear to try again
  - No partial data in database
```

#### 7.3 File Size Too Large
```
Action: Upload 150MB image (over 100MB limit)
Expected:
  - Error before processing: "File too large (max 100MB)"
  - No processing attempted
```

#### 7.4 Camera Permission Denied
```
Action: Click "Take Photo", deny camera permission
Expected:
  - Error message: "Camera access denied. Please allow camera permissions."
  - Fallback to file upload option visible
```

### Success Criteria
- ✅ All error scenarios handled gracefully
- ✅ Clear error messages displayed
- ✅ No database corruption on failures
- ✅ Users can recover and retry

---

## Test Scenario 8: Cross-Tenant Isolation

**Objective**: Verify tenant isolation in storage and database

### Steps

1. **Login as Tenant A Supervisor**
   ```
   Create template with image
   Note: template_id and tenant_id
   ```

2. **Verify Storage Path**
   ```
   Check Supabase Storage:
     Path: task-template-images/{tenant_a_id}/{template_id}/...
   Expected: Files exist in tenant A folder
   ```

3. **Login as Tenant B Supervisor** (different tenant)
   ```
   Expected: Cannot see Tenant A's templates
   ```

4. **Attempt to Access Tenant A's Image URL Directly**
   ```
   Action: Paste Tenant A's image URL in browser
   Expected:
     - Image loads (public bucket)
     - BUT: Tenant B cannot UPDATE/DELETE (RLS enforced)
   ```

5. **Attempt Direct API Call to Update Tenant A's Template**
   ```
   POST /api/task-templates/{tenant_a_template_id}/image
   Headers: Tenant B supervisor JWT
   Expected: 403 Forbidden OR 404 Not Found
   ```

### Success Criteria
- ✅ Storage paths tenant-isolated
- ✅ RLS prevents cross-tenant updates
- ✅ Database queries filtered by tenant_id
- ✅ API enforces tenant isolation

---

## Performance Validation

### Metrics to Check

**Image Processing Time**:
- ✅ Target: < 5 seconds for typical image (< 5MB)
- ✅ Measure: Time from upload/capture to preview display

**Thumbnail Load Time**:
- ✅ Target: < 500ms on first load
- ✅ Test: Navigate to list page, measure image load

**Medium Image Load Time**:
- ✅ Target: < 1.5 seconds on first load
- ✅ Test: Open detail page, measure image load

**Camera Start Time**:
- ✅ Target: < 1 second from button click to preview
- ✅ Test: Click "Take Photo", measure to video display

**Tools**:
- Browser DevTools Network tab
- Lighthouse performance audit
- Manual stopwatch for user-perceived time

---

## Cleanup After Testing

### Optional: Remove Test Data

```sql
-- Clear image URLs from test templates
UPDATE task_templates
SET thumbnail_url = NULL,
    medium_url = NULL,
    primary_image_url = NULL
WHERE tenant_id = '{test_tenant_id}';

-- Clear image URLs from test tasks
UPDATE workflow_tasks
SET thumbnail_url = NULL,
    medium_url = NULL,
    primary_image_url = NULL
WHERE tenant_id = '{test_tenant_id}';
```

### Optional: Remove Test Storage Files

Via Supabase Dashboard:
1. Navigate to Storage > task-template-images
2. Delete test tenant folder
3. Repeat for task-images bucket

---

## Troubleshooting

### Issue: Images not loading

**Check**:
1. Browser console for 404 errors
2. Supabase Storage bucket exists and is public
3. RLS policies applied correctly
4. URLs in database are correct format

### Issue: Upload fails with 403

**Check**:
1. User has supervisor role
2. JWT contains app_metadata.tenant_id
3. RLS policies allow INSERT for authenticated users
4. Storage bucket permissions correct

### Issue: Processing takes too long

**Check**:
1. Image file size (compress if > 10MB)
2. Browser console for JavaScript errors
3. Network speed (try on different connection)
4. ImageProcessor utility functioning correctly

---

## Summary Checklist

**Pre-Implementation**:
- [ ] All prerequisites met
- [ ] Test environment ready
- [ ] Test accounts created

**Post-Implementation**:
- [ ] Scenario 1: Template image upload ✅
- [ ] Scenario 2: Task image upload ✅
- [ ] Scenario 3: Image inheritance ✅
- [ ] Scenario 4: Image replacement ✅
- [ ] Scenario 5: Image removal ✅
- [ ] Scenario 6: Permission validation ✅
- [ ] Scenario 7: Error handling ✅
- [ ] Scenario 8: Tenant isolation ✅
- [ ] Performance metrics met ✅

**Ready for Production**: All scenarios pass with no critical issues

---

*Last Updated: 2025-10-19*
*Feature: 013-lets-plan-to*
