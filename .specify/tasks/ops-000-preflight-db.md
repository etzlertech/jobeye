# Task: Database Preflight Check Runner

**Slug:** `ops-000-preflight-db`
**Priority:** Critical
**Size:** Reusable

## Description
Reusable operational task to inspect actual database state before any migration or schema work.

## Files to Create
- `scripts/check-actual-db.ts` (if not exists)
- `scripts/db-preflight-report.ts`
- `docs/db-preflight-guide.md`

## Files to Modify
- `.env.example` - Add required DB vars
- `package.json` - Add preflight scripts

## Acceptance Criteria
- [ ] Connects to actual Supabase database
- [ ] Lists all tables with row counts
- [ ] Shows columns with types for each table
- [ ] Lists all indexes and constraints
- [ ] Shows RLS policies per table
- [ ] Identifies missing expected tables
- [ ] Generates markdown report
- [ ] Exits with error if connection fails

## Test Files
**Create:** `src/__tests__/scripts/db-preflight.test.ts`

Test cases:
- `connects to test database`
- `generates complete report`
- `handles connection errors`
- `detects schema drift`

## Dependencies
- Supabase service role key
- Direct database connection string

## Preflight Script
```typescript
// scripts/check-actual-db.ts structure
interface DbPreflightReport {
  timestamp: string;
  connection: {
    host: string;
    database: string;
    success: boolean;
  };
  tables: TableInfo[];
  missingExpected: string[];
  unexpectedTables: string[];
  policies: PolicyInfo[];
  summary: {
    tableCount: number;
    totalRows: number;
    rlsCoverage: number;
  };
}

interface TableInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
  hasRLS: boolean;
}
```

## Usage Instructions
```bash
# Basic usage
npm run db:preflight

# With specific connection
DATABASE_URL=postgres://... npm run db:preflight

# Output to file
npm run db:preflight > preflight-report.md

# Check specific tables
npm run db:preflight -- --tables users,companies,jobs

# Compare against expected schema
npm run db:preflight -- --compare-with migrations/
```

## Environment Variables
```bash
# Required
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DIRECT_DATABASE_URL=postgres://postgres:[password]@db.[project].supabase.co:5432/postgres

# Optional
DB_PREFLIGHT_TIMEOUT=30000
DB_PREFLIGHT_VERBOSE=true
```

## Report Format
```markdown
# Database Preflight Report
Generated: 2024-01-20T10:30:00Z
Connection: db.project.supabase.co/postgres ✅

## Summary
- Tables: 25
- Total Rows: 15,234
- RLS Coverage: 92% (23/25 tables)

## Tables

### companies (152 rows)
Columns:
- id: uuid (PK)
- name: text (NOT NULL)
- settings: jsonb
- created_at: timestamptz

Indexes:
- companies_pkey (id)
- idx_companies_created_at (created_at)

RLS: ✅ Enabled
Policies:
- tenant_isolation (SELECT, INSERT, UPDATE, DELETE)

### users (1,247 rows)
...

## Missing Expected Tables
⚠️ The following tables exist in migrations but not in database:
- equipment_history
- voice_sessions

## Unexpected Tables
ℹ️ The following tables exist in database but not in migrations:
- _temp_backup_users
- test_data

## Recommendations
1. Create missing tables with reconciler migration
2. Document or remove unexpected tables
3. Add RLS to unprotected tables
```

## Error Handling
```typescript
// Clear error messages
const ERRORS = {
  CONNECTION_FAILED: 'Cannot connect to database. Check DIRECT_DATABASE_URL',
  PERMISSION_DENIED: 'Insufficient permissions. Ensure service role key is used',
  TIMEOUT: 'Query timeout. Database may be under heavy load',
  INVALID_SCHEMA: 'Schema validation failed. See details above'
};

// Exit codes
process.exit(0); // Success
process.exit(1); // Connection error
process.exit(2); // Permission error
process.exit(3); // Schema issues found
```

## Integration Points
- Called by CI before migration runs
- Required in PR template checklist
- Used by reconciler migration task
- Part of deployment pipeline