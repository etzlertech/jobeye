-- 022_extend_media_assets_for_tests.sql
-- Ensure media_assets has columns required by RLS seed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'media_assets'
  ) THEN
    ALTER TABLE public.media_assets
      ADD COLUMN IF NOT EXISTS asset_type text,
      ADD COLUMN IF NOT EXISTS file_path text,
      ADD COLUMN IF NOT EXISTS file_size bigint,
      ADD COLUMN IF NOT EXISTS mime_type text,
      ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
  END IF;
END $$;