# Quickstart: Codebase Cleanup and Refactoring

**Feature**: 009-codebase-cleanup-and | **Duration**: ~30 minutes

## Overview
This guide walks through executing the codebase cleanup to standardize patterns, migrate tenant isolation, and remove technical debt.

## Prerequisites

- Node.js 18+ and npm installed
- Access to JobEye repository
- Supabase credentials in `.env.local`
- Git configured with push access

## Step 1: Initial Setup (5 min)

1. **Checkout cleanup branch**
   ```bash
   git checkout 009-codebase-cleanup-and
   git pull origin 009-codebase-cleanup-and
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm install --save-dev @jobeye/eslint-plugin-cleanup
   ```

3. **Verify environment**
   ```bash
   # Check Supabase connection
   npm run check:db-actual
   
   # Should output table list including company_id tables
   ```

## Step 2: Pre-Cleanup Analysis (5 min)

1. **Run pattern violation scan**
   ```bash
   npm run cleanup:scan
   
   # Expected output:
   # Found 15 tables using company_id
   # Found 127 orphaned tables
   # Found 7 functional repositories
   # Found 50+ files with companyId references
   ```

2. **Verify current test coverage**
   ```bash
   npm run test:coverage
   
   # Should show ≥80% line coverage
   ```

## Step 3: Execute Tenant Migration (10 min)

1. **Run migration analysis**
   ```bash
   npm run cleanup:analyze-migrations
   
   # Lists all tables needing tenant_id migration
   ```

2. **Execute migrations (with backup)**
   ```bash
   # Create backup first
   npm run cleanup:backup
   
   # Run migrations
   npm run cleanup:migrate-tenant
   
   # Expected: 15 tables migrated from company_id to tenant_id
   ```

3. **Verify migration success**
   ```bash
   npm run cleanup:verify-tenant
   
   # Should show: "All tables use tenant_id ✓"
   ```

## Step 4: Repository Consolidation (5 min)

1. **Convert functional repositories**
   ```bash
   npm run cleanup:convert-repos
   
   # Converts 7 functional repositories to class-based
   ```

2. **Remove duplicate container repository**
   ```bash
   npm run cleanup:dedupe-containers
   
   # Removes inventory/repositories/container-assignments.repository.ts
   # Updates all imports automatically
   ```

## Step 5: Orphaned Table Cleanup (5 min)

1. **Analyze orphaned tables**
   ```bash
   npm run cleanup:analyze-orphaned
   
   # Shows which tables have code references
   ```

2. **Remove truly orphaned tables**
   ```bash
   npm run cleanup:remove-orphaned --dry-run
   
   # Review list, then run without --dry-run
   npm run cleanup:remove-orphaned
   ```

3. **Seed empty tables with implementations**
   ```bash
   npm run cleanup:seed-empty
   
   # Seeds containers, container_assignments with test data
   ```

## Step 6: Enable Pattern Guards (5 min)

1. **Update ESLint configuration**
   ```bash
   npm run cleanup:setup-eslint
   
   # Adds rules to .eslintrc.js
   ```

2. **Setup pre-commit hooks**
   ```bash
   npm run cleanup:setup-hooks
   
   # Configures husky pre-commit
   ```

3. **Fix existing violations**
   ```bash
   npm run cleanup:fix-violations
   
   # Auto-fixes company_id → tenant_id references
   ```

## Step 7: Final Validation (5 min)

1. **Run comprehensive tests**
   ```bash
   npm run test:all
   npm run test:rls
   npm run test:coverage
   
   # All should pass with ≥80% coverage
   ```

2. **Verify schema alignment**
   ```bash
   npm run cleanup:verify-all
   
   # Checklist:
   # ✓ No company_id columns remain
   # ✓ All repositories are class-based
   # ✓ No orphaned tables without documentation
   # ✓ Empty tables are seeded
   # ✓ ESLint rules active
   # ✓ Pre-commit hooks installed
   ```

3. **Check for regressions**
   ```bash
   npm run cleanup:scan
   
   # Should show: "No violations found ✓"
   ```

## Success Criteria

After completing all steps, verify:

- [ ] `grep -r "company_id\|companyId" src/` returns no results
- [ ] All tests pass with ≥80% coverage
- [ ] CI/CD pipeline passes all checks
- [ ] No TypeScript errors
- [ ] Database schema matches codebase expectations

## Troubleshooting

### Migration Fails
```bash
# Check error details
npm run cleanup:migration-status

# Rollback if needed
npm run cleanup:rollback
```

### Tests Fail After Cleanup
```bash
# Update test fixtures
npm run cleanup:update-fixtures

# Re-run specific test suite
npm run test -- --testPathPattern=affected-test
```

### ESLint Overwhelmed
```bash
# Fix incrementally by directory
npm run lint:fix -- src/domains/inventory
npm run lint:fix -- src/domains/equipment
```

## Next Steps

1. **Commit and push changes**
   ```bash
   git add .
   git commit -m "feat: complete codebase cleanup

   - Migrated all tables to tenant_id
   - Consolidated repository patterns
   - Removed 127 orphaned tables
   - Added pattern prevention guards"
   
   git push origin 009-codebase-cleanup-and
   ```

2. **Create pull request**
   ```bash
   gh pr create --title "Codebase Cleanup: Standardize Patterns" \
     --body "Implements comprehensive cleanup per spec 009"
   ```

3. **Monitor production**
   - Watch for any RLS policy issues
   - Monitor query performance
   - Check error logs for deprecated patterns

## Summary

This cleanup improves codebase consistency by:
- ✅ Standardizing tenant isolation
- ✅ Removing duplicate implementations  
- ✅ Cleaning up unused database tables
- ✅ Preventing pattern regression

The automated guards ensure these improvements persist over time.