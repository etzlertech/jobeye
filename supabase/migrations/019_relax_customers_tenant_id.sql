-- 019_relax_customers_tenant_id.sql
-- Allow seed data without tenant linkage
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.customers
      ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;