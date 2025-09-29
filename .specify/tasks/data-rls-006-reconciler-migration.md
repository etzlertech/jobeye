# Task: Idempotent Schema Reconciler Migration

**Slug:** `data-rls-006-reconciler-migration`
**Priority:** Critical
**Size:** 1 PR

## Description
Create an idempotent reconciler migration that can safely bring any database state to the expected schema without data loss.

## Files to Create
- `supabase/migrations/009_reconcile_schema.sql`
- `scripts/validate-reconciler.ts`
- `docs/reconciler-patterns.md`

## Files to Modify
- `.github/workflows/database.yml` - Add reconciler validation

## Acceptance Criteria
- [ ] Migration uses IF NOT EXISTS for all table creation
- [ ] Uses DO blocks with pg_catalog checks for constraints/indexes
- [ ] Handles partial schema states gracefully
- [ ] Can run multiple times without errors
- [ ] Never drops data without explicit backup plan
- [ ] Validates against fresh DB and existing DB
- [ ] Includes rollback procedures

## Test Files
**Create:** `src/__tests__/migrations/reconciler.test.ts`

Test cases:
- `applies cleanly to empty database`
  - Start with fresh DB
  - Run reconciler
  - Assert all objects created
  
- `handles partial existing schema`
  - Create some tables manually
  - Run reconciler
  - Assert completes without error
  - Assert missing objects added
  
- `preserves existing data`
  - Insert test data
  - Run reconciler
  - Assert data unchanged
  
- `idempotent on multiple runs`
  - Run reconciler 3 times
  - Assert no errors
  - Assert schema unchanged

## Dependencies
- `ops-000-preflight-db` - Must check actual state first

## Migration Patterns
```sql
-- Table creation pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'companies'
  ) THEN
    CREATE TABLE companies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Column addition pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'settings'
  ) THEN
    ALTER TABLE companies ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;
END $$;

-- Index creation pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_companies_created_at'
  ) THEN
    CREATE INDEX idx_companies_created_at ON companies(created_at);
  END IF;
END $$;

-- RLS policy pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' 
    AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON companies
      FOR ALL USING (id = auth.jwt() ->> 'company_id');
  END IF;
END $$;

-- Function creation pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_updated_at'
  ) THEN
    CREATE FUNCTION handle_updated_at() 
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;
```

## Validation Script
```typescript
// scripts/validate-reconciler.ts
// 1. Connect to test DB
// 2. Snapshot current state
// 3. Run reconciler
// 4. Compare states
// 5. Run reconciler again
// 6. Assert no changes
```

## Rollback Strategy
- Each DO block logs its action
- Maintain version in schema_migrations table
- Separate undo script for emergencies