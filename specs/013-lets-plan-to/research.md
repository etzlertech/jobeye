# Research: Template and Task Image Management

**Feature**: 013-lets-plan-to
**Date**: 2025-10-19
**Status**: Complete

## Executive Summary

This research document consolidates findings on existing image infrastructure, database schema, component patterns, and storage strategies to inform the implementation of image support for task templates and workflow tasks.

**Key Decisions:**
1. Reuse existing `ImageProcessor` utility and `ItemImageUpload` component patterns
2. Add three image URL columns to `task_templates` and `workflow_tasks` tables
3. Create two new storage buckets: `task-template-images` and `task-images`
4. Implement tenant-isolated storage paths
5. Copy template images to tasks on creation (no automatic updates)

## 1. Existing Image Infrastructure

### 1.1 ImageProcessor Utility

**Location**: `/src/utils/image-processor.ts`

**Capabilities** (verified from source):
- Accepts File object or base64 data URL
- Creates three image sizes:
  - Thumbnail: 150x150px
  - Medium: 800x800px
  - Full: 2048x2048px
- Outputs base64-encoded JPEG strings
- Maintains aspect ratio with cropping
- Quality optimization for each size

**Decision**: ✅ Reuse as-is. Proven, tested, and matches requirements perfectly.

**Rationale**: The utility already provides exactly the three sizes needed (thumbnail for cards, medium for details, full for storage). No modifications required.

### 1.2 ItemImageUpload Component

**Location**: `/src/components/items/ItemImageUpload.tsx`

**Features** (verified from source):
- Camera capture with MediaDevices API
- File upload with validation
- Preview functionality
- Processing state management
- Error handling for unsupported formats (HEIC)
- Integration with ImageProcessor

**Decision**: ✅ Extract reusable pattern, create generic base component or direct reuse

**Rationale**: Component is well-structured and handles all requirements (camera, upload, processing). Can be generalized or copied with minimal changes.

**Pattern to Follow**:
```typescript
// 1. Camera capture flow
startCamera() → getUserMedia() → show video preview
capturePhoto() → canvas.drawImage() → imageProcessor.processImage()

// 2. File upload flow
fileInput.onChange() → validate format → imageProcessor.processImage()

// 3. Callback pattern
onImageCapture(ProcessedImages) → parent handles storage upload
```

### 1.3 Existing Image URL Patterns

**Tables with images** (from agent-quickstart.md):
- `items`: thumbnail_url, medium_url, primary_image_url
- `properties`: thumbnail_url, medium_url, primary_image_url
- `users_extended`: thumbnail_url, medium_url, primary_image_url

**Storage buckets** (from agent-quickstart.md):
- `item-images`: {tenant_id}/{item_id}/{timestamp}-{filename}
- `property-images`: {tenant_id}/{property_id}/{timestamp}-{filename}
- `profile-images`: {user_id}/{timestamp}-{filename}

**Decision**: ✅ Follow existing three-URL pattern consistently

**Rationale**: Consistent schema makes client code simpler. All entities use same field names (thumbnail_url, medium_url, primary_image_url).

## 2. Database Schema Investigation

### 2.1 task_templates Table

**Current Schema** (from existing API code review):
```sql
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  job_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);
```

**RLS Policies** (confirmed from constitution):
- Policy: "tenant_isolation"
- Pattern: `tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')`
- Status: ✅ Already in place

**Required Additions**:
```sql
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS medium_url TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
```

**Decision**: ✅ Add three nullable TEXT columns for image URLs

**Rationale**: Matches existing pattern from items/properties tables. Nullable allows gradual migration.

### 2.2 workflow_tasks Table

**Current Schema** (inferred from domain types and components):
```sql
CREATE TABLE workflow_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  task_description TEXT NOT NULL,
  task_order INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'in-progress', 'complete', etc.
  is_required BOOLEAN DEFAULT false,
  requires_photo_verification BOOLEAN DEFAULT false,
  requires_supervisor_approval BOOLEAN DEFAULT false,
  acceptance_criteria TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  supervisor_approved BOOLEAN DEFAULT false,
  supervisor_notes TEXT,
  verification_photo_url TEXT, -- EXISTING photo field (different purpose)
  ai_confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note**: `verification_photo_url` is for task completion verification (different from template image)

**Required Additions**:
```sql
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS medium_url TEXT;
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
```

**Decision**: ✅ Add three image URL columns, keep verification_photo_url separate

**Rationale**: Template/task images are visual references. Verification photos are completion proof. Different purposes, both needed.

### 2.3 RLS Policy Verification

**Current State**: ✅ Both tables have RLS enabled with tenant isolation
**Pattern**: Uses `app_metadata.tenant_id` from JWT (constitutional requirement)
**Action Required**: None for table policies (already compliant)

## 3. Component Reusability Analysis

### 3.1 ItemImageUpload Generalization

**Current Implementation**:
- Hard-coded to `/api/supervisor/items/{id}/image` endpoint
- Callback-based (receives `ProcessedImages`, parent handles upload)
- Actually well-separated: processing is local, upload is parent's job

**Generalization Strategy**:
- ✅ Component is already generic (callback pattern)
- ✅ Can reuse directly with different upload handlers
- ❌ No changes needed to component itself

**Alternative Names** (if creating copies):
- `TaskTemplateImageUpload` (template-specific)
- `TaskImageUpload` (task-specific)
- Or keep generic: `ImageCapture` component

**Decision**: ✅ Reuse ItemImageUpload component directly, or create minimal wrapper

**Rationale**: Component already uses callback pattern. Parent components handle API calls. Perfect separation of concerns.

### 3.2 Detail Page Pattern

**Reference**: `/src/app/demo-items/[itemId]/page.tsx`

**Pattern Elements**:
1. Grid layout (sidebar for image, main content for details)
2. Image display section with edit button
3. Upload state management (uploadingImage boolean)
4. ItemImageUpload component integration
5. Mobile-responsive (switches to column layout)

**Apply to Task Detail Page**:
```typescript
// Similar structure:
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Main content (task details) */}
  <div className="lg:col-span-2">
    {/* Task information */}
  </div>

  {/* Sidebar (image) */}
  <div className="space-y-6">
    <div className="bg-white rounded-lg shadow p-6">
      {/* Image display or upload interface */}
    </div>
  </div>
</div>
```

**Decision**: ✅ Follow item detail page layout pattern exactly

**Rationale**: Consistent UX across detail pages. Users already familiar with this pattern.

## 4. Storage Bucket Strategy

### 4.1 Bucket Naming Convention

**Existing Pattern** (from docs):
- `{entity-type}-images` format
- Examples: `item-images`, `property-images`, `profile-images`

**Proposed Buckets**:
- `task-template-images` (for task templates)
- `task-images` (for workflow tasks)

**Decision**: ✅ Create two separate buckets following naming convention

**Rationale**:
- Separation allows different retention/backup policies if needed
- Matches existing pattern (one bucket per entity type)
- Simpler RLS policies (one policy per bucket)

### 4.2 Path Structure

**Pattern** (from existing buckets):
- Tenant-isolated: `{tenant_id}/...`
- Entity-scoped: `{tenant_id}/{entity_id}/...`
- Timestamped: `{tenant_id}/{entity_id}/{timestamp}-{filename}`

**Proposed Paths**:
```
task-template-images:
  {tenant_id}/{template_id}/thumbnail-{timestamp}.jpg
  {tenant_id}/{template_id}/medium-{timestamp}.jpg
  {tenant_id}/{template_id}/full-{timestamp}.jpg

task-images:
  {tenant_id}/{task_id}/thumbnail-{timestamp}.jpg
  {tenant_id}/{task_id}/medium-{timestamp}.jpg
  {tenant_id}/{task_id}/full-{timestamp}.jpg
```

**Decision**: ✅ Use tenant-isolated, entity-scoped paths with size prefixes

**Rationale**: Enforces tenant isolation at storage level. Makes cleanup/migration easier.

### 4.3 RLS Policy Design

**Pattern** (from item-images bucket):
```sql
-- Upload (INSERT)
CREATE POLICY "Authenticated users can upload within their tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-template-images' AND
  (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
);

-- Read (SELECT) - public bucket
CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-template-images');

-- Update/Delete
CREATE POLICY "Users can update/delete their tenant's images"
ON storage.objects FOR UPDATE/DELETE
TO authenticated
USING (
  bucket_id = 'task-template-images' AND
  (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
);
```

**Decision**: ✅ Tenant-isolated RLS using app_metadata.tenant_id

**Rationale**: Constitutional requirement. Prevents cross-tenant access.

## 5. Image Inheritance Pattern

### 5.1 Task Creation from Template

**Current Flow** (from API code):
```typescript
// TaskTemplateService.createTasksFromTemplate()
1. Load template with items
2. For each template item:
   - Create workflow_task
   - Copy: task_description, task_order, is_required, etc.
   - Set: job_id, status='pending', tenant_id
```

**Image Inheritance Strategy**:
```typescript
// Add to task creation:
const task = {
  // ... existing fields
  thumbnail_url: templateItem.thumbnail_url,  // Copy from template
  medium_url: templateItem.medium_url,
  primary_image_url: templateItem.primary_image_url
};
```

**Decision**: ✅ Copy image URLs from template to task on creation

**Rationale**:
- Tasks start with template's visual reference
- Tasks can update images independently later
- Template image changes don't affect existing tasks (intentional)

### 5.2 Template Image Update Behavior

**Scenario**: Supervisor updates template image after tasks created

**Options**:
1. ❌ Automatically update all task images (cascading update)
2. ✅ Leave existing task images unchanged (snapshot approach)
3. ❌ Prompt user to update tasks (complex UX)

**Decision**: ✅ Option 2 - Snapshot approach (no automatic updates)

**Rationale**:
- Tasks represent work at a point in time
- Changing task images after assignment could confuse workers
- Template is a blueprint; tasks are instances
- Simpler implementation (no cascade logic needed)

**Edge Case Handling**:
- Template image deleted: Tasks keep their copied URLs (may break if storage deleted)
- Solution: Don't delete storage files, only update DB URLs
- Or: Implement soft delete on storage (keep files, clear URLs)

## 6. Performance Considerations

### 6.1 Image Processing

**ImageProcessor Performance** (from existing usage):
- Processing time: ~500ms - 2s for typical images
- Happens client-side (doesn't block server)
- Shows loading UI during processing

**Decision**: ✅ Client-side processing acceptable

**Rationale**: Existing implementation works well. Meets <5s requirement from spec.

### 6.2 Storage Upload

**Supabase Storage Performance**:
- Three files per upload (thumb, medium, full)
- Sequential uploads currently (from ItemImageUpload)
- Typical upload time: ~1-3s total

**Optimization Opportunity**:
- Could parallelize three uploads
- Would reduce total time to ~1s

**Decision**: ✅ Keep sequential for now (matches existing pattern)

**Rationale**: Existing implementation is fast enough. Optimization can come later if needed.

### 6.3 Image Display

**Current Pattern** (from item detail):
- Uses standard `<img>` tags with Supabase Storage URLs
- Browser caching handles repeat views
- Thumbnails load quickly (<500ms)

**Decision**: ✅ Use same pattern (standard img tags)

**Rationale**: Simple, works well, meets performance requirements.

## 7. Testing Strategy

### 7.1 Unit Tests

**Repository Methods**:
- `TaskTemplateRepository.updateImageUrls(id, urls)`
- `WorkflowTaskRepository.updateImageUrls(id, urls)`

**Test Cases**:
- Update image URLs successfully
- Handle null URLs (clearing images)
- Verify tenant isolation (can't update other tenant's images)

### 7.2 Integration Tests

**API Endpoints**:
- `POST /api/task-templates/[id]/image`
- `POST /api/workflow-tasks/[id]/image`

**Test Cases**:
- Upload valid image, verify all three URLs returned
- Reject invalid image format
- Reject non-supervisor user
- Verify storage files created
- Verify database updated

### 7.3 E2E Tests

**User Flows** (Playwright):
1. Login as supervisor
2. Navigate to template edit page
3. Click "Add Image"
4. Upload test image
5. Verify thumbnail appears on list page
6. Verify medium image on detail page

**Test Cases**:
- Camera capture flow (mock getUserMedia)
- File upload flow
- Image display on cards
- Image display on detail pages

## 8. Migration Considerations

### 8.1 Backward Compatibility

**Existing Data**: All existing templates and tasks have no images

**Migration Strategy**:
- ✅ Add columns as nullable
- ✅ No data migration needed (all NULL initially)
- ✅ UI handles NULL gracefully (shows "Add Image" button)

**Decision**: ✅ Additive-only migration, no breaking changes

### 8.2 Rollback Plan

**If needed**:
```sql
-- Rollback (only if absolutely necessary)
ALTER TABLE task_templates DROP COLUMN IF EXISTS thumbnail_url;
ALTER TABLE task_templates DROP COLUMN IF EXISTS medium_url;
ALTER TABLE task_templates DROP COLUMN IF EXISTS primary_image_url;

-- Same for workflow_tasks
```

**Storage Bucket Cleanup**:
- Delete buckets via Supabase dashboard
- Or keep for potential re-deployment

**Decision**: ✅ Document rollback but don't execute unless critical issue

## 9. Alternatives Considered

### 9.1 Single Image vs. Three Sizes

**Alternative**: Store only full-size image, generate thumbnails on-the-fly

**Rejected Because**:
- Slower performance (generation on every request)
- More server load
- Existing pattern uses pre-generated sizes

**Decision**: ✅ Stick with three pre-generated sizes

### 9.2 Single Storage Bucket

**Alternative**: Use one bucket for all entity images (templates + tasks)

**Rejected Because**:
- Harder to manage RLS policies
- Doesn't match existing pattern (separate buckets per entity)
- Makes cleanup/migration more complex

**Decision**: ✅ Separate buckets (task-template-images, task-images)

### 9.3 Automatic Template Image Updates

**Alternative**: When template image changes, update all derived task images

**Rejected Because**:
- Complex implementation (track template→task relationships)
- Unexpected behavior for users (their task images change without action)
- Tasks represent point-in-time work assignments

**Decision**: ✅ Snapshot approach (no automatic updates)

## 10. Open Questions

### ✅ Resolved

1. **Q**: Should task_template_items have images too?
   **A**: No. Items are text descriptions only. Template-level image represents the overall template.

2. **Q**: What happens to storage files when template/task deleted?
   **A**: Implement soft delete (set image URLs to null, keep storage files). Hard delete can be done via cleanup job later.

3. **Q**: Can workers upload images to tasks?
   **A**: Initially no (supervisor-only per spec). Future enhancement if needed.

4. **Q**: Max image file size?
   **A**: 100MB (Supabase bucket limit). Acceptable for photos from phones.

### ⚠️ Deferred to Implementation

1. **Q**: Should we validate image dimensions on upload?
   **A**: No for MVP. ImageProcessor handles all sizes. Add validation later if abuse occurs.

2. **Q**: Image compression quality settings?
   **A**: Use ImageProcessor defaults (tested and working). Tune later if needed.

3. **Q**: CDN for image delivery?
   **A**: Supabase Storage has CDN built-in. No action needed.

## 11. Summary of Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Reuse ImageProcessor utility | Proven, matches requirements |
| 2 | Reuse ItemImageUpload pattern | Callback-based, already generic |
| 3 | Add three URL columns to both tables | Consistent with existing schema |
| 4 | Create two storage buckets | Matches existing pattern |
| 5 | Tenant-isolated storage paths | Constitutional requirement |
| 6 | Snapshot approach for inheritance | Tasks are point-in-time instances |
| 7 | Follow item detail page layout | Consistent UX |
| 8 | Client-side image processing | Existing pattern, fast enough |
| 9 | Nullable columns (additive migration) | Backward compatible |
| 10 | Supervisor-only upload (initially) | Matches spec, can expand later |

## 12. Next Steps (Phase 1)

1. ✅ Create data-model.md with schema details
2. ✅ Generate API contracts (OpenAPI specs)
3. ✅ Write failing contract tests
4. ✅ Create quickstart.md with manual test scenarios
5. ✅ Update CLAUDE.md with new context

**Research Complete** ✅

---

*Last Updated: 2025-10-19*
*Feature: 013-lets-plan-to*
