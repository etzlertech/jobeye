-- 035_003_scheduling_kits.sql
-- Minimal viable feature schema for Scheduling Kits domain

-- Ensure updated_at trigger helper exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at'
      AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;
  END IF;
END;
$$;

-- Kits master table
CREATE TABLE IF NOT EXISTS public.kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kit_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, kit_code)
);

-- Items that belong to kits
CREATE TABLE IF NOT EXISTS public.kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material', 'tool')),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit VARCHAR(50),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional kit variants (seasonal, etc.)
CREATE TABLE IF NOT EXISTS public.kit_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  variant_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kit_id, variant_code)
);

-- Kit assignments (placeholder link via external_ref)
CREATE TABLE IF NOT EXISTS public.kit_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.kit_variants(id) ON DELETE SET NULL,
  external_ref TEXT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, external_ref)
);

-- Technician overrides when kit items are missing
CREATE TABLE IF NOT EXISTS public.kit_override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.kit_assignments(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.kit_items(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kits_set_updated_at') THEN
    CREATE TRIGGER kits_set_updated_at
    BEFORE UPDATE ON public.kits
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kit_items_set_updated_at') THEN
    CREATE TRIGGER kit_items_set_updated_at
    BEFORE UPDATE ON public.kit_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kit_variants_set_updated_at') THEN
    CREATE TRIGGER kit_variants_set_updated_at
    BEFORE UPDATE ON public.kit_variants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kit_assignments_set_updated_at') THEN
    CREATE TRIGGER kit_assignments_set_updated_at
    BEFORE UPDATE ON public.kit_assignments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Useful indexes
CREATE INDEX IF NOT EXISTS kits_company_name_idx ON public.kits(company_id, name);
CREATE INDEX IF NOT EXISTS kit_items_kit_idx ON public.kit_items(kit_id);
CREATE INDEX IF NOT EXISTS kit_variants_kit_idx ON public.kit_variants(kit_id);
CREATE INDEX IF NOT EXISTS kit_override_logs_assignment_idx ON public.kit_override_logs(assignment_id);

-- Enforce Row Level Security
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kit_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kit_override_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_override_logs FORCE ROW LEVEL SECURITY;

-- Tenant-scoped policies
DROP POLICY IF EXISTS kits_tenant_access ON public.kits;
CREATE POLICY kits_tenant_access ON public.kits
  USING (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id')
  WITH CHECK (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id');

DROP POLICY IF EXISTS kit_items_tenant_access ON public.kit_items;
CREATE POLICY kit_items_tenant_access ON public.kit_items
  USING (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id')
  WITH CHECK (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id');

DROP POLICY IF EXISTS kit_variants_tenant_access ON public.kit_variants;
CREATE POLICY kit_variants_tenant_access ON public.kit_variants
  USING (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id')
  WITH CHECK (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id');

DROP POLICY IF EXISTS kit_assignments_tenant_access ON public.kit_assignments;
CREATE POLICY kit_assignments_tenant_access ON public.kit_assignments
  USING (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id')
  WITH CHECK (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id');

DROP POLICY IF EXISTS kit_override_logs_tenant_access ON public.kit_override_logs;
CREATE POLICY kit_override_logs_tenant_access ON public.kit_override_logs
  USING (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id')
  WITH CHECK (company_id::text = current_setting('request.jwt.claims', true)::json->>'company_id');

-- service_role bypass policies
DROP POLICY IF EXISTS kits_service_role ON public.kits;
CREATE POLICY kits_service_role ON public.kits
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS kit_items_service_role ON public.kit_items;
CREATE POLICY kit_items_service_role ON public.kit_items
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS kit_variants_service_role ON public.kit_variants;
CREATE POLICY kit_variants_service_role ON public.kit_variants
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS kit_assignments_service_role ON public.kit_assignments;
CREATE POLICY kit_assignments_service_role ON public.kit_assignments
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS kit_override_logs_service_role ON public.kit_override_logs;
CREATE POLICY kit_override_logs_service_role ON public.kit_override_logs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');