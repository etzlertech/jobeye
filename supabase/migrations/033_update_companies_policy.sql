-- 033_update_companies_policy.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companies'
      AND policyname = 'companies_tenant_isolation'
  ) THEN
    DROP POLICY companies_tenant_isolation ON public.companies;
  END IF;

  CREATE POLICY companies_tenant_isolation
  ON public.companies
  FOR ALL
  TO authenticated
  USING (
    id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  )
  WITH CHECK (
    id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );
END $$;
