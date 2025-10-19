-- Migration: Add RLS policies for task-template-images and task-images storage buckets
-- Date: 2025-10-19
-- Purpose: Enforce tenant isolation for image uploads, updates, and deletes
-- Related: Feature 013-lets-plan-to - Template and Task Image Management
-- Spec: /specs/013-lets-plan-to/

-- ============================================================
-- RLS Policies for task-template-images bucket
-- ============================================================

-- Policy 1: Authenticated users can upload to their tenant folder
DROP POLICY IF EXISTS "Users can upload template images in their tenant" ON storage.objects;
CREATE POLICY "Users can upload template images in their tenant"
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
DROP POLICY IF EXISTS "Public can view template images" ON storage.objects;
CREATE POLICY "Public can view template images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-template-images');

-- Policy 3: Users can update their tenant's images
DROP POLICY IF EXISTS "Users can update template images in their tenant" ON storage.objects;
CREATE POLICY "Users can update template images in their tenant"
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

-- Policy 4: Users can delete their tenant's images
DROP POLICY IF EXISTS "Users can delete template images in their tenant" ON storage.objects;
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

-- ============================================================
-- RLS Policies for task-images bucket
-- ============================================================

-- Policy 1: Authenticated users can upload to their tenant folder
DROP POLICY IF EXISTS "Users can upload task images in their tenant" ON storage.objects;
CREATE POLICY "Users can upload task images in their tenant"
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

-- Policy 2: Public can view images (bucket is public)
DROP POLICY IF EXISTS "Public can view task images" ON storage.objects;
CREATE POLICY "Public can view task images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-images');

-- Policy 3: Users can update their tenant's images
DROP POLICY IF EXISTS "Users can update task images in their tenant" ON storage.objects;
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

-- Policy 4: Users can delete their tenant's images
DROP POLICY IF EXISTS "Users can delete task images in their tenant" ON storage.objects;
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

-- ============================================================
-- Comments for documentation
-- ============================================================

COMMENT ON POLICY "Users can upload template images in their tenant" ON storage.objects IS
  'Allows authenticated users to upload images only to folders matching their tenant_id in task-template-images bucket';

COMMENT ON POLICY "Public can view template images" ON storage.objects IS
  'Allows anyone to view template images (bucket is public for display purposes)';

COMMENT ON POLICY "Users can upload task images in their tenant" ON storage.objects IS
  'Allows authenticated users to upload images only to folders matching their tenant_id in task-images bucket';

COMMENT ON POLICY "Public can view task images" ON storage.objects IS
  'Allows anyone to view task images (bucket is public for display purposes)';
