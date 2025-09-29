# Task: CI Migration Ordering and Shadow DB Testing

**Slug:** `data-rls-007-ci-ordering-and-shadow-db`
**Priority:** Critical
**Size:** 1 PR

## Description
Define CI jobs that apply migrations in correct dependency order and test against a shadow database.

## Files to Create
- `.github/workflows/database-ci.yml`
- `scripts/ci/apply-migrations-ordered.sh`
- `scripts/ci/shadow-db-test.ts`
- `supabase/tests/rls.test.sql`

## Files to Modify
- `.github/workflows/pull-request.yml` - Add DB checks
- `package.json` - Add CI scripts

## Acceptance Criteria
- [ ] Migrations apply in dependency order
- [ ] Shadow DB created fresh for each PR
- [ ] RLS tests run with pgtap
- [ ] Failures block PR merge
- [ ] Clear error messages on failure
- [ ] Cleanup shadow DB after tests
- [ ] Parallel test execution

## Test Files
**Create:** `src/__tests__/ci/migration-order.test.ts`

Test cases:
- `validates migration order`
  - Parse migration files
  - Check dependency declarations
  - Assert correct ordering
  
- `detects circular dependencies`
  - Analyze migration graph
  - Assert no cycles
  
- `handles missing dependencies`
  - Remove required extension
  - Assert clear error

## Dependencies
- GitHub Actions runners with Postgres
- Supabase CLI for local testing

## CI Configuration
```yaml
# .github/workflows/database-ci.yml
name: Database CI
on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
      - 'supabase/tests/**'

jobs:
  migration-order:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        run: |
          curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xz
          sudo mv supabase /usr/local/bin/
      
      - name: Apply Migrations in Order
        run: |
          ./scripts/ci/apply-migrations-ordered.sh
        env:
          DATABASE_URL: ${{ secrets.SHADOW_DB_URL }}
          
  shadow-db-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:14.1.0
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
          
    steps:
      - uses: actions/checkout@v3
      
      - name: Create Shadow Database
        run: |
          PGPASSWORD=postgres createdb -h localhost -U postgres shadow_test
          
      - name: Apply Reconciler
        run: |
          psql -h localhost -U postgres -d shadow_test -f supabase/migrations/009_reconcile_schema.sql
        env:
          PGPASSWORD: postgres
          
      - name: Run RLS Tests
        run: |
          npm run test:rls:ci
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost/shadow_test
          
      - name: Cleanup
        if: always()
        run: |
          PGPASSWORD=postgres dropdb -h localhost -U postgres shadow_test
```

## Migration Order Script
```bash
#!/bin/bash
# scripts/ci/apply-migrations-ordered.sh

set -euo pipefail

echo "Applying migrations in order..."

# 1. Extensions
for file in supabase/migrations/*_extensions.sql; do
  [ -f "$file" ] && psql $DATABASE_URL -f "$file" || true
done

# 2. Core schema
for file in supabase/migrations/*_schema.sql; do
  [ -f "$file" ] && psql $DATABASE_URL -f "$file" || true
done

# 3. Partitions
for file in supabase/migrations/*_partitions.sql; do
  [ -f "$file" ] && psql $DATABASE_URL -f "$file" || true
done

# 4. RLS policies
for file in supabase/migrations/*_rls.sql; do
  [ -f "$file" ] && psql $DATABASE_URL -f "$file" || true
done

# 5. Functions and views
for file in supabase/migrations/*_functions.sql; do
  [ -f "$file" ] && psql $DATABASE_URL -f "$file" || true
done

# 6. Apply reconciler last
psql $DATABASE_URL -f supabase/migrations/009_reconcile_schema.sql

echo "✅ All migrations applied successfully"
```

## NPM Scripts
```json
{
  "scripts": {
    "test:rls:ci": "pg_prove -d $DATABASE_URL supabase/tests/*.test.sql",
    "db:shadow:create": "tsx scripts/ci/shadow-db-test.ts create",
    "db:shadow:test": "tsx scripts/ci/shadow-db-test.ts test",
    "db:shadow:destroy": "tsx scripts/ci/shadow-db-test.ts destroy"
  }
}
```

## Environment Variables
```bash
# Required secrets in GitHub
SHADOW_DB_URL=postgres://user:pass@host:5432/shadow_db
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_URL=https://project.supabase.co

# CI environment
NODE_ENV=ci
CI=true
```

## Failure Handling
- Migration errors show full SQL context
- RLS test failures include policy details
- Shadow DB logs preserved as artifacts
- Slack notification on failure
- Automatic rollback attempt