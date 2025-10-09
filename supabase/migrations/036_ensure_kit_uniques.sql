-- Add unique index for tenant-scoped kit codes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kits_tenant_code
  ON public.kits(tenant_id, kit_code);
