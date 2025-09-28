-- 026_relax_media_assets_media_type.sql
-- Allow media_type to be nullable for test seed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_assets'
      AND column_name = 'media_type'
  ) THEN
    ALTER TABLE public.media_assets
      ALTER COLUMN media_type DROP NOT NULL;
  END IF;
END $$;