-- 015_relax_companies_tenant_id.sql
-- Allow test seed data without tenant linkage
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.companies
      ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;