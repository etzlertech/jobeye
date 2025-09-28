-- 025_relax_media_assets_uploaded_by.sql
-- Allow media_assets uploaded_by to be null for tests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_assets'
      AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE public.media_assets
      ALTER COLUMN uploaded_by DROP NOT NULL;
  END IF;
END $$;