-- 034_update_companies_force_rls.sql
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'companies_service_role'
  ) THEN
    CREATE POLICY companies_service_role
    ON public.companies
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
