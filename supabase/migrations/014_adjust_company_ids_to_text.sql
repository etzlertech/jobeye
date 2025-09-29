-- 014_adjust_company_ids_to_text.sql
-- Align companies/company_settings IDs with test seed expectations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_settings'
      AND policyname = 'company_settings_tenant_isolation'
  ) THEN
    DROP POLICY company_settings_tenant_isolation ON public.company_settings;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_settings_company_id_fkey'
      AND conrelid = 'public.company_settings'::regclass
  ) THEN
    ALTER TABLE public.company_settings
      DROP CONSTRAINT company_settings_company_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    ALTER TABLE public.companies
      ALTER COLUMN id DROP DEFAULT;

    ALTER TABLE public.companies
      ALTER COLUMN id TYPE text USING id::text;

    ALTER TABLE public.companies
      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_settings'
  ) THEN
    ALTER TABLE public.company_settings
      ALTER COLUMN company_id TYPE text USING company_id::text;

    ALTER TABLE public.company_settings
      ALTER COLUMN company_id SET NOT NULL;

    ALTER TABLE public.company_settings
      ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_settings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'company_settings_company_id_fkey'
        AND conrelid = 'public.company_settings'::regclass
    ) THEN
      ALTER TABLE public.company_settings
        ADD CONSTRAINT company_settings_company_id_fkey
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE CASCADE;
    END IF;

    -- Recreate permissive policy aligned with new type to keep functionality
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'company_settings'
        AND policyname = 'company_settings_tenant_isolation'
    ) THEN
      CREATE POLICY company_settings_tenant_isolation
        ON public.company_settings
        FOR ALL
        TO authenticated
        USING (company_id = (auth.jwt() ->> 'company_id'))
        WITH CHECK (company_id = (auth.jwt() ->> 'company_id'));
    END IF;
  END IF;
END $$;