# Task: Template System with Copy-on-Write

**Slug:** `data-003-template-system`
**Priority:** Medium
**Size:** 1 PR

## Description
Implement global templates with copy-on-write semantics for company customization.

## Files to Create
- `supabase/migrations/011_template_system.sql`
- `src/lib/repositories/template.repository.ts`
- `src/domains/templates/services/template-service.ts`

## Files to Modify
- None (new functionality)

## Acceptance Criteria
- [ ] Creates global_templates table (read-only)
- [ ] Creates company_templates table with RLS
- [ ] Implements clone_template_to_company() function
- [ ] Tracks parent template reference
- [ ] Prevents edits to global templates
- [ ] Auto-clones on first edit attempt

## Test Files
**Create:** `src/__tests__/lib/repositories/template.repository.test.ts`

Test cases:
- `reads global templates`
  - List all global templates
  - Assert read successful
  - Assert no write permission
  
- `clones template on edit`
  - Attempt to edit global template
  - Assert clone created
  - Assert edit applied to clone
  - Assert parent reference maintained
  
- `isolates company templates`
  - Company A edits template
  - Company B reads same template
  - Assert B sees original
  - Assert A sees edited version

## Dependencies
- Existing: companies table, RLS patterns

## Database Schema
```sql
-- Migration: 011_template_system.sql
-- Global templates (system-wide, read-only)
CREATE TABLE global_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('job', 'checklist', 'kit', 'report')),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company-specific templates
CREATE TABLE company_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_template_id UUID REFERENCES global_templates(id),
  type TEXT NOT NULL CHECK (type IN ('job', 'checklist', 'kit', 'report')),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, name, type)
);

-- RLS for company templates only
ALTER TABLE company_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_templates_tenant_isolation" ON company_templates
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');

-- No RLS on global templates (read-only for all)
GRANT SELECT ON global_templates TO authenticated;

-- Clone function
CREATE OR REPLACE FUNCTION clone_template_to_company(
  p_template_id UUID,
  p_company_id UUID DEFAULT auth.jwt() ->> 'company_id'
) RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
BEGIN
  INSERT INTO company_templates (
    company_id, parent_template_id, type, name, 
    description, template_data
  )
  SELECT 
    p_company_id, id, type, name,
    description, template_data
  FROM global_templates
  WHERE id = p_template_id
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed some default templates
INSERT INTO global_templates (type, name, template_data) VALUES
  ('kit', 'Small Yard Kit', '{"items": [{"type": "mower", "model": "push"}, {"type": "trimmer"}, {"type": "blower"}]}'::jsonb),
  ('kit', 'Large Yard Kit', '{"items": [{"type": "mower", "model": "zero-turn"}, {"type": "mower", "model": "push"}, {"type": "trimmer", "quantity": 2}]}'::jsonb),
  ('checklist', 'Lawn Service', '{"steps": ["Mow grass", "Edge walkways", "Blow debris", "Check sprinklers"]}'::jsonb);
```

## Usage Pattern
```typescript
// Service attempts to edit global template
const template = await templateRepo.findById(id);
if (template.isGlobal) {
  // Auto-clone to company
  const clonedId = await templateRepo.cloneToCompany(id);
  // Apply edits to clone
  await templateRepo.update(clonedId, changes);
}
```