-- Migration: Create Storage Buckets for Voice and Vision
-- Purpose: Set up Supabase Storage buckets with proper RLS policies
-- Phase: 3-4 (Voice Pipeline & Job Execution)

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('voice-recordings', 'voice-recordings', false, 52428800, ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg']),
  ('job-evidence', 'job-evidence', false, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heif', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for voice-recordings bucket
CREATE POLICY "Users can upload voice recordings for their company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'voice-recordings' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users can view voice recordings from their company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'voice-recordings' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users can delete their own voice recordings"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'voice-recordings' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid()) AND
  owner = auth.uid()
);

-- RLS Policies for job-evidence bucket
CREATE POLICY "Users can upload job evidence for their company"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-evidence' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users can view job evidence from their company"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'job-evidence' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users can delete their own job evidence"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'job-evidence' AND
  (storage.foldername(name))[1] = (SELECT company_id::text FROM users WHERE id = auth.uid()) AND
  owner = auth.uid()
);

-- Helper function to generate secure storage paths
CREATE OR REPLACE FUNCTION generate_storage_path(
  p_company_id uuid,
  p_object_type text,
  p_file_extension text
)
RETURNS text AS $$
BEGIN
  RETURN format('%s/%s/%s/%s.%s',
    p_company_id::text,
    EXTRACT(YEAR FROM now())::text,
    EXTRACT(MONTH FROM now())::text,
    gen_random_uuid()::text,
    p_file_extension
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage on the function
GRANT EXECUTE ON FUNCTION generate_storage_path TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Storage buckets created: voice-recordings (50MB limit), job-evidence (10MB limit)';
  RAISE NOTICE 'RLS policies applied for company isolation';
  RAISE NOTICE 'Path structure: {company_id}/{year}/{month}/{uuid}.{ext}';
END $$;