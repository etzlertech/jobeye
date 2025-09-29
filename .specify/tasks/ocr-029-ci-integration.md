# Task: OCR CI Pipeline Integration

**Slug:** `ocr-029-ci-integration`
**Priority:** High
**Size:** 1 PR

## Description
Integrate OCR tests and checks into CI pipeline with proper ordering and gates.

## Files to Create
- `.github/workflows/ocr-ci.yml`
- `scripts/ci/ocr-migration-check.sh`

## Files to Modify
- `.github/workflows/pull-request.yml` - Add OCR checks
- `.github/CODEOWNERS` - Add OCR domain owners

## Acceptance Criteria
- [ ] Runs preflight check for OCR migrations
- [ ] Runs OCR unit tests
- [ ] Runs OCR integration tests
- [ ] Checks OCR domain coverage ≥80%
- [ ] Runs RLS tests for OCR tables
- [ ] Blocks merge on failures
- [ ] Parallel test execution
- [ ] Commit and push immediately

## Test Files
**Create:** `src/__tests__/ci/ocr-pipeline.test.ts`

Test cases:
- `validates CI configuration`
  - Parse workflow file
  - Assert all jobs defined
  - Assert proper dependencies
  
- `ensures test coverage`
  - Run coverage check
  - Assert ≥80% for OCR domain
  - Assert no untested files

## Dependencies
- All OCR tests must exist
- GitHub Actions

## CI Workflow
```yaml
name: OCR CI
on:
  pull_request:
    paths:
      - 'src/domains/ocr/**'
      - 'supabase/migrations/*ocr*.sql'
      - 'supabase/migrations/*vendor*.sql'

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: OCR Preflight Check
        run: npm run ocr:preflight
        
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Run OCR unit tests
        run: npm test -- src/domains/ocr --coverage
      - name: Check coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80%"
            exit 1
          fi
          
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: supabase/postgres:14
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - name: Run OCR integration tests
        run: npm run test:integration -- --testNamePattern="ocr"
        
  rls-tests:
    runs-on: ubuntu-latest
    needs: preflight
    steps:
      - name: Run OCR RLS tests
        run: npm run test:rls -- ocr_jobs ocr_documents
```

## CODEOWNERS
```
# OCR Domain
/src/domains/ocr/ @ocr-team
/supabase/migrations/*ocr*.sql @ocr-team @db-team
/supabase/migrations/*vendor*.sql @ocr-team
```

## Rollback
- CI changes are isolated
- Revert workflow file if needed