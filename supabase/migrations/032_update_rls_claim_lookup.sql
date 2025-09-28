-- 032_update_rls_claim_lookup.sql
-- Recreate tenant isolation policies to read company_id from user/app metadata

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'customers_company_isolation'
  ) THEN
    DROP POLICY customers_company_isolation ON public.customers;
  END IF;

  CREATE POLICY customers_company_isolation
  ON public.customers
  FOR ALL
  TO authenticated
  USING (
    company_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  )
  WITH CHECK (
    company_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_company_isolation'
  ) THEN
    DROP POLICY media_company_isolation ON public.media_assets;
  END IF;

  CREATE POLICY media_company_isolation
  ON public.media_assets
  FOR ALL
  TO authenticated
  USING (
    company_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  )
  WITH CHECK (
    company_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_sessions'
      AND policyname = 'voice_company_isolation'
  ) THEN
    DROP POLICY voice_company_isolation ON public.voice_sessions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_sessions'
      AND policyname = 'voice_service_role'
  ) THEN
    DROP POLICY voice_service_role ON public.voice_sessions;
  END IF;

  CREATE POLICY voice_company_isolation
  ON public.voice_sessions
  FOR ALL
  TO authenticated
  USING (
    company_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  )
  WITH CHECK (
    company_id = COALESCE(
      (current_setting('request.jwt.claims', true)::json ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'company_id'),
      (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );

  CREATE POLICY voice_service_role
  ON public.voice_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
END $$;
