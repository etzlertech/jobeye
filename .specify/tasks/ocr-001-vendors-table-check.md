# Task: Vendors Table Verification and Creation

**Slug:** `ocr-001-vendors-table-check`
**Priority:** Critical
**Size:** 1 PR

## Description
Check if vendors table exists in actual database and create it if missing, as it's required for OCR foreign keys.

## Pre-Requirements
**MANDATORY**: Run actual DB check before starting:
```bash
npm run db:check:actual > db-state-vendors-$(date +%Y%m%d).txt
```

## Files to Create
- `supabase/migrations/014_vendors_reconciler.sql`
- `src/lib/repositories/vendor.repository.ts`
- `src/domains/vendor/types/vendor.types.ts`

## Files to Modify
- `src/lib/database.types.ts` - Regenerate after migration

## Acceptance Criteria
- [ ] Runs db:check:actual and documents vendors table state
- [ ] Creates vendors table if not exists with company_id
- [ ] Adds RLS policies using DO blocks
- [ ] Creates name and location indexes
- [ ] Seeds sample vendors for existing companies
- [ ] Repository implements base pattern
- [ ] Commit and push immediately after completion

## Test Files
**Create:** `src/__tests__/lib/repositories/vendor.repository.test.ts`

Test cases:
- `creates vendor with company scope`
  - Create vendor for company A
  - Assert saved with correct company_id
  
- `enforces RLS isolation`
  - Try to read company B vendors as company A
  - Assert empty result
  
- `finds by name fuzzy match`
  - Search "Home Depot"
  - Assert finds "The Home Depot"

**Create:** `src/__tests__/rls/vendors.rls.test.ts`

Test cases:
- `prevents cross-tenant vendor access`
- `allows same-tenant CRUD operations`

## Dependencies
- None (foundation table)

## Migration Pattern
```sql
-- Check and create vendors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'vendors'
  ) THEN
    CREATE TABLE vendors (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, name)
    );
  END IF;
END $$;

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Create policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'vendors' AND policyname = 'vendors_tenant_isolation'
  ) THEN
    CREATE POLICY vendors_tenant_isolation ON vendors
      FOR ALL USING (company_id = auth.jwt() ->> 'company_id');
  END IF;
END $$;
```

## Rollback
- No rollback needed (idempotent)
- If issues, disable OCR feature flag