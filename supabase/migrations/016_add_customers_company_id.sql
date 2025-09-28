-- 016_add_customers_company_id.sql
-- Provide company_id column expected by RLS seeds
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
        AND column_name = 'company_id'
    ) THEN
      ALTER TABLE public.customers
        ADD COLUMN company_id text;
    END IF;
  END IF;
END $$;