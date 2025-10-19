# Data Model: Template and Task Image Management

**Feature**: 013-lets-plan-to
**Date**: 2025-10-19
**Status**: Design Complete

## Overview

This document defines the data model changes required to support image attachments on task templates and workflow tasks. The design adds three image URL columns to existing tables and introduces two new Supabase Storage buckets with appropriate RLS policies.

## Entity Modifications

### 1. task_templates (existing table)

**Purpose**: Store task template metadata including optional image references

**Schema Changes**:
```sql
-- Add image URL columns
ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
```

**Complete Schema** (after changes):
```sql
CREATE TABLE task_templates (
  -- Existing columns
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  job_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  -- New columns
  thumbnail_url TEXT,          -- 150x150px image for card display
  medium_url TEXT,             -- 800x800px image for detail page
  primary_image_url TEXT       -- 2048x2048px full resolution
);
```

**Field Specifications**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| thumbnail_url | TEXT | Yes | Public URL to 150x150px thumbnail image |
| medium_url | TEXT | Yes | Public URL to 800x800px medium image |
| primary_image_url | TEXT | Yes | Public URL to 2048x2048px full resolution image |

**Validation Rules**:
- All three columns optional (nullable)
- If set, must be valid HTTPS URLs
- Should point to Supabase Storage bucket: `task-template-images`
- URL format: `https://{project}.supabase.co/storage/v1/object/public/task-template-images/{tenant_id}/{template_id}/{size}-{timestamp}.jpg`

**Indexes**: None required (images accessed via parent template ID)

**RLS Policies**: Existing policies unchanged (tenant isolation already enforced)

---

### 2. workflow_tasks (existing table)

**Purpose**: Store individual task instances with optional image references

**Schema Changes**:
```sql
-- Add image URL columns
ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
```

**Complete Schema** (after changes):
```sql
CREATE TABLE workflow_tasks (
  -- Existing columns
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  task_description TEXT NOT NULL,
  task_order INTEGER NOT NULL,
  status TEXT NOT NULL,
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
  verification_photo_url TEXT,  -- DIFFERENT: completion verification photo
  ai_confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- New columns
  thumbnail_url TEXT,            -- 150x150px image for card display
  medium_url TEXT,               -- 800x800px image for detail page
  primary_image_url TEXT         -- 2048x2048px full resolution
);
```

**Field Specifications**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| thumbnail_url | TEXT | Yes | Public URL to 150x150px thumbnail image |
| medium_url | TEXT | Yes | Public URL to 800x800px medium image |
| primary_image_url | TEXT | Yes | Public URL to 2048x2048px full resolution image |

**Note on verification_photo_url**:
- **Purpose**: Photo taken to verify task completion (different from template image)
- **Usage**: Worker takes photo showing work completed
- **Relationship**: Independent from thumbnail/medium/primary URLs
- **Both can exist**: Task can have both a template reference image AND a completion verification photo

**Validation Rules**:
- Same as task_templates
- URL format: `https://{project}.supabase.co/storage/v1/object/public/task-images/{tenant_id}/{task_id}/{size}-{timestamp}.jpg`

**Indexes**: None required

**RLS Policies**: Existing policies unchanged

---

## Storage Entities

### 3. task-template-images (new storage bucket)

**Purpose**: Store all three sizes of images for task templates

**Configuration**:
```yaml
bucket_name: task-template-images
public: true                          # Images viewable by anyone with URL
file_size_limit: 100MB                # Per-file limit (generous for mobile photos)
allowed_mime_types:
  - image/jpeg
  - image/jpg
  - image/png
  - image/gif
  - image/webp
```

**Path Structure**:
```
task-template-images/
└── {tenant_id}/                      # Tenant isolation
    └── {template_id}/                # Template grouping
        ├── thumbnail-{timestamp}.jpg # 150x150px
        ├── medium-{timestamp}.jpg    # 800x800px
        └── full-{timestamp}.jpg      # 2048x2048px
```

**RLS Policies**:
```sql
-- Policy 1: Authenticated users can upload to their tenant folder
CREATE POLICY "Authenticated users can upload template images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-template-images' AND
  (storage.foldername(name))[1] = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);

-- Policy 2: Public can view images (bucket is public)
CREATE POLICY "Public can view template images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-template-images');

-- Policy 3: Users can update/delete their tenant's images
CREATE POLICY "Users can update/delete template images in their tenant"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-template-images' AND
  (storage.foldername(name))[1] = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);

CREATE POLICY "Users can delete template images in their tenant"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-template-images' AND
  (storage.foldername(name))[1] = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);
```

---

### 4. task-images (new storage bucket)

**Purpose**: Store all three sizes of images for workflow tasks

**Configuration**:
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
```

**Path Structure**:
```
task-images/
└── {tenant_id}/
    └── {task_id}/
        ├── thumbnail-{timestamp}.jpg
        ├── medium-{timestamp}.jpg
        └── full-{timestamp}.jpg
```

**RLS Policies**: Same pattern as task-template-images (substitute bucket_id)

```sql
CREATE POLICY "Authenticated users can upload task images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-images' AND
  (storage.foldername(name))[1] = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);

CREATE POLICY "Public can view task images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-images');

CREATE POLICY "Users can update task images in their tenant"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-images' AND
  (storage.foldername(name))[1] = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);

CREATE POLICY "Users can delete task images in their tenant"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-images' AND
  (storage.foldername(name))[1] = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata'
    ->> 'tenant_id'
  )
);
```

---

## State Machines

### Task Template Image Lifecycle

```
[No Image]
    ↓ (supervisor uploads image)
[Has Image]
    ↓ (supervisor replaces image)
[Has Image] (new URLs, old storage files remain)
    ↓ (supervisor removes image)
[No Image] (URLs cleared, storage files remain)
```

**States**:
- **No Image**: All three URL columns are NULL
- **Has Image**: All three URL columns populated

**Transitions**:
- **Upload**: NULL → {thumbnail_url, medium_url, primary_image_url}
- **Replace**: {old URLs} → {new URLs} (old storage files kept for potential rollback)
- **Remove**: {URLs} → NULL (storage files kept for potential recovery)

**Notes**:
- Storage files are never hard-deleted (soft delete via NULL URLs)
- Cleanup job can remove orphaned storage files periodically

### Workflow Task Image Lifecycle

Same as template, with additional consideration:

```
[Template Has Image]
    ↓ (create task from template)
[Task Has Image] (copied from template)
    ↓ (supervisor/worker updates task image)
[Task Has Image] (independent from template)
```

**Template Image Change**:
- Does NOT affect existing tasks
- New tasks created after change get new image
- "Snapshot" approach: tasks are point-in-time instances

---

## Relationships

### Template → Task Image Inheritance

```typescript
// When creating task from template:
interface TaskCreationData {
  // ... other fields
  thumbnail_url: template.thumbnail_url,      // Copied
  medium_url: template.medium_url,            // Copied
  primary_image_url: template.primary_image_url  // Copied
}

// After creation, task images are independent
// Template image updates do NOT cascade to tasks
```

**Rationale**: Tasks represent work assignments at a point in time. Changing their visual reference after assignment could confuse workers.

---

## Data Migration

### Forward Migration

```sql
-- Add columns to task_templates
ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Add columns to workflow_tasks
ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT;

-- Create storage buckets (via Supabase dashboard or API)
-- Apply RLS policies (see above)
```

**Impact**:
- Zero downtime (additive changes only)
- Existing records unchanged (all NULLs)
- No data migration needed
- UI handles NULL gracefully

### Rollback (if needed)

```sql
-- Remove columns from task_templates
ALTER TABLE task_templates
  DROP COLUMN IF EXISTS thumbnail_url,
  DROP COLUMN IF EXISTS medium_url,
  DROP COLUMN IF EXISTS primary_image_url;

-- Remove columns from workflow_tasks
ALTER TABLE workflow_tasks
  DROP COLUMN IF EXISTS thumbnail_url,
  DROP COLUMN IF EXISTS medium_url,
  DROP COLUMN IF EXISTS primary_image_url;

-- Delete storage buckets (manual via dashboard)
```

**Note**: Rollback loses all image data. Only use in emergency.

---

## Type Definitions

### TypeScript Interfaces

```typescript
// Shared type for image URLs
interface ImageUrls {
  thumbnail_url: string | null;
  medium_url: string | null;
  primary_image_url: string | null;
}

// Updated TaskTemplate type
interface TaskTemplate extends ImageUrls {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  job_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// Updated WorkflowTask type
interface WorkflowTask extends ImageUrls {
  id: string;
  tenant_id: string;
  job_id: string;
  task_description: string;
  task_order: number;
  status: string;
  is_required: boolean;
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  acceptance_criteria: string | null;
  completed_at: string | null;
  completed_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  supervisor_approved: boolean;
  supervisor_notes: string | null;
  verification_photo_url: string | null;  // Different from template image
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
}
```

---

## Summary

**Tables Modified**: 2 (task_templates, workflow_tasks)
**Columns Added**: 6 total (3 per table)
**Storage Buckets Created**: 2 (task-template-images, task-images)
**RLS Policies Added**: 8 (4 per bucket)

**Key Principles**:
- ✅ Tenant isolation via RLS
- ✅ Nullable columns for backward compatibility
- ✅ Three image sizes for performance optimization
- ✅ Public bucket with authenticated upload
- ✅ Snapshot approach for template→task inheritance

**Next**: Generate API contracts and integration tests

---

*Last Updated: 2025-10-19*
*Feature: 013-lets-plan-to*
