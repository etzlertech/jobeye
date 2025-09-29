-- 027_relax_media_assets_file_name.sql
-- Allow file_name to be nullable for test seed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_assets'
      AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.media_assets
      ALTER COLUMN file_name DROP NOT NULL;
  END IF;
END $$;