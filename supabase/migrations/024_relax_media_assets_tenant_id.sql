-- 024_relax_media_assets_tenant_id.sql
-- Allow media_assets entries without tenant linkage for tests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_assets'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.media_assets
      ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;