
-- 040_ocr_domain.sql
-- Introduce OCR/Accounts core tables with RLS and triggers

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at' AND n.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $f$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END
    $f$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendors'
  ) THEN
    CREATE TABLE public.vendors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'vendors_set_updated_at'
  ) THEN
    CREATE TRIGGER vendors_set_updated_at
    BEFORE UPDATE ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_aliases'
  ) THEN
    CREATE TABLE public.vendor_aliases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
      alias TEXT NOT NULL
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_locations'
  ) THEN
    CREATE TABLE public.vendor_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_images'
  ) THEN
    CREATE TABLE public.inventory_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      media_id UUID,
      file_path TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_jobs'
  ) THEN
    CREATE TABLE public.ocr_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      vendor_id UUID REFERENCES public.vendors(id),
      status TEXT NOT NULL CHECK (status IN ('queued','processing','done','error')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_documents'
  ) THEN
    CREATE TABLE public.ocr_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      ocr_job_id UUID REFERENCES public.ocr_jobs(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      page_count INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_line_items'
  ) THEN
    CREATE TABLE public.ocr_line_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      ocr_document_id UUID REFERENCES public.ocr_documents(id) ON DELETE CASCADE,
      line_index INTEGER NOT NULL,
      sku TEXT,
      description TEXT,
      qty NUMERIC(18,6),
      unit_price NUMERIC(18,6),
      total NUMERIC(18,6)
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_note_entities'
  ) THEN
    CREATE TABLE public.ocr_note_entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      ocr_document_id UUID REFERENCES public.ocr_documents(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      value TEXT
    );
  END IF;
END;
$$;

-- Optional media_assets FK for inventory_images.media_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_images'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'media_assets'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'inventory_images_media_id_fkey'
        AND conrelid = 'public.inventory_images'::regclass
    ) THEN
      ALTER TABLE public.inventory_images
        ADD CONSTRAINT inventory_images_media_id_fkey
        FOREIGN KEY (media_id)
        REFERENCES public.media_assets(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendors'
  ) THEN
    ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.vendors FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vendors'
        AND policyname = 'vendors_tenant_isolation'
    ) THEN
      CREATE POLICY vendors_tenant_isolation
      ON public.vendors
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vendors'
        AND policyname = 'vendors_service_role'
    ) THEN
      CREATE POLICY vendors_service_role
      ON public.vendors
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_aliases'
  ) THEN
    ALTER TABLE public.vendor_aliases ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.vendor_aliases FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vendor_aliases'
        AND policyname = 'vendor_aliases_tenant_isolation'
    ) THEN
      CREATE POLICY vendor_aliases_tenant_isolation
      ON public.vendor_aliases
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vendor_aliases'
        AND policyname = 'vendor_aliases_service_role'
    ) THEN
      CREATE POLICY vendor_aliases_service_role
      ON public.vendor_aliases
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_locations'
  ) THEN
    ALTER TABLE public.vendor_locations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.vendor_locations FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vendor_locations'
        AND policyname = 'vendor_locations_tenant_isolation'
    ) THEN
      CREATE POLICY vendor_locations_tenant_isolation
      ON public.vendor_locations
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'vendor_locations'
        AND policyname = 'vendor_locations_service_role'
    ) THEN
      CREATE POLICY vendor_locations_service_role
      ON public.vendor_locations
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_images'
  ) THEN
    ALTER TABLE public.inventory_images ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.inventory_images FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inventory_images'
        AND policyname = 'inventory_images_tenant_isolation'
    ) THEN
      CREATE POLICY inventory_images_tenant_isolation
      ON public.inventory_images
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'inventory_images'
        AND policyname = 'inventory_images_service_role'
    ) THEN
      CREATE POLICY inventory_images_service_role
      ON public.inventory_images
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_jobs'
  ) THEN
    ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ocr_jobs FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_jobs'
        AND policyname = 'ocr_jobs_tenant_isolation'
    ) THEN
      CREATE POLICY ocr_jobs_tenant_isolation
      ON public.ocr_jobs
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_jobs'
        AND policyname = 'ocr_jobs_service_role'
    ) THEN
      CREATE POLICY ocr_jobs_service_role
      ON public.ocr_jobs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_documents'
  ) THEN
    ALTER TABLE public.ocr_documents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ocr_documents FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_documents'
        AND policyname = 'ocr_documents_tenant_isolation'
    ) THEN
      CREATE POLICY ocr_documents_tenant_isolation
      ON public.ocr_documents
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_documents'
        AND policyname = 'ocr_documents_service_role'
    ) THEN
      CREATE POLICY ocr_documents_service_role
      ON public.ocr_documents
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_line_items'
  ) THEN
    ALTER TABLE public.ocr_line_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ocr_line_items FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_line_items'
        AND policyname = 'ocr_line_items_tenant_isolation'
    ) THEN
      CREATE POLICY ocr_line_items_tenant_isolation
      ON public.ocr_line_items
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_line_items'
        AND policyname = 'ocr_line_items_service_role'
    ) THEN
      CREATE POLICY ocr_line_items_service_role
      ON public.ocr_line_items
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;

-- Enable and force RLS, plus policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocr_note_entities'
  ) THEN
    ALTER TABLE public.ocr_note_entities ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ocr_note_entities FORCE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_note_entities'
        AND policyname = 'ocr_note_entities_tenant_isolation'
    ) THEN
      CREATE POLICY ocr_note_entities_tenant_isolation
      ON public.ocr_note_entities
      FOR ALL
      TO authenticated
      USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'))
      WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id'));
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'ocr_note_entities'
        AND policyname = 'ocr_note_entities_service_role'
    ) THEN
      CREATE POLICY ocr_note_entities_service_role
      ON public.ocr_note_entities
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    END IF;
  END IF;
END;
$$;
