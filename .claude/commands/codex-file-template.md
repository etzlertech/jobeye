# CODEX File Creation Template

## Purpose
Ensure all files created by CODEX follow the constitution and include proper directive blocks.

## TypeScript File Template
```typescript
/**
 * AGENT DIRECTIVE BLOCK
 * @file /src/domains/[domain]/[filename].ts
 * @phase 3
 * @domain SchedulingKits
 * @purpose [Brief description]
 * @spec_ref .specify/features/003-scheduling-kits.md
 * @complexity_budget 300
 * @test_requirements
 *   coverage: ≥90%
 *   test_file: tests/[path]/[filename].test.ts
 * @dependencies
 *   internal: []
 *   external: []
 *   supabase: []
 * @exports
 *   - [ExportedFunction/Class]
 * @voice_considerations
 *   - [Voice interaction notes]
 * @offline_capability REQUIRED
 * @state_machine [If applicable]
 * @tasks
 *   - [ ] Task 1
 *   - [ ] Task 2
 */

// Implementation here (max 300 lines)
```

## Test File Template
```typescript
/**
 * @file /tests/[path]/[filename].test.ts
 * @purpose Tests for [component]
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('[Component]', () => {
  beforeEach(() => {
    // Setup
  });

  it('should [behavior]', () => {
    // Test should FAIL first (TDD)
    expect(true).toBe(false);
  });
});
```

## Migration File Template
```sql
-- Migration: 003_[description].sql
-- Phase: 3 (Scheduling & Kits)
-- Purpose: [Description]

-- ALWAYS CHECK ACTUAL DB STATE FIRST!
-- Run: npm run check:db-actual

-- Idempotent single statements only
CREATE TABLE IF NOT EXISTS table_name (
  -- columns
);

-- RLS policies
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation" ON table_name
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');
```