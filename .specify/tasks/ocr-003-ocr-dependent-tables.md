# Task: OCR Dependent Tables Migration

**Slug:** `ocr-003-ocr-dependent-tables`
**Priority:** High
**Size:** 1 PR

## Description
Create dependent OCR tables (ocr_line_items, ocr_note_entities, vendor_aliases, vendor_locations) with RLS.

## Pre-Requirements
**MANDATORY**: Run actual DB check before starting:
```bash
npm run db:check:actual > db-state-ocr-dependent-$(date +%Y%m%d).txt
# Verify ocr_jobs and ocr_documents exist
# Verify vendors table exists
```

## Files to Create
- `supabase/migrations/016_ocr_dependent_reconciler.sql`

## Files to Modify
- `src/lib/database.types.ts` - Regenerate

## Acceptance Criteria
- [ ] Runs db:check:actual and verifies parent tables
- [ ] Creates ocr_line_items with cascade delete
- [ ] Creates ocr_note_entities with entity types
- [ ] Creates vendor_aliases with unique constraint
- [ ] Creates vendor_locations with spatial column
- [ ] Enables RLS on all tables
- [ ] Adds performance indexes
- [ ] Commit and push immediately

## Test Files
**Extend:** `src/__tests__/rls/ocr-tables.rls.test.ts`

Test cases:
- `ocr_line_items cascade delete`
  - Create document with line items
  - Delete document
  - Assert line items deleted
  
- `vendor_aliases unique per company`
  - Create alias for company A
  - Try duplicate for company A
  - Assert constraint violation
  - Create same alias for company B
  - Assert success

## Dependencies
- `ocr-002-ocr-tables-migration` - Parent tables must exist

## Rollback
- Tables can be safely dropped if unused
- No data migration required