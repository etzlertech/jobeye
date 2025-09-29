# Task: OCR Migration Preflight Check

**Slug:** `ocr-028-preflight-check`
**Priority:** Critical
**Size:** 1 PR

## Description
Create preflight check script for OCR migrations following Non-Negotiables.

## Pre-Requirements
**MANDATORY**: This task enforces the constitution's Non-Negotiables:
- MUST run actual DB check before ANY migration
- MUST use idempotent reconciler patterns
- MUST commit and push immediately

## Files to Create
- `scripts/ocr-preflight-check.ts`
- `docs/ocr-migration-checklist.md`

## Files to Modify
- `package.json` - Add ocr:preflight script
- `.github/workflows/pull-request.yml` - Require for OCR PRs

## Acceptance Criteria
- [ ] Checks for existing OCR tables
- [ ] Verifies dependency tables exist
- [ ] Lists row counts and indexes
- [ ] Compares with expected schema
- [ ] Generates markdown report
- [ ] Exits with error if issues found
- [ ] Includes in PR template
- [ ] Commit and push immediately

## Test Files
**Create:** `src/__tests__/scripts/ocr-preflight-check.test.ts`

Test cases:
- `detects missing tables`
  - Mock DB without vendors
  - Run preflight
  - Assert exits with error
  - Assert report shows missing
  
- `passes with all tables`
  - Mock complete DB
  - Run preflight
  - Assert exits successfully
  - Assert report complete
  
- `identifies schema drift`
  - Mock different column
  - Assert warning issued
  - Assert details in report

## Dependencies
- `ops-000-preflight-db` - Base preflight

## Preflight Script
```typescript
async function ocrPreflightCheck(): Promise<PreflightResult> {
  console.log('🔍 OCR Migration Preflight Check');
  console.log('================================');
  
  // 1. Check vendors table (dependency)
  const vendorsExists = await checkTable('vendors');
  if (!vendorsExists) {
    console.error('❌ Missing dependency: vendors table');
    console.log('Run: ocr-001-vendors-table-check first');
    process.exit(1);
  }
  
  // 2. Check inventory_images (dependency)
  const imagesExists = await checkTable('inventory_images');
  if (!imagesExists) {
    console.error('❌ Missing dependency: inventory_images table');
    process.exit(1);
  }
  
  // 3. Check existing OCR tables
  const ocrTables = [
    'ocr_jobs',
    'ocr_documents',
    'ocr_line_items',
    'ocr_note_entities',
    'vendor_aliases',
    'vendor_locations'
  ];
  
  for (const table of ocrTables) {
    await checkTableDetails(table);
  }
  
  // 4. Generate report
  const report = await generateReport();
  console.log(report);
  
  return result;
}
```

## PR Template Addition
```markdown
### OCR Migration Checklist
- [ ] Ran `npm run ocr:preflight` and included output
- [ ] All dependency tables verified
- [ ] Migration uses IF NOT EXISTS patterns
- [ ] Migration uses DO blocks for policies
- [ ] No DROP or destructive operations
```

## Rollback
- Preflight is read-only
- No changes to make