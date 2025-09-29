-- 012_add_companies_domain.sql
-- Add domain column expected by test seeders
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    BEGIN
      ALTER TABLE public.companies
      ADD COLUMN IF NOT EXISTS domain TEXT;
    EXCEPTION
      WHEN duplicate_column THEN
        -- no-op
        NULL;
    END;
  END IF;
END
$$;