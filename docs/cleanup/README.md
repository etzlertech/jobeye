# JobEye Codebase Cleanup Documentation

## Overview

This documentation covers the comprehensive codebase cleanup and refactoring system implemented in Feature 009. The cleanup system addresses tenant isolation standardization, repository pattern consolidation, orphaned table removal, and pattern enforcement.

## Quick Start

### Prerequisites
- Node.js 18+
- Access to Supabase database
- Environment variables configured in `.env.local`

### Initial Analysis
```bash
# Run complete database and code analysis
npm run cleanup:full-analysis

# Check individual components
npm run cleanup:analyze-schema
npm run cleanup:analyze-code  
npm run cleanup:find-orphaned
```

### Migration Workflow
```bash
# 1. Migrate tables from company_id to tenant_id
npm run cleanup:migrate-tenant

# 2. Update RLS policies 
npm run cleanup:update-rls

# 3. Convert repository patterns
npm run cleanup:convert-repos

# 4. Remove orphaned tables (with approval)
npm run cleanup:remove-orphaned --approval-file approved-removals.txt
```

## Repository Patterns

### Current Standard: Class-Based Repositories

All repositories must extend `BaseRepository` and follow this pattern:

```typescript
import { BaseRepository } from '@/core/repositories/base.repository';
import { SupabaseClient } from '@supabase/supabase-js';

export class UserRepository extends BaseRepository {
  constructor(client: SupabaseClient) {
    super(client, 'users');
  }

  async findByEmail(email: string) {
    return this.client
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .single();
  }
}
```

### Migration from Functional Pattern

**Before (Functional - Deprecated):**
```typescript
export function createUser(data: any) {
  const client = createClient(url, key);
  return client.from('users').insert(data);
}

export function findUserById(id: string) {
  const client = createClient(url, key);  
  return client.from('users').select('*').eq('id', id).single();
}
```

**After (Class-Based - Required):**
```typescript
export class UserRepository extends BaseRepository {
  constructor(client: SupabaseClient) {
    super(client, 'users');
  }

  async create(data: any) {
    return super.create(data);
  }

  async findById(id: string) {
    return super.findById(id);
  }
}
```

## Tenant Isolation Guidelines

### Database Schema Requirements

All tables must use `tenant_id` for multi-tenant isolation:

```sql
-- ✅ CORRECT
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  data VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ❌ DEPRECATED  
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL, -- Use tenant_id instead
  data VARCHAR(255)
);
```

### RLS Policy Standard

All RLS policies must use the correct JWT path:

```sql
-- ✅ CORRECT
CREATE POLICY tenant_isolation ON example_table
FOR ALL USING (
  tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
);

-- ❌ WRONG PATHS
-- auth.jwt() ->> 'tenant_id'  (doesn't exist)
-- current_setting('app.tenant_id') (wrong format)
```

## Migration Procedures

### Safe Migration Process

1. **Pre-Migration Check** (Required by Constitution Rule 1)
```bash
npm run check:db-actual
```

2. **Backup and Verify**
```bash
# Create backup (automatic in scripts)
npm run cleanup:migrate-tenant --dry-run
```

3. **Execute Migration**
```bash
npm run cleanup:migrate-tenant --table specific_table
```

4. **Verify Results**
```bash
npm run cleanup:analyze-schema
```

### Rollback Procedure

Rollback is only supported within the deployment window (10 minutes by default):

```bash
# Check if rollback is possible
npm run cleanup:rollback --dry-run

# Execute rollback (immediate only)
npm run cleanup:rollback --table specific_table

# Force rollback (bypasses time check)
npm run cleanup:rollback --force
```

## Troubleshooting Guide

### Common Issues

#### 1. Migration Fails with "company_id and tenant_id values do not match"
**Cause:** Data integrity issue during migration
**Solution:** 
```bash
# Check data consistency
SELECT COUNT(*) as total, COUNT(CASE WHEN company_id = tenant_id THEN 1 END) as matching 
FROM your_table;

# Fix inconsistent data before retry
UPDATE your_table SET tenant_id = company_id WHERE tenant_id != company_id;
```

#### 2. RLS Policy Creation Fails
**Cause:** Wrong JWT path or missing tenant_id column
**Solution:**
```bash
# Verify tenant_id exists
npm run check:db-actual | grep tenant_id

# Check current policies
npm run cleanup:update-rls --dry-run
```

#### 3. Repository Conversion Breaks Dependencies
**Cause:** Functional repository consumers not updated
**Solution:**
```bash
# Find dependencies before conversion
npm run cleanup:convert-repos --dry-run

# Update consumers to use class injection
constructor(private userRepo: UserRepository) {}
```

#### 4. ESLint Rules Block Valid Code
**Cause:** False positive pattern detection
**Solution:**
```javascript
// Disable rule for specific line
const companyName = data.company_name; // eslint-disable-line cleanup/no-company-id

// Or for entire file
/* eslint-disable cleanup/no-company-id */
```

#### 5. Orphaned Table Removal Blocked
**Cause:** Missing migration plan approval
**Solution:**
```bash
# Create approval file
echo "table1\ntable2\ntable3" > migration-plan-approval.txt
npm run cleanup:remove-orphaned --approval-file migration-plan-approval.txt
```

#### 6. Schema Verification Fails in CI
**Cause:** Database state doesn't match migration files
**Solution:**
```bash
# Local investigation
npm run cleanup:analyze-schema
npm run check:db-actual

# Apply missing migrations
npm run db:migrate
```

#### 7. Pre-commit Hooks Too Slow
**Cause:** Full codebase scan on every commit
**Solution:**
```bash
# Scan only staged files
npm run cleanup:scan-violations --staged-only

# Skip pattern checks temporarily
git commit --no-verify
```

#### 8. Pattern Scanner False Positives
**Cause:** Complex code patterns not recognized
**Solution:**
```typescript
// Add pattern exclusion
if (filePath.includes('legacy/') || filePath.includes('vendor/')) {
  return; // Skip pattern checking
}
```

#### 9. API Endpoints Return 500 Errors
**Cause:** Database connection or permission issues
**Solution:**
```bash
# Test database connectivity
curl -X GET http://localhost:3000/api/cleanup/schema/verify

# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

#### 10. Large Table Migration Timeout
**Cause:** Too many rows to process in single transaction
**Solution:**
```bash
# Use batch processing
npm run cleanup:migrate-tenant --table large_table --batch-size 1000
```

#### 11. Repository Pattern Detection Errors
**Cause:** Mixed patterns in same file
**Solution:**
```bash
# Analyze specific file
npm run cleanup:convert-repos --file src/domains/example/repo.ts --dry-run

# Manual cleanup required for mixed patterns
```

#### 12. Test Coverage Drops Below 80%
**Cause:** New cleanup code not adequately tested
**Solution:**
```bash
# Check coverage for cleanup modules
npm run test:coverage -- --testPathPattern=cleanup

# Add missing tests for repositories and API endpoints
```

## Architectural Decision Records

### ADR-001: Tenant ID Standardization
**Decision:** Use `tenant_id` consistently across all tables
**Rationale:** Eliminates confusion between company_id/tenant_id mixed usage
**Impact:** All 15 tables with company_id require migration

### ADR-002: Class-Based Repository Pattern
**Decision:** Standardize on class-based repositories extending BaseRepository
**Rationale:** Better dependency injection, testing, and consistency
**Impact:** 8 functional repositories require conversion

### ADR-003: Constitutional DB Precheck Requirement
**Decision:** All migration scripts must run check-actual-db.ts first
**Rationale:** Prevents assumptions about database state
**Impact:** Every migration script includes precheck step

### ADR-004: Idempotent Migration Statements
**Decision:** Use single-statement, idempotent SQL operations
**Rationale:** Safer rollback, no partial failure states
**Impact:** All DROP/CREATE operations use IF EXISTS/IF NOT EXISTS

### ADR-005: Migration Plan Approval Requirement
**Decision:** Orphaned table removal requires explicit approval file
**Rationale:** Prevents accidental data loss
**Impact:** Manual approval step required for table drops

## API Reference

### Schema Verification
```bash
GET /api/cleanup/schema/verify
```
Returns database schema alignment status

### Migration Management
```bash
GET /api/cleanup/migration/status[?status=pending]
POST /api/cleanup/migration/execute
```
Monitor and execute table migrations

### Pattern Analysis
```bash
GET /api/cleanup/patterns/violations[?type=company_id_usage&fixed=false]
POST /api/cleanup/patterns/scan
```
Analyze and scan for deprecated code patterns

### Table Management
```bash
GET /api/cleanup/tables/orphaned
```
List tables marked for removal

## Performance Considerations

- **Migration Duration:** < 5 minutes per table (target)
- **Pattern Scanning:** Uses TypeScript AST parsing for accuracy
- **API Response Times:** < 2 seconds for status endpoints
- **Database Impact:** Migrations preserve all existing data
- **Memory Usage:** Batch processing prevents memory exhaustion

## Monitoring and Validation

### Continuous Monitoring
- Pre-commit hooks prevent pattern regression
- CI/CD verifies schema alignment on database changes
- ESLint rules catch new violations immediately

### Validation Commands
```bash
# Full system validation
npm run test:coverage  # Must maintain ≥80%
npm run cleanup:full-analysis
npm run lint:directives

# Specific validation
npm run test:integration -- --testPathPattern=cleanup
```

## Contributing

When adding new cleanup functionality:

1. Follow TDD - write tests first
2. Respect complexity budgets (300 LoC default)
3. Include voice considerations in user-facing features
4. Update this documentation
5. Add npm scripts for new capabilities
6. Ensure constitutional compliance (DB precheck, idempotent operations)

## Support

For cleanup-related issues:
- Check this troubleshooting guide first
- Run diagnostic commands
- Review recent migration history
- Consult architectural decision records

---

**Last Updated:** $(date)
**Version:** 1.0.0
**Feature:** 009-codebase-cleanup-and