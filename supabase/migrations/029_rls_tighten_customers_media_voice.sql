-- 029_rls_tighten_customers_media_voice.sql
-- Harden RLS for customers, media_assets, voice_sessions using JWT company_id claims

-- Customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'customers_allow_all_for_now'
  ) THEN
    DROP POLICY customers_allow_all_for_now ON public.customers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'customers_company_isolation'
  ) THEN
    CREATE POLICY customers_company_isolation
    ON public.customers
    FOR ALL
    TO authenticated
    USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
    WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'customers_service_role'
  ) THEN
    CREATE POLICY customers_service_role
    ON public.customers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Media assets
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_allow_all_for_now'
  ) THEN
    DROP POLICY media_allow_all_for_now ON public.media_assets;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_company_isolation'
  ) THEN
    CREATE POLICY media_company_isolation
    ON public.media_assets
    FOR ALL
    TO authenticated
    USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
    WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_service_role'
  ) THEN
    CREATE POLICY media_service_role
    ON public.media_assets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Voice sessions (only if company_id column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'voice_sessions'
      AND column_name = 'company_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.voice_sessions FORCE ROW LEVEL SECURITY';

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'voice_sessions'
        AND policyname = 'voice_allow_all_for_now'
    ) THEN
      EXECUTE 'DROP POLICY voice_allow_all_for_now ON public.voice_sessions';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'voice_sessions'
        AND policyname = 'voice_company_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY voice_company_isolation ON public.voice_sessions FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        'company_id = (current_setting(''request.jwt.claims'', true)::json->>''company_id'')',
        'company_id = (current_setting(''request.jwt.claims'', true)::json->>''company_id'')'
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'voice_sessions'
        AND policyname = 'voice_service_role'
    ) THEN
      EXECUTE 'CREATE POLICY voice_service_role ON public.voice_sessions FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END $$;
