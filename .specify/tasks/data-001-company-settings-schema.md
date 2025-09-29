# Task: Company Settings Schema

**Slug:** `data-001-company-settings-schema`
**Priority:** High
**Size:** 1 PR

## Description
Add company settings table with vision thresholds, voice preferences, and budget limits.

## Files to Create
- `supabase/migrations/009_company_settings.sql`
- `src/lib/repositories/company-settings.repository.ts`
- `src/domains/company/types/company-settings.ts`

## Files to Modify
- `src/lib/database.types.ts` - Regenerate after migration

## Acceptance Criteria
- [ ] Creates company_settings table with RLS
- [ ] Stores vision thresholds as JSONB
- [ ] Stores voice preferences as JSONB
- [ ] Stores budget limits by service
- [ ] Seeds default settings for existing companies
- [ ] One-to-one relationship with companies table

## Test Files
**Create:** `src/__tests__/lib/repositories/company-settings.repository.test.ts`

Test cases:
- `creates default settings for company`
  - Create new company
  - Assert settings auto-created
  - Assert defaults applied
  
- `updates vision thresholds`
  - Update confidence to 0.8
  - Assert persisted
  - Assert other settings unchanged
  
- `enforces RLS isolation`
  - Try to read other company settings
  - Assert access denied
  - Read own company settings
  - Assert success

## Dependencies
- Existing: companies table

## Database Schema
```sql
-- Migration: 009_company_settings.sql
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Vision settings
  vision_thresholds JSONB DEFAULT '{
    "confidenceThreshold": 0.7,
    "maxObjects": 20,
    "checkExpectedItems": true
  }'::jsonb,
  
  -- Voice settings  
  voice_preferences JSONB DEFAULT '{
    "wakeWord": "Hey JobEye",
    "voiceName": "Google US English",
    "speechRate": 1.0,
    "confirmationRequired": true
  }'::jsonb,
  
  -- Budget limits (daily, in USD)
  budget_limits JSONB DEFAULT '{
    "stt": 10.00,
    "tts": 5.00,
    "vlm": 25.00,
    "llm": 50.00
  }'::jsonb,
  
  -- Feature flags
  features JSONB DEFAULT '{
    "offlineMode": true,
    "visionVerification": true,
    "voiceCommands": true
  }'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_settings_tenant_isolation" ON company_settings
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');

-- Auto-create settings trigger
CREATE OR REPLACE FUNCTION create_default_company_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO company_settings (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_company_settings
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_company_settings();
```