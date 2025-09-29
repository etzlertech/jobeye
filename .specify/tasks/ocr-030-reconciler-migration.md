# Task: OCR Reconciler Migration Implementation

**Slug:** `ocr-030-reconciler-migration`
**Priority:** Critical
**Size:** 1 PR

## Description
Create the master OCR reconciler migration that safely handles all schema states.

## Pre-Requirements
**MANDATORY - CONSTITUTION NON-NEGOTIABLES**:
1. **MUST** run actual DB check first:
   ```bash
   npm run db:check:actual > db-state-ocr-reconciler-$(date +%Y%m%d).txt
   ```
2. **MUST** use IF NOT EXISTS for all objects
3. **MUST** use DO blocks for conditional logic
4. **MUST** never DROP without explicit data plan
5. **MUST** commit and push immediately after

## Files to Create
- `supabase/migrations/018_ocr_complete_reconciler.sql`
- `scripts/test-ocr-reconciler.ts`

## Files to Modify
- None (new migration)

## Acceptance Criteria
- [ ] Runs db:check:actual and documents findings
- [ ] Creates all 6 OCR tables if missing
- [ ] Adds missing columns to existing tables
- [ ] Creates all indexes idempotently
- [ ] Creates all RLS policies conditionally
- [ ] Updates company_settings for OCR
- [ ] Can run multiple times without error
- [ ] Commit and push immediately after creation

## Test Files
**Create:** `src/__tests__/migrations/ocr-reconciler.test.ts`

Test cases:
- `handles empty database`
  - Start with no tables
  - Run reconciler
  - Assert all created
  
- `handles partial schema`
  - Create some tables
  - Run reconciler
  - Assert missing added
  - Assert existing preserved
  
- `preserves existing data`
  - Insert test data
  - Run reconciler
  - Assert data intact
  
- `is fully idempotent`
  - Run 5 times
  - Assert no errors
  - Assert same result

## Dependencies
- Must follow `ocr-028-preflight-check`

## Reconciler Structure
```sql
-- 018_ocr_complete_reconciler.sql
-- OCR Complete Schema Reconciler
-- This migration is IDEMPOTENT and can be run multiple times

-- 1. Ensure vendors table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'vendors'
  ) THEN
    CREATE TABLE vendors (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. Create ocr_jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ocr_jobs'
  ) THEN
    -- Create table
  END IF;
  
  -- Add missing columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ocr_jobs' AND column_name = 'processing_time_ms'
  ) THEN
    ALTER TABLE ocr_jobs ADD COLUMN processing_time_ms INTEGER;
  END IF;
END $$;

-- 3. RLS Policies
DO $$
BEGIN
  -- Enable RLS if not enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'ocr_jobs' AND rowsecurity = true
  ) THEN
    ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Create policy if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ocr_jobs' AND policyname = 'ocr_jobs_tenant_isolation'
  ) THEN
    CREATE POLICY ocr_jobs_tenant_isolation ON ocr_jobs
      FOR ALL USING (company_id = auth.jwt() ->> 'company_id');
  END IF;
END $$;

-- Continue for all tables...
```

## Validation
- Run against fresh DB
- Run against partial DB
- Run against complete DB
- All should succeed

## Rollback
- Reconciler is additive only
- Use feature flag to disable