-- 011_min_companies_stub.sql
-- Minimal, forward-compatible stub so tests and FKs work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    CREATE TABLE public.companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- keep it RLS-ready but simple; real policies can be added later
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

    -- basic updated_at trigger helper (reuse if it already exists)
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'set_updated_at' AND n.nspname = 'public'
    ) THEN
      CREATE OR REPLACE FUNCTION public.set_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $f$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END
      $f$;
    END IF;

    -- attach trigger (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'companies_set_updated_at'
    ) THEN
      CREATE TRIGGER companies_set_updated_at
      BEFORE UPDATE ON public.companies
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;

    -- very permissive test-only policy (service_role seeds via exec_sql; app RLS lives on other tables)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_allow_all_for_now'
    ) THEN
      CREATE POLICY companies_allow_all_for_now
      ON public.companies
      FOR ALL
      TO PUBLIC
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END
$$;