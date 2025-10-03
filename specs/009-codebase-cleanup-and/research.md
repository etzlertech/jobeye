# Research: Codebase Cleanup and Refactoring

**Feature**: 009-codebase-cleanup-and | **Date**: 2025-10-03

## Overview
This research document consolidates findings on safe migration patterns, repository consolidation strategies, and cleanup approaches for the JobEye codebase refactoring.

## Research Tasks & Findings

### 1. Safe tenant_id Migration Patterns for Supabase

**Decision**: Use transactional migrations with column aliasing
**Rationale**: 
- Allows zero-downtime migration
- Maintains backward compatibility during transition
- Supabase RPC method ensures reliable execution

**Approach**:
```sql
-- Step 1: Add tenant_id column (if not exists)
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Step 2: Copy data from company_id to tenant_id
UPDATE table_name SET tenant_id = company_id WHERE tenant_id IS NULL;

-- Step 3: Update RLS policies to use tenant_id
DROP POLICY IF EXISTS "old_policy" ON table_name;
CREATE POLICY "tenant_isolation" ON table_name
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );

-- Step 4: Drop company_id column (after code deployment)
ALTER TABLE table_name DROP COLUMN company_id;
```

**Alternatives considered**:
- Direct rename: Rejected due to potential downtime
- View-based approach: Rejected due to RLS complexity
- Dual column maintenance: Rejected due to data sync issues

### 2. Repository Consolidation Best Practices

**Decision**: Incremental refactoring with interface preservation
**Rationale**:
- Minimizes breaking changes
- Allows parallel development
- Maintains test coverage during transition

**Approach**:
1. Create base repository class with standard interface
2. Implement adapter pattern for functional repositories
3. Gradually migrate consumers to new pattern
4. Remove legacy implementations once all consumers updated

**Pattern**:
```typescript
// Base class
export abstract class BaseRepository<T> {
  constructor(protected supabase: SupabaseClient) {}
  abstract findById(id: string): Promise<T | null>;
  abstract findAll(filters?: any): Promise<T[]>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;
}

// Migration adapter
export class FunctionalRepoAdapter extends BaseRepository<Entity> {
  async findById(id: string) {
    return await legacyFindById(this.supabase, id);
  }
  // ... other methods
}
```

**Alternatives considered**:
- Big bang refactor: Rejected due to high risk
- Parallel implementations: Rejected due to maintenance burden
- Automated code transformation: Rejected due to edge case handling

### 3. Orphaned Table Detection and Removal

**Decision**: Code reference analysis with safe removal
**Rationale**:
- Prevents accidental removal of staged features
- Respects AaC investment
- Maintains feature flags and future work

**Approach**:
1. Scan codebase for table references using AST
2. Check for migration files mentioning tables
3. Verify no TypeScript types reference tables
4. Create backup before removal
5. Use DROP TABLE IF EXISTS for safety

**Detection query**:
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT DISTINCT jsonb_object_keys(to_jsonb(table_references))
    FROM code_analysis_results
  )
ORDER BY tablename;
```

**Alternatives considered**:
- Foreign key analysis only: Rejected as insufficient
- Row count based: Rejected as tables may be pre-staged
- Age-based removal: Rejected as creation time unreliable

### 4. ESLint Rule Creation for Pattern Prevention

**Decision**: Custom ESLint plugin with auto-fix
**Rationale**:
- Provides immediate developer feedback
- Can automatically fix violations
- Integrates with existing toolchain

**Rules to implement**:
```javascript
module.exports = {
  rules: {
    'no-company-id': {
      create(context) {
        return {
          Identifier(node) {
            if (node.name === 'companyId' || node.name === 'company_id') {
              context.report({
                node,
                message: 'Use tenantId instead of companyId',
                fix(fixer) {
                  return fixer.replaceText(node, 
                    node.name.replace(/company/i, 'tenant')
                  );
                }
              });
            }
          }
        };
      }
    },
    'repository-class-pattern': {
      create(context) {
        return {
          ExportNamedDeclaration(node) {
            if (node.declaration?.type === 'FunctionDeclaration' &&
                node.declaration.id?.name?.endsWith('Repository')) {
              context.report({
                node,
                message: 'Repositories must be classes, not functions'
              });
            }
          }
        };
      }
    }
  }
};
```

**Alternatives considered**:
- TSLint rules: Rejected as TSLint is deprecated
- Regex-based pre-commit: Rejected as less flexible
- Runtime validation: Rejected as too late in cycle

## Migration Safety Considerations

### Data Integrity
- All migrations must be wrapped in transactions
- Each migration must be idempotent (safe to run multiple times)
- Test data (692 rows) must be preserved throughout

### Rollback Strategy
- Keep backup of all DROP operations
- Maintain migration reversal scripts
- Test rollback procedures before production

### Performance Impact
- Run migrations during low-traffic periods
- Use CONCURRENTLY for index operations
- Monitor query performance after RLS changes

## Recommended Execution Order

1. **Analysis Phase** (Parallel)
   - Code reference scanning
   - Database schema analysis
   - Pattern violation detection

2. **Preparation Phase** (Parallel)
   - Create migration scripts
   - Setup ESLint rules
   - Create base repository class

3. **Execution Phase** (Sequential)
   - Apply tenant_id migrations
   - Consolidate repositories
   - Remove orphaned tables
   - Seed empty tables

4. **Validation Phase**
   - Run schema verification
   - Execute test suite
   - Verify no company_id references

## Risk Mitigation

### High Risk Items
- **RLS Policy Changes**: Test with multiple tenant contexts
- **Table Removal**: Verify no runtime dependencies
- **Repository Changes**: Maintain backward compatibility

### Medium Risk Items
- **ESLint Rules**: May produce many warnings initially
- **Test Data Seeding**: Ensure realistic test scenarios

### Low Risk Items
- **Documentation Updates**: No runtime impact
- **Pre-commit Hooks**: Developer tooling only

## Success Metrics

- Zero company_id references in codebase
- All repositories follow class pattern
- No orphaned tables remain (or documented if kept)
- 100% of empty tables with implementations are seeded
- CI/CD catches any regression attempts

## Conclusion

This cleanup will significantly improve codebase consistency and reduce technical debt. The incremental approach minimizes risk while the automated guards prevent regression. The constitution's emphasis on tenant isolation and clean patterns is fully supported by these approaches.