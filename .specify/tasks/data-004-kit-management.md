# Task: Kit Management Tables

**Slug:** `data-004-kit-management`
**Priority:** Medium
**Size:** 1 PR

## Description
Create kit management system with predefined equipment lists, container rules, and seasonal variations.

## Files to Create
- `supabase/migrations/012_kit_management.sql`
- `src/domains/inventory/services/kit-service.ts`
- `src/domains/inventory/config/default-kits.ts`

## Files to Modify
- `src/domains/job/services/job-load-list-service.ts` - Apply kits

## Acceptance Criteria
- [ ] Creates job_kits table with equipment lists
- [ ] Creates container_rules for auto-assignment
- [ ] Supports seasonal kit variations
- [ ] Seeds default small/large yard kits
- [ ] Applies container rules (chemicals→locked bin)
- [ ] Activates seasonal items by date

## Test Files
**Create:** `src/__tests__/domains/inventory/services/kit-service.test.ts`

Test cases:
- `applies kit to job`
  - Select "Small Yard Kit"
  - Assert adds mower, trimmer, blower
  - Assert quantities correct
  
- `enforces container rules`
  - Add chemicals to job
  - Assert assigned to locked_bin
  - Add mower
  - Assert assigned to trailer
  
- `activates seasonal items`
  - Set date to November
  - Apply kit
  - Assert leaf blower added
  - Set date to July
  - Assert no leaf blower

## Dependencies
- Existing: containers, inventory tables

## Database Schema
```sql
-- Migration: 012_kit_management.sql
-- Job kits
CREATE TABLE job_kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, name)
);

-- Kit items
CREATE TABLE kit_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id UUID NOT NULL REFERENCES job_kits(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_model TEXT,
  quantity INTEGER DEFAULT 1,
  is_optional BOOLEAN DEFAULT false
);

-- Container assignment rules
CREATE TABLE container_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  item_type TEXT NOT NULL,
  container_type TEXT NOT NULL,
  priority INTEGER DEFAULT 1,
  fallback_container TEXT,
  
  UNIQUE(company_id, item_type)
);

-- Seasonal variations
CREATE TABLE kit_seasonal_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id UUID NOT NULL REFERENCES job_kits(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active_months INTEGER[] NOT NULL, -- [10, 11] for Oct-Nov
  item_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1
);

-- RLS policies
ALTER TABLE job_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_kits_tenant_isolation" ON job_kits
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');
  
CREATE POLICY "container_rules_tenant_isolation" ON container_rules
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');

-- Function to apply kit
CREATE OR REPLACE FUNCTION apply_kit_to_job(
  p_job_id UUID,
  p_kit_id UUID
) RETURNS SETOF kit_items AS $$
DECLARE
  v_current_month INTEGER := EXTRACT(MONTH FROM NOW());
BEGIN
  -- Add regular kit items
  RETURN QUERY
  SELECT * FROM kit_items WHERE kit_id = p_kit_id;
  
  -- Add seasonal items if active
  RETURN QUERY
  SELECT NULL::UUID, kit_id, item_type, NULL, quantity, false
  FROM kit_seasonal_items
  WHERE kit_id = p_kit_id
    AND v_current_month = ANY(active_months);
END;
$$ LANGUAGE plpgsql;
```

## Default Data
```typescript
// src/domains/inventory/config/default-kits.ts
export const DEFAULT_CONTAINER_RULES = [
  { itemType: 'chemicals', container: 'locked_bin', priority: 1 },
  { itemType: 'gas_cans', container: 'truck_bed_rack', priority: 1 },
  { itemType: 'mower', container: 'trailer', fallback: 'lowboy', priority: 2 }
];

export const SEASONAL_ITEMS = {
  leaf_season: {
    months: [10, 11], // October, November
    items: [
      { type: 'bagger', quantity: 1 },
      { type: 'mulcher', quantity: 1 }
    ]
  }
};
```