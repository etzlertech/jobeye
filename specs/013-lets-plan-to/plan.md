# Implementation Plan: Template and Task Image Management

**Branch**: `013-lets-plan-to` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-lets-plan-to/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ DONE: Spec loaded and analyzed
2. Fill Technical Context
   → ✅ DONE: Next.js 14.2.0, TypeScript, Supabase multi-tenant
3. Fill the Constitution Check section
   → ✅ DONE: RLS policies required, multi-tenant isolation confirmed
4. Evaluate Constitution Check section
   → ✅ PASS: No violations, follows constitutional principles
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → IN PROGRESS
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → PENDING
7. Re-evaluate Constitution Check section
   → PENDING
8. Plan Phase 2 → Describe task generation approach
   → PENDING
9. STOP - Ready for /tasks command
   → PENDING
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

This feature adds comprehensive image support to task templates and workflow tasks, enabling supervisors to attach visual references to templates and individual tasks. Images are stored in three optimized sizes (thumbnail ~150px, medium ~800px, full ~2048px) using Supabase Storage with automatic processing via the existing `ImageProcessor` utility. The feature includes:

1. **Database schema updates** to add `thumbnail_url`, `medium_url`, and `primary_image_url` columns to `task_templates` and `workflow_tasks` tables
2. **Template UI enhancements** to display thumbnails on cards and medium images on detail pages
3. **New Task Detail page** following existing detail page patterns (similar to item details, template details)
4. **Unified image upload component** reusing the existing `ItemImageUpload` pattern for camera capture and file upload
5. **Image inheritance** from templates to tasks with independent update capability
6. **Storage bucket setup** (`task-template-images` and `task-images`) with proper RLS policies

**Technical Approach:**
- Leverage existing `@/utils/image-processor` for three-size image generation
- Reuse `ItemImageUpload` component pattern for consistent UX
- Add Supabase Storage buckets with tenant-isolated paths
- Update existing repositories (`TaskTemplateRepository`, `WorkflowTaskRepository`)
- Follow constitutional RLS and multi-tenant patterns

## Technical Context

**Language/Version**: TypeScript 5.4, Next.js 14.2.0
**Primary Dependencies**: React 18.3, Supabase JS 2.43, Lucide React (icons), Next.js Image
**Storage**: Supabase PostgreSQL (multi-tenant with RLS), Supabase Storage (image buckets)
**Testing**: Jest 29.7 (unit), Playwright (E2E), manual testing for image upload/capture
**Target Platform**: Web (mobile-first responsive design, 375x812px primary viewport)
**Project Type**: Web (Next.js app with API routes)
**Performance Goals**:
- Image upload processing < 5 seconds
- Thumbnail load < 500ms
- Medium image load < 1.5 seconds
- Camera capture start < 1 second
**Constraints**:
- Mobile-first UI (375px width)
- RLS policies mandatory on all tables
- Tenant isolation required for all operations
- Image storage within Supabase bucket limits (100MB per file)
- Offline-capable PWA considerations
**Scale/Scope**:
- ~3 database tables modified (task_templates, task_template_items if needed, workflow_tasks)
- ~2 new storage buckets
- ~1 new page (Task Detail)
- ~5-8 component updates
- ~10-15 implementation tasks

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Database Architecture Compliance

**Multi-Tenant Isolation:**
- ✅ All tables (`task_templates`, `workflow_tasks`) already have `tenant_id` columns
- ✅ RLS policies exist and use app_metadata path: `(current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')`
- ✅ New storage buckets will implement tenant-isolated paths: `{tenant_id}/{template_id}/...`

**RLS Policy Pattern:**
```sql
-- Existing pattern on task_templates (will remain)
CREATE POLICY "tenant_isolation" ON task_templates
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

**Storage RLS Policies (to be created):**
```sql
-- task-template-images bucket
CREATE POLICY "Authenticated users can upload template images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-template-images' AND
  (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
);

-- Similar policies for task-images bucket
```

### ✅ Vision Pipeline Architecture Compliance

**Current State:** VLM First (this feature does not use vision AI)
- ✅ No AI vision processing required for this feature
- ✅ Images are user-uploaded, not AI-analyzed
- ✅ Future YOLO integration not applicable

### ✅ Voice-First UX Compliance

**Progressive Web App:**
- ✅ PWA manifest already exists
- ✅ Service worker present for offline support
- ✅ IndexedDB caching strategy in place

**Offline Capability:**
- ⚠️ Image upload requires online connectivity (unavoidable for Supabase Storage)
- ✅ Image viewing works offline after initial load (cached)
- ✅ UI degrades gracefully when offline

### ✅ Cost & Model Governance Compliance

**No AI Costs:**
- ✅ This feature uses local image processing only (`imageProcessor` utility)
- ✅ No VLM/LLM API calls
- ✅ No cost tracking required for image operations

**Storage Costs:**
- ✅ Supabase Storage included in plan (100MB limit per file is sufficient)
- ⚠️ Monitor total storage usage across all tenants

### ✅ Development Standards Compliance

**Agent Directive Blocks:**
- ✅ All new files will include proper directive blocks
- ✅ Complexity budget: 300 lines default, 500 max

**Testing Requirements:**
- ✅ Unit tests: ≥80% coverage for new repositories/services
- ✅ Integration tests: Image upload, RLS isolation
- ✅ E2E tests: Camera capture, file upload flows
- ✅ Manual tests: Multi-browser image handling

**Pre-Commit Gates:**
- ✅ TypeScript compilation
- ✅ ESLint checks
- ✅ Directive validation
- ✅ Complexity checks
- ✅ Test coverage (≥80%)

### ✅ Architectural Invariants Compliance

1. ✅ **No Direct Database Access**: All operations through `TaskTemplateRepository` and `WorkflowTaskRepository`
2. ✅ **No Synchronous AI Calls**: No AI used in this feature
3. ✅ **No Untracked Costs**: No AI costs to track
4. ✅ **No Silent Failures**: All errors logged and surfaced to UI
5. ✅ **No Stateless Voice**: Not applicable (no voice interactions)

### ✅ Performance Baselines Compliance

- ✅ Page Load: Task Detail page < 3s on 3G (minimal data load)
- ✅ Voice Response: Not applicable
- ✅ Vision Processing: Not applicable (user upload only)
- ✅ Offline Sync: < 10s when connection restored
- ✅ Battery Impact: Minimal (local image processing only)

### ✅ Rule 1: Actual DB Precheck (MANDATORY)

**Pre-Migration Checklist:**
- ✅ Will run `npm run check:db-actual` before any migration
- ✅ Will inspect actual schema via Supabase MCP
- ✅ Will use idempotent SQL statements (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
- ✅ Will apply migrations one statement at a time
- ✅ Will NOT use multi-statement DO blocks

### ✅ Rule 2: Push After Commit (MANDATORY)

**Post-Commit Checklist:**
- ✅ Will push immediately after each commit
- ✅ Will verify push status and report to user
- ✅ Will request credentials if push fails

**GATE STATUS:** ✅ PASS - No constitutional violations, ready to proceed

## Project Structure

### Documentation (this feature)
```
specs/013-lets-plan-to/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── task-templates-api.yaml
│   ├── workflow-tasks-api.yaml
│   └── storage-api.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── app/
│   ├── (authenticated)/
│   │   └── supervisor/
│   │       ├── templates/
│   │       │   ├── [id]/
│   │       │   │   └── edit/page.tsx                    # UPDATE: Add image upload
│   │       │   ├── create/page.tsx                      # UPDATE: Add image upload
│   │       │   └── page.tsx                             # UPDATE: Show thumbnails
│   │       └── tasks/
│   │           ├── [id]/
│   │           │   └── page.tsx                         # NEW: Task Detail page
│   │           └── page.tsx                             # UPDATE: Show thumbnails (if exists)
│   └── api/
│       ├── task-templates/
│       │   ├── [id]/
│       │   │   ├── image/route.ts                       # NEW: Template image upload
│       │   │   └── route.ts                             # UPDATE: Return image URLs
│       │   └── route.ts                                 # UPDATE: Return image URLs
│       └── workflow-tasks/
│           └── [id]/
│               └── image/route.ts                       # NEW: Task image upload
├── components/
│   ├── tasks/
│   │   ├── TaskItem.tsx                                 # UPDATE: Show thumbnail
│   │   └── TaskImageUpload.tsx                          # NEW: Reusable upload component
│   └── templates/
│       ├── TemplateCard.tsx                             # NEW or UPDATE: Show thumbnail
│       └── TemplateImageUpload.tsx                      # NEW: Template-specific upload
├── domains/
│   ├── task-template/
│   │   ├── repositories/TaskTemplateRepository.ts       # UPDATE: Image CRUD methods
│   │   ├── services/TaskTemplateService.ts              # UPDATE: Image upload logic
│   │   └── types/task-template-types.ts                 # UPDATE: Add image URL fields
│   └── workflow-task/
│       ├── repositories/WorkflowTaskRepository.ts       # UPDATE: Image CRUD methods
│       ├── services/WorkflowTaskService.ts              # UPDATE: Image upload logic
│       └── types/workflow-task-types.ts                 # UPDATE: Add image URL fields
├── lib/
│   └── supabase/
│       └── storage.ts                                   # NEW or UPDATE: Storage helpers
└── utils/
    └── image-processor.ts                               # EXISTING: Use for processing

tests/
├── integration/
│   ├── task-templates/
│   │   └── image-upload.int.test.ts                     # NEW: Integration tests
│   └── workflow-tasks/
│       └── image-upload.int.test.ts                     # NEW: Integration tests
└── unit/
    ├── repositories/
    │   ├── TaskTemplateRepository.test.ts               # UPDATE: Image methods
    │   └── WorkflowTaskRepository.test.ts               # UPDATE: Image methods
    └── services/
        ├── TaskTemplateService.test.ts                  # UPDATE: Image upload
        └── WorkflowTaskService.test.ts                  # UPDATE: Image upload

supabase/
└── migrations/
    └── YYYYMMDDHHMMSS_add_images_to_templates_and_tasks.sql  # NEW: Migration
```

**Structure Decision**: This is a web application (Next.js) with frontend components in `src/app` and `src/components`, backend API routes in `src/app/api`, and domain logic in `src/domains`. The structure follows Next.js 14 app router conventions with domain-driven design for business logic.

## Phase 0: Outline & Research
*Creates research.md with all unknowns resolved*

### Research Tasks

1. **Existing Image Infrastructure**
   - ✅ Investigate `@/utils/image-processor` capabilities
   - ✅ Review `ItemImageUpload` component implementation
   - ✅ Examine `items` table schema for image URL patterns
   - ✅ Check existing storage buckets (item-images, profile-images, property-images)
   - Decision: Reuse existing patterns, proven and working

2. **Database Schema Investigation**
   - Task: Query live database via Supabase MCP for `task_templates` and `workflow_tasks` schemas
   - Understand: Current column structure, constraints, indexes
   - Verify: RLS policies in place, tenant_id presence
   - Output: Document in research.md

3. **Component Reusability**
   - ✅ Analyze `ItemImageUpload` for reusability
   - ✅ Check if generalization needed or direct reuse
   - Decision: Create shared base component if differences are minimal

4. **Storage Bucket Strategy**
   - Research: Supabase Storage bucket naming conventions in project
   - Decide: Single bucket vs. separate buckets for templates/tasks
   - Pattern: Existing buckets use `{entity}-images` format
   - Decision: `task-template-images` and `task-images` buckets

5. **Image Inheritance Pattern**
   - Research: How tasks are created from templates (existing code)
   - Design: When/how to copy image URLs from template to task
   - Edge case: Template image updated after tasks created
   - Decision: Copy URLs on task creation, no automatic updates

6. **Existing Detail Page Patterns**
   - ✅ Review `/app/demo-items/[itemId]/page.tsx` for detail page structure
   - Extract: Common patterns (image display, upload UI, responsive design)
   - Apply: Same patterns to Task Detail page

**Output**: `research.md` with all findings documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

### 1. Data Model Design → `data-model.md`

**Entities (Modified):**

#### task_templates (existing table, add columns)
```sql
-- New columns to add
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS medium_url TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Columns: id, tenant_id, name, description, job_type, is_active,
--          created_at, updated_at, created_by, updated_by,
--          thumbnail_url, medium_url, primary_image_url
```

**Fields:**
- `thumbnail_url` (text, nullable) - Small preview image (150x150px)
- `medium_url` (text, nullable) - Detail page image (800x800px)
- `primary_image_url` (text, nullable) - Full resolution image (2048x2048px)

**Validation Rules:**
- All three image URLs are optional
- URLs must be valid Supabase Storage URLs if provided
- URLs should match pattern: `https://{project}.supabase.co/storage/v1/object/public/task-template-images/{tenant_id}/{template_id}/...`

#### workflow_tasks (existing table, add columns)
```sql
-- New columns to add
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS medium_url TEXT;
ALTER TABLE workflow_tasks ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Columns: id, tenant_id, job_id, task_description, task_order, status,
--          is_required, requires_photo_verification, requires_supervisor_approval,
--          acceptance_criteria, completed_at, completed_by, verified_at, verified_by,
--          supervisor_approved, supervisor_notes, verification_photo_url,
--          ai_confidence, created_at, updated_at,
--          thumbnail_url, medium_url, primary_image_url
```

**Fields:**
- Same as task_templates (thumbnail_url, medium_url, primary_image_url)

**State Transitions:**
- Image URLs can be set/updated at any point in task lifecycle
- Image URLs are independent of task status
- Images persist through task completion/deletion (soft delete recommended)

**Storage Entities:**

#### task-template-images (new storage bucket)
```yaml
bucket_name: task-template-images
public: true
file_size_limit: 100MB
allowed_mime_types:
  - image/jpeg
  - image/jpg
  - image/png
  - image/gif
  - image/webp
path_structure: "{tenant_id}/{template_id}/{timestamp}-{filename}"
```

#### task-images (new storage bucket)
```yaml
bucket_name: task-images
public: true
file_size_limit: 100MB
allowed_mime_types:
  - image/jpeg
  - image/jpg
  - image/png
  - image/gif
  - image/webp
path_structure: "{tenant_id}/{task_id}/{timestamp}-{filename}"
```

### 2. API Contracts → `/contracts/`

**File: task-templates-api.yaml**
```yaml
openapi: 3.0.0
paths:
  /api/task-templates/{id}/image:
    post:
      summary: Upload image for task template
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                images:
                  type: object
                  properties:
                    thumbnail:
                      type: string
                      format: base64
                    medium:
                      type: string
                      format: base64
                    full:
                      type: string
                      format: base64
              required: [images]
      responses:
        '200':
          description: Image uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  imageUrls:
                    type: object
                    properties:
                      thumbnail_url:
                        type: string
                      medium_url:
                        type: string
                      primary_image_url:
                        type: string
        '400':
          description: Invalid request
        '403':
          description: Forbidden (not supervisor)
        '404':
          description: Template not found
```

**File: workflow-tasks-api.yaml** (similar structure)

**File: storage-api.yaml** (RLS policy documentation)

### 3. Contract Tests → failing tests

**File: tests/api/task-templates-image.api.test.ts**
```typescript
describe('POST /api/task-templates/:id/image', () => {
  it('should upload image and return URLs', async () => {
    // Test will fail until implementation complete
  });

  it('should reject non-supervisor users', async () => {
    // Test will fail until implementation complete
  });

  it('should validate image format', async () => {
    // Test will fail until implementation complete
  });
});
```

### 4. Integration Test Scenarios → quickstart.md

**File: quickstart.md**
```markdown
# Quick Start: Template and Task Image Management

## Prerequisites
- Supabase project running
- Test user with supervisor role
- Camera-enabled device or test images

## Test Scenario 1: Add Image to Template
1. Navigate to /supervisor/templates
2. Click on existing template
3. Click "Add Image" button
4. Choose "Take Photo" or "Upload Image"
5. Verify thumbnail appears on card
6. Verify medium image on detail page

## Test Scenario 2: Create Task with Image
1. Navigate to task detail page
2. Add image using same process
3. Verify independent from template

## Test Scenario 3: Image Inheritance
1. Create template with image
2. Create task from template
3. Verify task inherits image
4. Update template image
5. Verify task image unchanged
```

### 5. Update Agent File → CLAUDE.md (incremental)

**Script execution:**
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

**Content to add:**
- New storage buckets: task-template-images, task-images
- Image URL columns in task_templates and workflow_tasks
- ImageProcessor utility usage pattern
- Task Detail page location

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **Load artifacts from Phase 1:**
   - data-model.md → extract entities and schema changes
   - contracts/*.yaml → extract API endpoints
   - quickstart.md → extract test scenarios

2. **Generate migration tasks:**
   - Task: Create migration SQL file
   - Task: Add columns to task_templates
   - Task: Add columns to workflow_tasks
   - Task: Create storage buckets
   - Task: Set up RLS policies on storage
   - Mark [P] where independent

3. **Generate repository tasks:**
   - Task: Update TaskTemplateRepository with image methods
   - Task: Update WorkflowTaskRepository with image methods
   - Task: Add storage helper utilities
   - Each repository task [P]

4. **Generate API route tasks:**
   - Task: Create POST /api/task-templates/[id]/image
   - Task: Create POST /api/workflow-tasks/[id]/image
   - Task: Update existing routes to return image URLs
   - Mark [P] where independent

5. **Generate component tasks:**
   - Task: Create/update TemplateCard with thumbnail
   - Task: Create/update TaskItem with thumbnail
   - Task: Create Task Detail page
   - Task: Create TaskImageUpload component
   - Task: Update template edit page with image upload
   - Dependencies: Component → API → Repository

6. **Generate test tasks:**
   - Task: Write integration tests for image upload
   - Task: Write E2E tests for camera capture
   - Task: Write unit tests for repositories
   - Tests after implementation tasks

**Ordering Strategy**:
1. Migration tasks first (database schema)
2. Repository tasks (domain logic)
3. API route tasks (backend)
4. Component tasks (frontend)
5. Test tasks (validation)

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**Sample task structure:**
```markdown
### Task 1: Create database migration for image columns [P]
**Type:** Migration
**Files:** supabase/migrations/YYYYMMDDHHMMSS_add_images_to_templates_and_tasks.sql
**Description:** Add thumbnail_url, medium_url, primary_image_url columns to task_templates and workflow_tasks tables
**Dependencies:** None
**Estimated Time:** 30 minutes
```

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, verify image upload/display works)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations - table remains empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| - | - | - |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.1.2 - See `.specify/constitution.md`*
