# Task: OCR Core Tables Migration

**Slug:** `ocr-002-ocr-tables-migration`
**Priority:** Critical
**Size:** 1 PR

## Description
Create core OCR tables (ocr_jobs, ocr_documents) with RLS using idempotent reconciler patterns.

## Pre-Requirements
**MANDATORY**: Run actual DB check before starting:
```bash
npm run db:check:actual > db-state-ocr-core-$(date +%Y%m%d).txt
# Verify vendors table exists
# Verify inventory_images table exists
# Verify jobs table exists
```

## Files to Create
- `supabase/migrations/015_ocr_core_reconciler.sql`
- `src/domains/ocr/types/ocr-types.ts`

## Files to Modify
- `src/lib/database.types.ts` - Regenerate after migration

## Acceptance Criteria
- [ ] Runs db:check:actual and verifies dependencies
- [ ] Creates ocr_jobs table with all columns
- [ ] Creates ocr_documents table with JSONB fields
- [ ] Adds CHECK constraints for enums
- [ ] Creates all required indexes
- [ ] Enables RLS with company isolation
- [ ] Foreign keys only if target tables exist
- [ ] Commit and push immediately after completion

## Test Files
**Create:** `src/__tests__/rls/ocr-tables.rls.test.ts`

Test cases:
- `ocr_jobs tenant isolation`
  - Insert job for company A
  - Query as company B
  - Assert no results
  
- `ocr_documents tenant isolation`
  - Create document for company A
  - Update as company B
  - Assert permission denied

## Dependencies
- `ocr-001-vendors-table-check` - Vendors table must exist

## Migration Pattern
```sql
-- Create ocr_jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ocr_jobs'
  ) THEN
    CREATE TABLE ocr_jobs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL,
      media_asset_id UUID NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      queued_at TIMESTAMPTZ DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      estimated_cost DECIMAL(10,4),
      actual_cost DECIMAL(10,4),
      processing_time_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'ocr_jobs_type_check'
  ) THEN
    ALTER TABLE ocr_jobs ADD CONSTRAINT ocr_jobs_type_check 
      CHECK (job_type IN ('receipt', 'invoice', 'handwritten'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'ocr_jobs_status_check'
  ) THEN
    ALTER TABLE ocr_jobs ADD CONSTRAINT ocr_jobs_status_check 
      CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));
  END IF;
END $$;

-- Foreign keys only if tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'companies'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ocr_jobs_company_fk'
  ) THEN
    ALTER TABLE ocr_jobs ADD CONSTRAINT ocr_jobs_company_fk 
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;
```

## Rollback
- Migration is idempotent, can re-run
- To disable: UPDATE company_settings SET features = features - 'ocr_enabled'