-- Add unique index for company-scoped kit codes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kits_company_code
  ON public.kits(company_id, kit_code);
