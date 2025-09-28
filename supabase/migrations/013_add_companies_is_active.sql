-- 013_add_companies_is_active.sql
-- Add is_active column required by test data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'is_active'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END
$$;