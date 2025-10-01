-- Migration: 045_create_verification_photos_bucket.sql
-- Purpose: Create storage bucket for verification photos
-- Phase: 3.3 - Mobile PWA Equipment Verification

-- Note: Storage buckets must be created via Supabase Storage API
-- This migration documents the bucket configuration

-- Bucket: verification-photos
-- Purpose: Store equipment verification photos from mobile PWA
-- Access: Private (authenticated users only, RLS enforced)
-- Max file size: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- RLS Policy for verification-photos bucket:
-- Users can:
-- 1. Upload photos to their company's folder
-- 2. Read photos from their company's folder only
-- 3. Delete photos they uploaded (within 24 hours)

-- SQL to create bucket (execute via Supabase dashboard or API):
/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-photos',
  'verification-photos',
  false, -- private bucket
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
);
*/

-- RLS Policies for verification-photos bucket

-- Policy: Users can upload to their company folder
CREATE POLICY "Users can upload verification photos to their company folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text
    FROM tenant_assignments
    WHERE user_id = auth.uid()
      AND is_active = true
  )
);

-- Policy: Users can view photos from their company folder
CREATE POLICY "Users can view verification photos from their company"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text
    FROM tenant_assignments
    WHERE user_id = auth.uid()
      AND is_active = true
  )
);

-- Policy: Users can delete photos they uploaded (within 24 hours)
CREATE POLICY "Users can delete their own verification photos within 24h"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-photos'
  AND owner = auth.uid()
  AND created_at > NOW() - INTERVAL '24 hours'
);

-- Add comment
COMMENT ON POLICY "Users can upload verification photos to their company folder" ON storage.objects IS
'Allows authenticated users to upload verification photos to their company folder in verification-photos bucket';

COMMENT ON POLICY "Users can view verification photos from their company" ON storage.objects IS
'Allows authenticated users to view verification photos from their company folder only (tenant isolation)';

COMMENT ON POLICY "Users can delete their own verification photos within 24h" ON storage.objects IS
'Allows users to delete verification photos they uploaded within the last 24 hours';
