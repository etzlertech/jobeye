-- Base Tables Setup for JobEye (Using existing tenants table)
-- This creates the fundamental tables needed before voice-vision migration

-- NOTE: If you already have a 'tenants' table, we'll create 'companies' as a view
-- This maintains compatibility with both naming conventions

-- 1. Create companies as a view of tenants (if tenants exists)
CREATE OR REPLACE VIEW public.companies AS
SELECT 
  id,
  name,
  COALESCE(settings->>'code', substring(id::text, 1, 8)) as code,
  active,
  settings,
  created_at,
  updated_at
FROM public.tenants;

-- Grant permissions on the view
GRANT SELECT ON public.companies TO authenticated;

-- 2. If tenants doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'tenants') THEN
    CREATE TABLE public.tenants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      settings jsonb DEFAULT '{}'::jsonb,
      active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
    
    -- Create trigger for updated_at
    CREATE TRIGGER set_tenants_updated_at
      BEFORE UPDATE ON public.tenants
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 3. Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid GENERATED ALWAYS AS (tenant_id) STORED, -- Alias for compatibility
  name text NOT NULL,
  email text,
  phone text,
  address jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_customer_tenant FOREIGN KEY (tenant_id) 
    REFERENCES tenants(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 4. Create properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid GENERATED ALWAYS AS (tenant_id) STORED, -- Alias for compatibility
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  property_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_property_tenant FOREIGN KEY (tenant_id) 
    REFERENCES tenants(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_customer ON properties(customer_id);

-- 6. Helper function to get user's tenant/company
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT COALESCE(
    -- First try profiles.company_id
    (SELECT company_id FROM public.profiles WHERE id = auth.uid()),
    -- Then try profiles.tenant_id
    (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()),
    -- Then try user metadata
    (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid,
    (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
  )
$$;

-- 7. RLS Policies for tenants
CREATE POLICY "Users can view own tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = get_user_tenant_id());

-- 8. RLS Policies for customers (tenant isolation)
CREATE POLICY "View customers in own tenant" ON public.customers
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Create customers in own tenant" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Update customers in own tenant" ON public.customers
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Delete customers in own tenant" ON public.customers
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 9. RLS Policies for properties (tenant isolation)
CREATE POLICY "View properties in own tenant" ON public.properties
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Create properties in own tenant" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Update properties in own tenant" ON public.properties
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Delete properties in own tenant" ON public.properties
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 10. Updated-at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 11. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Base tables created successfully';
  RAISE NOTICE 'Created: customers, properties (using tenants table)';
  RAISE NOTICE 'Created companies view for compatibility';
  RAISE NOTICE 'All RLS policies applied';
  RAISE NOTICE 'Ready for profiles and voice-vision migrations';
END;
$$;