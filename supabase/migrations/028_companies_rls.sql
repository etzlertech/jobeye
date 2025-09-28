-- 028_companies_rls.sql
-- Tighten companies RLS to tenant scope
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'companies_allow_all_for_now'
  ) THEN
    DROP POLICY companies_allow_all_for_now ON public.companies;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'companies_tenant_isolation'
  ) THEN
    CREATE POLICY companies_tenant_isolation
    ON public.companies
    FOR ALL
    TO authenticated
    USING (id = (auth.jwt() ->> 'company_id'))
    WITH CHECK (id = (auth.jwt() ->> 'company_id'));
  END IF;
END $$;