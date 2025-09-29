-- 017_add_customers_version.sql
-- Add version column expected by test data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'version'
    ) THEN
      ALTER TABLE public.customers
        ADD COLUMN version integer DEFAULT 1;
    END IF;
  END IF;
END $$;