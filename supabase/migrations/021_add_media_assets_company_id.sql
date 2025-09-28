-- 021_add_media_assets_company_id.sql
-- Add company_id column needed for RLS seed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'media_assets'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'media_assets'
        AND column_name = 'company_id'
    ) THEN
      ALTER TABLE public.media_assets
        ADD COLUMN company_id text;
    END IF;
  END IF;
END $$;