-- 018_adjust_customer_ids_to_text.sql
-- Allow textual customer identifiers used by RLS seeds
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'active_jobs_view'
  ) THEN
    DROP VIEW public.active_jobs_view;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_sessions_customer_id_fkey'
      AND conrelid = 'public.conversation_sessions'::regclass
  ) THEN
    ALTER TABLE public.conversation_sessions
      DROP CONSTRAINT conversation_sessions_customer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_customer_id_fkey'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      DROP CONSTRAINT jobs_customer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_customer_id_fkey'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      DROP CONSTRAINT media_assets_customer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_customer_id_fkey'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      DROP CONSTRAINT properties_customer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_history_customer_id_fkey'
      AND conrelid = 'public.service_history'::regclass
  ) THEN
    ALTER TABLE public.service_history
      DROP CONSTRAINT service_history_customer_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    ALTER TABLE public.customers
      ALTER COLUMN id DROP DEFAULT,
      ALTER COLUMN id TYPE text USING id::text,
      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'company_id'
    ) THEN
      ALTER TABLE public.customers
        ALTER COLUMN company_id TYPE text;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversation_sessions'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.conversation_sessions
      ALTER COLUMN customer_id TYPE text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.jobs
      ALTER COLUMN customer_id TYPE text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_assets'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.media_assets
      ALTER COLUMN customer_id TYPE text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.properties
      ALTER COLUMN customer_id TYPE text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_history'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.service_history
      ALTER COLUMN customer_id TYPE text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_assets'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversation_sessions'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.conversation_sessions
      ADD CONSTRAINT conversation_sessions_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_history'
      AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.service_history
      ADD CONSTRAINT service_history_customer_id_fkey
      FOREIGN KEY (customer_id)
      REFERENCES public.customers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Recreate active_jobs_view with updated types
CREATE OR REPLACE VIEW public.active_jobs_view AS
SELECT
  j.*,
  c.name AS customer_name,
  c.phone AS customer_phone,
  p.name AS property_name,
  p.address AS property_address,
  u.display_name AS assigned_to_name
FROM public.jobs j
LEFT JOIN public.customers c ON c.id = j.customer_id
LEFT JOIN public.properties p ON p.id = j.property_id
LEFT JOIN public.users_extended u ON u.id = j.assigned_to
WHERE j.status NOT IN ('completed', 'cancelled');

GRANT SELECT ON public.active_jobs_view TO authenticated;