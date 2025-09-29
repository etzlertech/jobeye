# Task: Add OCR Settings to Company Settings

**Slug:** `ocr-004-company-settings-ocr`
**Priority:** High
**Size:** 1 PR

## Description
Extend company_settings with OCR budget limits and preferences using reconciler pattern.

## Pre-Requirements
**MANDATORY**: Run actual DB check before starting:
```bash
npm run db:check:actual > db-state-company-settings-$(date +%Y%m%d).txt
# Verify company_settings table structure
# Check existing budget_limits JSONB content
```

## Files to Create
- `supabase/migrations/017_company_settings_ocr.sql`

## Files to Modify
- `src/domains/company/types/company-settings.ts` - Add OCR types
- `src/lib/database.types.ts` - Regenerate

## Acceptance Criteria
- [ ] Runs db:check:actual first
- [ ] Updates budget_limits JSONB with OCR fields
- [ ] Adds ocr_preferences JSONB column if missing
- [ ] Preserves existing settings data
- [ ] Updates all existing companies
- [ ] Defaults: 100 pages/day, $5/day budget
- [ ] Commit and push immediately

## Test Files
**Create:** `src/__tests__/domains/company/company-settings-ocr.test.ts`

Test cases:
- `adds OCR settings to existing company`
  - Get company with existing settings
  - Assert OCR fields added
  - Assert other settings preserved
  
- `respects OCR budget limits`
  - Set daily limit to $1
  - Track $1.50 in costs
  - Assert budget check fails

## Dependencies
- Company settings table must exist

## Migration Pattern
```sql
-- Add OCR to budget_limits
DO $$
BEGIN
  UPDATE company_settings 
  SET budget_limits = 
    CASE 
      WHEN budget_limits IS NULL THEN 
        '{"ocr_pages_daily": 100, "ocr_cost_daily": 5.00}'::jsonb
      WHEN NOT (budget_limits ? 'ocr_pages_daily') THEN
        budget_limits || '{"ocr_pages_daily": 100, "ocr_cost_daily": 5.00}'::jsonb
      ELSE 
        budget_limits
    END;
END $$;

-- Add ocr_preferences column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' 
    AND column_name = 'ocr_preferences'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN ocr_preferences JSONB DEFAULT '{
      "auto_process": true,
      "require_confirmation": true,
      "default_vendor_radius_meters": 100,
      "retention_days": 90
    }'::jsonb;
  END IF;
END $$;
```

## Rollback
- Remove OCR keys from JSONB
- Feature flag disables functionality