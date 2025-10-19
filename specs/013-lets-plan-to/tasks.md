# Tasks: Template and Task Image Management

**Feature**: 013-lets-plan-to
**Input**: Design documents from `/specs/013-lets-plan-to/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

## Execution Summary

This tasks file provides 20 ordered, dependency-aware implementation tasks for adding image support to task templates and workflow tasks. Tasks follow TDD principles (tests before implementation) and leverage existing infrastructure (`ImageProcessor`, `ItemImageUpload` patterns).

**Key Deliverables**:
- Database migration (3 columns × 2 tables)
- 2 storage buckets with RLS policies
- 2 API routes for image upload
- 1 new page (Task Detail)
- Component updates for image display/upload
- Integration and unit tests

**Tech Stack**: TypeScript 5.4, Next.js 14.2, React 18.3, Supabase (PostgreSQL + Storage)

---

## CODEX Task Assignment Summary

**Total CODEX-Suitable Tasks**: 8 out of 20 tasks (40%)

### ✅ CODEX Can Do (No Database Access Required)

These tasks involve pure code generation and can reference documentation from `docs/database/guides/agent-quickstart.md`:

1. **T004 [P][CODEX]**: Update TaskTemplateRepository - TypeScript repository code
2. **T005 [P][CODEX]**: Update WorkflowTaskRepository - TypeScript repository code
3. **T006 [P][CODEX]**: Create storage helper utilities - TypeScript utility code
4. **T009 [P][CODEX]**: Create template image API endpoint - Next.js route file
5. **T010 [P][CODEX]**: Create task image API endpoint - Next.js route file
6. **T012 [P][CODEX]**: Create TaskImageUpload component - React component
7. **T018 [P][CODEX]**: Integration test for templates - Vitest test file
8. **T019 [P][CODEX]**: Integration test for tasks - Vitest test file

**Total Estimated Time for CODEX**: ~8.5 hours (can be parallelized)

### ❌ Claude Code Must Do (Database/MCP Access Required)

These tasks require direct database access, Supabase dashboard interaction, or live system verification:

1. **T001**: Database migration - requires schema verification and SQL execution via MCP
2. **T002**: Storage buckets - requires Supabase dashboard/API access
3. **T003**: RLS policies - requires SQL execution and verification via MCP
4. **T011**: GET endpoint updates - benefits from live database response testing
5. **T020**: Manual testing - requires browser interaction and actual system testing

**Sequential Tasks** (not currently parallelized but could be assigned to CODEX if made parallel):
- T007, T008: Service layer updates (pure code)
- T013-T017: UI component/page updates (pure React/TypeScript)

### CODEX Assignment Strategy

**Phase-by-Phase Approach**:
1. **Phase 3.1 (Database Setup)**: Claude Code only (T001-T003)
2. **Phase 3.2 (Domain Layer)**: Mixed - T004/T005/T006 to CODEX, T007/T008 sequential
3. **Phase 3.3 (API Layer)**: Mixed - T009/T010 to CODEX, T011 to Claude Code
4. **Phase 3.4 (UI Components)**: T012 to CODEX, others sequential (could parallelize)
5. **Phase 3.5 (Testing)**: T018/T019 to CODEX, T020 to Claude Code

**Parallel Execution Opportunities**:
- After T001 completes: Launch T004, T005, T006 to CODEX simultaneously
- After T007/T008 complete: Launch T009, T010 to CODEX simultaneously
- After T017 completes: Launch T018, T019 to CODEX simultaneously

---

## Phase 3.1: Database Setup

### T001: Create and apply database migration

**Type**: Migration
**Files**:
- `supabase/migrations/20251019_add_images_to_templates_and_tasks.sql`

**Description**:
Create idempotent SQL migration to add image URL columns to both tables. MUST follow constitutional DB precheck requirements.

**CODEX Suitability**: ❌ REQUIRES Claude Code with Supabase MCP access. Must verify current schema, apply migration, and verify results via live database queries.

**Implementation Steps**:
1. **PRE-FLIGHT**: Run `npm run check:db-actual` to verify current schema
2. Create migration file with timestamp: `20251019HHMMSS_add_images_to_templates_and_tasks.sql`
3. Write idempotent ALTER TABLE statements (IF NOT EXISTS):
   ```sql
   -- Add to task_templates
   ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
   ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS medium_url TEXT;
   ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

   -- Add to workflow_tasks
   ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
   ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS medium_url TEXT;
   ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
   ```
4. Apply migration using Supabase service client (NO multi-statement DO blocks)
5. Verify columns added: Query `information_schema.columns` for both tables
6. Run `npm run generate:types` to regenerate TypeScript types

**Dependencies**: None
**Estimated Time**: 30 minutes

---

### T002: Create Supabase Storage buckets

**Type**: Infrastructure
**Files**:
- Supabase Dashboard OR `scripts/create-storage-buckets.ts` (if scripted)

**Description**:
Create two public storage buckets for template and task images with appropriate configuration.

**CODEX Suitability**: ❌ REQUIRES Claude Code with Supabase dashboard/API access. Must create buckets and verify via live Supabase instance.

**Implementation Steps**:
1. Via Supabase Dashboard Storage section OR programmatically:
   ```typescript
   // Bucket 1: task-template-images
   {
     name: 'task-template-images',
     public: true,
     fileSizeLimit: 104857600, // 100MB
     allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
   }

   // Bucket 2: task-images
   {
     name: 'task-images',
     public: true,
     fileSizeLimit: 104857600,
     allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
   }
   ```
2. Verify buckets exist via dashboard or `supabase.storage.listBuckets()`

**Dependencies**: None
**Estimated Time**: 15 minutes

---

### T003: Apply RLS policies to storage buckets

**Type**: Security
**Files**:
- `supabase/migrations/20251019_storage_rls_policies.sql` OR apply via dashboard

**Description**:
Create RLS policies on `storage.objects` table to enforce tenant isolation for image uploads, updates, and deletes.

**CODEX Suitability**: ❌ REQUIRES Claude Code with Supabase MCP access. Must execute SQL policies and verify via live database/dashboard.

**Implementation Steps**:
1. Create policies for `task-template-images` bucket:
   ```sql
   -- INSERT: Authenticated users can upload to their tenant folder
   CREATE POLICY "Users can upload template images in their tenant"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'task-template-images' AND
     (storage.foldername(name))[1] = (
       current_setting('request.jwt.claims', true)::json
       -> 'app_metadata' ->> 'tenant_id'
     )
   );

   -- SELECT: Public can view (bucket is public)
   CREATE POLICY "Public can view template images"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'task-template-images');

   -- UPDATE: Users can update their tenant's images
   CREATE POLICY "Users can update template images in their tenant"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'task-template-images' AND
     (storage.foldername(name))[1] = (
       current_setting('request.jwt.claims', true)::json
       -> 'app_metadata' ->> 'tenant_id'
     )
   );

   -- DELETE: Users can delete their tenant's images
   CREATE POLICY "Users can delete template images in their tenant"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'task-template-images' AND
     (storage.foldername(name))[1] = (
       current_setting('request.jwt.claims', true)::json
       -> 'app_metadata' ->> 'tenant_id'
     )
   );
   ```
2. Repeat same pattern for `task-images` bucket (substitute bucket_id)
3. Verify policies via Supabase dashboard

**Dependencies**: T002 (buckets must exist)
**Estimated Time**: 30 minutes

---

## Phase 3.2: Domain Layer (Repositories & Services)

### T004 [P][CODEX]: Update TaskTemplateRepository with image methods

**Type**: Repository
**Files**:
- `src/domains/task-template/repositories/TaskTemplateRepository.ts`
- `src/domains/task-template/types/task-template-types.ts`

**Description**:
Add methods to handle image URL updates in TaskTemplateRepository. Update types to include new image fields.

**CODEX Suitability**: ✅ Pure TypeScript code generation, no database access required. Can reference generated types from docs/database/guides/agent-quickstart.md.

**Implementation Steps**:
1. Update `task-template-types.ts`:
   ```typescript
   // Add to TaskTemplate interface
   export interface TaskTemplate {
     // ... existing fields
     thumbnail_url: string | null;
     medium_url: string | null;
     primary_image_url: string | null;
   }

   // Add to TaskTemplateInsert and TaskTemplateUpdate
   ```

2. Add method to `TaskTemplateRepository.ts`:
   ```typescript
   async updateImageUrls(
     templateId: string,
     imageUrls: {
       thumbnail_url: string | null;
       medium_url: string | null;
       primary_image_url: string | null;
     }
   ): Promise<Result<TaskTemplate, RepositoryError>> {
     const { data, error } = await this.client
       .from('task_templates')
       .update(imageUrls)
       .eq('id', templateId)
       .select()
       .single();

     // Handle result...
   }
   ```

3. Add Agent Directive Block at top of file
4. Maintain complexity budget (< 300 lines)

**Dependencies**: T001 (migration applied, types regenerated)
**Estimated Time**: 45 minutes

---

### T005 [P][CODEX]: Update WorkflowTaskRepository with image methods

**Type**: Repository
**Files**:
- `src/domains/workflow-task/repositories/WorkflowTaskRepository.ts`
- `src/domains/workflow-task/types/workflow-task-types.ts`

**Description**:
Add methods to handle image URL updates in WorkflowTaskRepository. Update types to include new image fields.

**CODEX Suitability**: ✅ Pure TypeScript code generation, no database access required. Can reference generated types from docs/database/guides/agent-quickstart.md.

**Implementation Steps**:
1. Update `workflow-task-types.ts`:
   ```typescript
   export interface WorkflowTask {
     // ... existing fields
     thumbnail_url: string | null;
     medium_url: string | null;
     primary_image_url: string | null;
   }
   ```

2. Add `updateImageUrls` method (same pattern as T004)
3. Add Agent Directive Block
4. Ensure type safety with generated Database types

**Dependencies**: T001 (migration applied)
**Estimated Time**: 45 minutes

---

### T006 [P][CODEX]: Create storage helper utilities

**Type**: Utility
**Files**:
- `src/lib/supabase/storage.ts` (create new OR update existing)

**Description**:
Create reusable helper functions for uploading images to Supabase Storage with tenant-isolated paths.

**CODEX Suitability**: ✅ Pure TypeScript utility code, no database queries required. Uses Supabase client API patterns from existing code.

**Implementation Steps**:
1. Create `storage.ts` with helper functions:
   ```typescript
   /**
    * Upload processed images to Supabase Storage
    */
   export async function uploadImagesToStorage(
     supabaseClient: SupabaseClient,
     bucketName: string,
     entityId: string,
     tenantId: string,
     processedImages: ProcessedImages
   ): Promise<{ thumbnail_url: string; medium_url: string; primary_image_url: string }> {
     const timestamp = Date.now();
     const paths = {
       thumbnail: `${tenantId}/${entityId}/thumbnail-${timestamp}.jpg`,
       medium: `${tenantId}/${entityId}/medium-${timestamp}.jpg`,
       full: `${tenantId}/${entityId}/full-${timestamp}.jpg`,
     };

     // Upload each size
     // Convert base64 to Blob
     // Return public URLs
   }

   /**
    * Delete image files from storage (soft delete - keep files, clear DB URLs)
    */
   export async function deleteImagesFromStorage(
     supabaseClient: SupabaseClient,
     bucketName: string,
     paths: string[]
   ): Promise<void> {
     // Optional: implement hard delete if needed
   }
   ```

2. Add Agent Directive Block
3. Include error handling for upload failures

**Dependencies**: T002 (buckets exist)
**Estimated Time**: 1 hour

---

### T007: Update TaskTemplateService with image upload logic

**Type**: Service
**Files**:
- `src/domains/task-template/services/TaskTemplateService.ts`

**Description**:
Add service method to orchestrate image processing and storage upload for templates.

**Implementation Steps**:
1. Add `uploadTemplateImage` method:
   ```typescript
   async uploadTemplateImage(
     templateId: string,
     processedImages: ProcessedImages
   ): Promise<Result<TaskTemplate, ServiceError>> {
     // 1. Get template to verify existence and tenant
     // 2. Upload images to storage via helper
     // 3. Update template with image URLs via repository
     // 4. Return updated template
   }
   ```

2. Handle errors (storage upload fails, DB update fails)
3. Use existing `ProcessedImages` type from `image-processor.ts`

**Dependencies**: T004, T006
**Estimated Time**: 1 hour

---

### T008: Update WorkflowTaskService with image upload logic

**Type**: Service
**Files**:
- `src/domains/workflow-task/services/WorkflowTaskService.ts`

**Description**:
Add service method to orchestrate image processing and storage upload for workflow tasks.

**Implementation Steps**:
1. Add `uploadTaskImage` method (same pattern as T007)
2. Handle task-specific logic (verify task exists, check permissions)

**Dependencies**: T005, T006
**Estimated Time**: 1 hour

---

## Phase 3.3: API Layer

### T009 [P][CODEX]: Create POST /api/task-templates/[id]/image endpoint

**Type**: API Route
**Files**:
- `src/app/api/task-templates/[id]/image/route.ts` (NEW)

**Description**:
Create API endpoint for uploading template images. Accepts base64 processed images, uploads to storage, updates database.

**CODEX Suitability**: ✅ Next.js API route creation, no database verification needed. Can follow existing API route patterns.

**Implementation Steps**:
1. Create route file with POST handler:
   ```typescript
   export async function POST(
     request: NextRequest,
     { params }: { params: { id: string } }
   ) {
     // 1. Get request context (tenant, role)
     // 2. Verify supervisor role
     // 3. Parse request body (processedImages)
     // 4. Call TaskTemplateService.uploadTemplateImage()
     // 5. Return image URLs
   }
   ```

2. Add dynamic and runtime exports:
   ```typescript
   export const dynamic = 'force-dynamic';
   export const runtime = 'nodejs';
   ```

3. Error handling (403 for non-supervisor, 404 for template not found, 400 for invalid images)
4. Add Agent Directive Block

**Dependencies**: T007 (service method exists)
**Estimated Time**: 1 hour

---

### T010 [P][CODEX]: Create POST /api/workflow-tasks/[id]/image endpoint

**Type**: API Route
**Files**:
- `src/app/api/workflow-tasks/[id]/image/route.ts` (NEW)

**Description**:
Create API endpoint for uploading task images. Same pattern as template endpoint.

**CODEX Suitability**: ✅ Next.js API route creation, mirrors T009 pattern. No database verification needed.

**Implementation Steps**:
1. Create route file (same structure as T009)
2. Call WorkflowTaskService.uploadTaskImage()
3. Verify task exists and user has permission

**Dependencies**: T008 (service method exists)
**Estimated Time**: 1 hour

---

### T011: Update GET endpoints to return image URLs

**Type**: API Route Update
**Files**:
- `src/app/api/task-templates/route.ts`
- `src/app/api/task-templates/[id]/route.ts`

**Description**:
Ensure existing GET endpoints include the new image URL fields in responses.

**Implementation Steps**:
1. Verify `select('*')` queries include new columns (should be automatic)
2. Test response includes `thumbnail_url`, `medium_url`, `primary_image_url`
3. Update any explicit field lists to include image URLs

**Dependencies**: T001 (columns exist), T004 (types updated)
**Estimated Time**: 30 minutes

---

## Phase 3.4: UI Components

### T012 [P][CODEX]: Create reusable TaskImageUpload component

**Type**: Component
**Files**:
- `src/components/tasks/TaskImageUpload.tsx` (NEW)

**Description**:
Create reusable image upload component based on `ItemImageUpload` pattern. Handles camera capture and file upload.

**CODEX Suitability**: ✅ Pure React component code. Can copy and adapt from existing ItemImageUpload component pattern.

**Implementation Steps**:
1. Copy `ItemImageUpload.tsx` as template
2. Generalize to accept props:
   ```typescript
   interface TaskImageUploadProps {
     onImageCapture: (images: ProcessedImages) => void;
     currentImageUrl?: string;
     disabled?: boolean;
   }
   ```
3. Keep camera/upload logic unchanged (already generic)
4. Use `ImageProcessor` utility for three-size generation
5. Add Agent Directive Block
6. Maintain < 300 line complexity budget

**Dependencies**: None (uses existing ImageProcessor)
**Estimated Time**: 1.5 hours

---

### T013: Update TaskItem component to show thumbnails

**Type**: Component Update
**Files**:
- `src/components/tasks/TaskItem.tsx`

**Description**:
Add thumbnail image display to existing TaskItem card component.

**Implementation Steps**:
1. Add thumbnail display in card layout:
   ```tsx
   {task.thumbnail_url && (
     <img
       src={task.thumbnail_url}
       alt={task.task_description}
       className="w-16 h-16 rounded object-cover"
     />
   )}
   ```
2. Handle NULL case (show placeholder icon or no image)
3. Position alongside existing status icon
4. Mobile-responsive (fits in 375px width)

**Dependencies**: T005 (types include image URLs)
**Estimated Time**: 45 minutes

---

### T014: Create Task Detail page

**Type**: Page (NEW)
**Files**:
- `src/app/(authenticated)/supervisor/tasks/[id]/page.tsx` (NEW)

**Description**:
Create new Task Detail page following item detail page pattern. Shows task information with image display and upload capability.

**Implementation Steps**:
1. Create page file with structure:
   ```tsx
   'use client';

   export default function TaskDetailPage() {
     // Load task data from API
     // Display task details (main content area)
     // Display/upload image (sidebar)
     // Use TaskImageUpload component
   }
   ```

2. Layout: Grid (2/3 main content, 1/3 sidebar for image)
3. Responsive: Stack on mobile
4. Image section:
   - Show medium image if exists
   - Show upload interface if edit mode
   - Use TaskImageUpload component
5. Add navigation breadcrumb
6. Add Agent Directive Block

**Dependencies**: T012 (upload component), T010 (API endpoint)
**Estimated Time**: 2 hours

---

### T015: Update template edit page with image upload

**Type**: Page Update
**Files**:
- `src/app/(authenticated)/supervisor/templates/[id]/edit/page.tsx`

**Description**:
Add image upload section to existing template edit page.

**Implementation Steps**:
1. Add state for image upload:
   ```tsx
   const [uploadingImage, setUploadingImage] = useState(false);
   ```

2. Add image section in form:
   ```tsx
   <div className="form-section">
     <h2>Template Image</h2>
     {template.medium_url ? (
       <img src={template.medium_url} />
     ) : (
       <button onClick={() => setUploadingImage(true)}>Add Image</button>
     )}
     {uploadingImage && (
       <TaskImageUpload
         onImageCapture={handleImageUpload}
         currentImageUrl={template.medium_url}
       />
     )}
   </div>
   ```

3. Implement `handleImageUpload`:
   - Call `POST /api/task-templates/[id]/image`
   - Reload template data
   - Close upload interface

**Dependencies**: T012 (upload component), T009 (API endpoint)
**Estimated Time**: 1.5 hours

---

### T016: Update template list page to show thumbnails

**Type**: Page Update
**Files**:
- `src/app/(authenticated)/supervisor/templates/page.tsx`

**Description**:
Display thumbnail images on template cards in list view.

**Implementation Steps**:
1. Add thumbnail to template card rendering:
   ```tsx
   {template.thumbnail_url && (
     <img
       src={template.thumbnail_url}
       alt={template.name}
       className="w-20 h-20 rounded object-cover mb-2"
     />
   )}
   ```

2. Layout: Position above template name
3. Handle NULL (no image) gracefully
4. Lazy load images for performance

**Dependencies**: T011 (API returns image URLs)
**Estimated Time**: 45 minutes

---

### T017: Update task creation to inherit template images

**Type**: Service Update
**Files**:
- `src/domains/task-template/services/TaskTemplateService.ts` (method: `createTasksFromTemplate`)

**Description**:
Modify task creation logic to copy image URLs from template to new tasks.

**Implementation Steps**:
1. Find `createTasksFromTemplate` method
2. When creating workflow_task records, include:
   ```typescript
   const taskData = {
     // ... existing fields
     thumbnail_url: templateItem.thumbnail_url,
     medium_url: templateItem.medium_url,
     primary_image_url: templateItem.primary_image_url,
   };
   ```

3. Verify template image URLs are passed through
4. No automatic updates (snapshot approach)

**Dependencies**: T001 (columns exist), T005 (repository updated)
**Estimated Time**: 30 minutes

---

## Phase 3.5: Testing

### T018 [P][CODEX]: Integration test for template image upload

**Type**: Integration Test
**Files**:
- `tests/integration/task-templates/image-upload.int.test.ts` (NEW)

**Description**:
Write integration test for template image upload flow.

**CODEX Suitability**: ✅ Test file creation using Vitest patterns. No live database queries needed in test code itself.

**Implementation Steps**:
1. Create test file:
   ```typescript
   describe('Template Image Upload', () => {
     it('should upload template image and return URLs', async () => {
       // Create test template
       // Generate test images via ImageProcessor
       // POST to /api/task-templates/{id}/image
       // Assert 200 response
       // Assert image URLs returned
       // Assert storage files exist
       // Assert database updated
     });

     it('should reject non-supervisor upload', async () => {
       // Auth as worker
       // Attempt upload
       // Assert 403
     });

     it('should handle invalid image data', async () => {
       // POST with malformed data
       // Assert 400
     });
   });
   ```

2. Use test fixtures for image data
3. Clean up test data after each test

**Dependencies**: T009 (API endpoint exists)
**Estimated Time**: 2 hours

---

### T019 [P][CODEX]: Integration test for task image upload

**Type**: Integration Test
**Files**:
- `tests/integration/workflow-tasks/image-upload.int.test.ts` (NEW)

**Description**:
Write integration test for task image upload flow (same pattern as T018).

**CODEX Suitability**: ✅ Test file creation, mirrors T018 pattern. No live database queries needed in test code itself.

**Implementation Steps**:
1. Create test file with similar structure
2. Test task-specific scenarios
3. Verify image inheritance from template

**Dependencies**: T010 (API endpoint exists)
**Estimated Time**: 2 hours

---

### T020: Manual testing via quickstart.md

**Type**: Manual Testing
**Files**:
- `specs/013-lets-plan-to/quickstart.md` (reference)

**Description**:
Execute all 8 test scenarios from quickstart.md to validate end-to-end functionality.

**Implementation Steps**:
1. Execute Scenario 1: Add Image to Template
2. Execute Scenario 2: Add Image to Task
3. Execute Scenario 3: Image Inheritance
4. Execute Scenario 4: Image Replacement
5. Execute Scenario 5: Image Removal
6. Execute Scenario 6: Permission Validation
7. Execute Scenario 7: Error Handling
8. Execute Scenario 8: Cross-Tenant Isolation
9. Document any issues found
10. Verify performance metrics (< 5s processing, < 500ms thumbnails)

**Dependencies**: ALL previous tasks complete
**Estimated Time**: 3 hours

---

## Dependencies Graph

```
Setup (T001-T003)
  ↓
Repository Layer (T004, T005) [P] ←──┐
  ↓                                   │
Storage Helper (T006)                │
  ↓                                   │
Service Layer (T007, T008)           │
  ↓                                   │
API Layer (T009, T010) [P]           │
  ↓                                   │
API Updates (T011)                   │
  ↓                                   │
Components (T012) [P] ───────────────┘
  ↓
UI Pages (T013, T014, T015, T016) [P-ish]
  ↓
Task Creation Update (T017)
  ↓
Integration Tests (T018, T019) [P]
  ↓
Manual Testing (T020)
```

**Key Parallel Blocks**:
- T004 & T005 (different repositories)
- T009 & T010 (different API routes)
- T018 & T019 (different test files)

**Sequential Dependencies**:
- Migration (T001) → Types/Repos (T004-T005)
- Repos → Services → API
- API → Components → Pages
- Everything → Tests

---

## Parallel Execution Examples

### Example 1: Repository Layer (after T001-T003)
```bash
# Launch T004 and T005 in parallel:
Task: "Update TaskTemplateRepository in src/domains/task-template/repositories/TaskTemplateRepository.ts with updateImageUrls method"
Task: "Update WorkflowTaskRepository in src/domains/workflow-task/repositories/WorkflowTaskRepository.ts with updateImageUrls method"
```

### Example 2: API Routes (after T007-T008)
```bash
# Launch T009 and T010 in parallel:
Task: "Create POST /api/task-templates/[id]/image route in src/app/api/task-templates/[id]/image/route.ts"
Task: "Create POST /api/workflow-tasks/[id]/image route in src/app/api/workflow-tasks/[id]/image/route.ts"
```

### Example 3: Integration Tests (after T017)
```bash
# Launch T018 and T019 in parallel:
Task: "Write integration tests for template image upload in tests/integration/task-templates/image-upload.int.test.ts"
Task: "Write integration tests for task image upload in tests/integration/workflow-tasks/image-upload.int.test.ts"
```

---

## Validation Checklist

Before marking feature complete, verify:

**Database**:
- [ ] Columns added to task_templates (thumbnail_url, medium_url, primary_image_url)
- [ ] Columns added to workflow_tasks (same three columns)
- [ ] Buckets created (task-template-images, task-images)
- [ ] RLS policies applied (8 total: 4 per bucket)

**Code**:
- [ ] Repository methods added (updateImageUrls)
- [ ] Service methods added (uploadTemplateImage, uploadTaskImage)
- [ ] API routes created (2 new POST endpoints)
- [ ] Components created/updated (TaskImageUpload, TaskItem, Task Detail page)
- [ ] Template pages updated (edit, list)

**Tests**:
- [ ] Integration tests pass (template upload)
- [ ] Integration tests pass (task upload)
- [ ] Manual tests complete (all 8 scenarios)
- [ ] Performance metrics met

**Functionality**:
- [ ] Supervisors can upload images to templates
- [ ] Supervisors can upload images to tasks
- [ ] Thumbnails display on list pages
- [ ] Medium images display on detail pages
- [ ] Tasks inherit template images on creation
- [ ] Images update independently after creation
- [ ] Tenant isolation enforced
- [ ] Non-supervisors cannot upload

---

## Estimated Total Time

**Setup**: 1.25 hours (T001-T003)
**Domain Layer**: 4.75 hours (T004-T008)
**API Layer**: 2.5 hours (T009-T011)
**UI Layer**: 6.25 hours (T012-T017)
**Testing**: 7 hours (T018-T020)

**Total**: ~21.75 hours (~3 days of development)

---

## Notes

- **TDD Compliance**: Tasks ordered tests-before-implementation where applicable (T018-T019 validate T009-T010)
- **Constitutional Compliance**: All tasks follow RLS patterns, tenant isolation, complexity budgets
- **Parallel Safety**: [P] tasks modify different files with no shared state
- **Backward Compatibility**: All changes additive (nullable columns, no breaking changes)
- **Rollback Plan**: Migration includes DROP COLUMN statements if needed (see data-model.md)

---

## CODEX Assignment Criteria

### What CODEX Can Do

**Pure Code Generation Tasks**:
- ✅ TypeScript/JavaScript file creation and updates
- ✅ React component development
- ✅ Next.js API route creation
- ✅ Test file creation (Vitest, Jest)
- ✅ Type definition updates
- ✅ Service/repository method implementations

**Key Requirement**: Task must not require direct database access, schema verification, or live system interaction.

**Documentation Available to CODEX**:
- `docs/database/guides/agent-quickstart.md` - Complete schema reference
- Existing codebase patterns (ItemImageUpload, API routes, repositories)
- Generated TypeScript types (after migration applied)

### What CODEX Cannot Do

**Database Operations**:
- ❌ Schema verification via live database queries
- ❌ SQL migration execution and validation
- ❌ RLS policy application and testing
- ❌ Direct Supabase MCP queries

**Infrastructure Operations**:
- ❌ Supabase Storage bucket creation
- ❌ Dashboard configuration changes
- ❌ Environment verification

**Live System Testing**:
- ❌ Manual browser testing
- ❌ End-to-end workflow validation
- ❌ Performance metric measurement

### Assignment Decision Tree

```
Does task require querying live database?
├─ YES → Claude Code (has Supabase MCP)
└─ NO
   └─ Does task require Supabase dashboard access?
      ├─ YES → Claude Code
      └─ NO
         └─ Is task pure code generation?
            ├─ YES → CODEX ✅
            └─ NO → Evaluate case-by-case
```

### Example CODEX Task Prompt

When assigning to CODEX, provide:

1. **Task ID and Description**: "T004: Update TaskTemplateRepository with updateImageUrls method"
2. **Context Files to Read**:
   - `docs/database/guides/agent-quickstart.md` (schema reference)
   - `src/domains/task-template/repositories/TaskTemplateRepository.ts` (existing file)
   - `src/components/items/ItemImageUpload.tsx` (pattern reference)
3. **Specification Reference**: `specs/013-lets-plan-to/tasks.md` (this file)
4. **Success Criteria**: From task definition in this file
5. **Constitutional Requirements**: Complexity budget, Agent Directive Block, error handling

### CODEX Workflow Example

**Phase 3.2 After Migration (T001 complete)**:

```bash
# Assign to CODEX in parallel:
Task T004: Update TaskTemplateRepository
Task T005: Update WorkflowTaskRepository
Task T006: Create storage helper utilities

# Wait for CODEX completion, then Claude Code continues with:
Task T007: Update TaskTemplateService (sequential)
Task T008: Update WorkflowTaskService (sequential)
```

**Expected Output from CODEX**:
- All specified files created/updated
- Agent Directive Blocks added
- Type safety maintained
- Complexity budgets respected
- No direct database queries in code

---

*Generated: 2025-10-19*
*Updated with CODEX assignments: 2025-10-19*
*Feature: 013-lets-plan-to*
*Ready for execution ✅*
