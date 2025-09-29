# Task: OCR RLS Isolation Tests

**Slug:** `ocr-026-rls-tests`
**Priority:** High
**Size:** 1 PR

## Description
Create comprehensive RLS tests for all OCR tables using pgtap framework.

## Files to Create
- `supabase/tests/ocr-rls.test.sql`
- `src/__tests__/rls/ocr-complete.test.ts`

## Files to Modify
- None (new tests)

## Acceptance Criteria
- [ ] Tests all 6 OCR tables for RLS isolation
- [ ] Verifies cross-tenant access denial
- [ ] Tests CRUD operations per company
- [ ] Uses pgtap for database tests
- [ ] Includes admin bypass scenarios
- [ ] Tests cascade deletes
- [ ] 100% RLS coverage
- [ ] Commit and push after implementation

## Test Files
**Create:** `supabase/tests/ocr-rls.test.sql`

Test cases:
```sql
-- Test OCR jobs isolation
BEGIN;
SELECT plan(12);

-- Setup test companies
INSERT INTO companies (id, name) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Company A'),
  ('22222222-2222-2222-2222-222222222222', 'Company B');

-- Test cross-tenant read denial
SET LOCAL jwt.claims.company_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO ocr_jobs (company_id, media_asset_id, job_type, status) 
VALUES ('11111111-1111-1111-1111-111111111111', gen_random_uuid(), 'receipt', 'queued');

SET LOCAL jwt.claims.company_id = '22222222-2222-2222-2222-222222222222';
SELECT is(
  COUNT(*)::integer,
  0,
  'Company B cannot see Company A OCR jobs'
) FROM ocr_jobs;

-- Test same-tenant access allowed
SET LOCAL jwt.claims.company_id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  COUNT(*)::integer,
  1,
  'Company A can see own OCR jobs'
) FROM ocr_jobs;

-- Add similar tests for all tables
SELECT * FROM finish();
ROLLBACK;
```

**Create:** `src/__tests__/rls/ocr-complete.test.ts`

Test cases:
- `enforces RLS on ocr_jobs`
- `enforces RLS on ocr_documents`
- `enforces RLS on ocr_line_items`
- `enforces RLS on ocr_note_entities`
- `enforces RLS on vendor_aliases`
- `enforces RLS on vendor_locations`

## Dependencies
- pgtap extension
- Test database

## RLS Test Matrix
```
Table               | SELECT | INSERT | UPDATE | DELETE |
--------------------|--------|--------|--------|--------|
ocr_jobs           |   ✓    |   ✓    |   ✓    |   ✓    |
ocr_documents      |   ✓    |   ✓    |   ✓    |   ✓    |
ocr_line_items     |   ✓    |   ✓    |   ✓    |   ✓    |
ocr_note_entities  |   ✓    |   ✓    |   ✓    |   ✓    |
vendor_aliases     |   ✓    |   ✓    |   ✓    |   ✓    |
vendor_locations   |   ✓    |   ✓    |   ✓    |   ✓    |
```

## Admin Bypass Test
```sql
-- Test admin can bypass RLS
SET LOCAL jwt.claims.role = 'admin';
SELECT is(
  COUNT(*) > 1,
  true,
  'Admin can see all companies data'
) FROM ocr_jobs;
```

## Rollback
- Tests don't affect data
- Run in transaction