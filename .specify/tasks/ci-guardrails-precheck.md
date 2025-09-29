# Task: CI Guardrails for Migration Prechecks

**Slug:** `ci-guardrails-precheck`
**Priority:** Critical
**Size:** 1 PR

## Description
Enforce CI rules that require database precheck documentation when migrations are modified.

## Files to Create
- `.github/workflows/migration-guardrails.yml`
- `scripts/ci/check-migration-compliance.ts`
- `.github/PULL_REQUEST_TEMPLATE/migration.md`

## Files to Modify
- `.github/workflows/pull-request.yml` - Add guardrail job

## Acceptance Criteria
- [ ] Detects when PR modifies migration files
- [ ] Checks for required precheck tasks in PR
- [ ] Validates PR description references tasks
- [ ] Blocks merge if requirements not met
- [ ] Provides clear remediation steps
- [ ] Allows override with admin approval
- [ ] Generates compliance report

## Test Files
**Create:** `src/__tests__/ci/guardrails.test.ts`

Test cases:
- `detects migration changes`
  - Mock PR with migration file
  - Assert guardrails triggered
  
- `validates required tasks present`
  - PR with migrations but no tasks
  - Assert check fails
  - Assert specific error message
  
- `passes with proper documentation`
  - PR with migrations and tasks
  - PR description references tasks
  - Assert check passes
  
- `handles admin override`
  - Failed check
  - Admin approval comment
  - Assert allows merge

## Dependencies
- GitHub Actions
- GitHub API for PR checks

## CI Configuration
```yaml
# .github/workflows/migration-guardrails.yml
name: Migration Guardrails
on:
  pull_request:
    types: [opened, synchronize, edited]

jobs:
  check-migration-compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          
      - name: Check for Migration Changes
        id: migration_check
        run: |
          MIGRATIONS=$(git diff --name-only origin/main..HEAD | grep "supabase/migrations/.*\.sql" || true)
          if [ -n "$MIGRATIONS" ]; then
            echo "has_migrations=true" >> $GITHUB_OUTPUT
            echo "migrations<<EOF" >> $GITHUB_OUTPUT
            echo "$MIGRATIONS" >> $GITHUB_OUTPUT
            echo "EOF" >> $GITHUB_OUTPUT
          else
            echo "has_migrations=false" >> $GITHUB_OUTPUT
          fi
          
      - name: Validate Required Documentation
        if: steps.migration_check.outputs.has_migrations == 'true'
        run: |
          npx tsx scripts/ci/check-migration-compliance.ts
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          
      - name: Post Compliance Report
        if: always() && steps.migration_check.outputs.has_migrations == 'true'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('compliance-report.md', 'utf8');
            
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: report
            });
```

## Compliance Check Script
```typescript
// scripts/ci/check-migration-compliance.ts
interface ComplianceCheck {
  hasMigrations: boolean;
  requiredTasks: string[];
  foundTasks: string[];
  prDescriptionValid: boolean;
  errors: string[];
}

async function checkCompliance(): Promise<ComplianceCheck> {
  const pr = await fetchPR();
  const files = await fetchPRFiles();
  
  const check: ComplianceCheck = {
    hasMigrations: false,
    requiredTasks: [
      '.specify/tasks/data-rls-006-reconciler-migration.md',
      '.specify/tasks/ops-000-preflight-db.md'
    ],
    foundTasks: [],
    prDescriptionValid: false,
    errors: []
  };
  
  // Check for migrations
  const migrations = files.filter(f => f.match(/supabase\/migrations\/.*\.sql/));
  check.hasMigrations = migrations.length > 0;
  
  if (!check.hasMigrations) {
    return check; // No migrations, no requirements
  }
  
  // Check for required task files
  for (const task of check.requiredTasks) {
    if (files.includes(task)) {
      check.foundTasks.push(task);
    } else {
      check.errors.push(`Missing required task: ${task}`);
    }
  }
  
  // Check PR description
  const description = pr.body || '';
  check.prDescriptionValid = check.requiredTasks.every(task => 
    description.includes(task)
  );
  
  if (!check.prDescriptionValid) {
    check.errors.push('PR description must reference required tasks');
  }
  
  // Check for DB precheck output
  if (!description.includes('check-actual-db.ts output:')) {
    check.errors.push('PR must include database precheck output');
  }
  
  return check;
}
```

## PR Template
```markdown
<!-- .github/PULL_REQUEST_TEMPLATE/migration.md -->
## Migration PR Checklist

### Required Documentation
- [ ] Ran `scripts/check-actual-db.ts` and included output below
- [ ] Created/updated `.specify/tasks/data-rls-006-reconciler-migration.md`
- [ ] Created/updated `.specify/tasks/ops-000-preflight-db.md`
- [ ] Migration uses idempotent patterns (IF NOT EXISTS, DO blocks)

### Database Precheck Output
```
<paste check-actual-db.ts output here>
```

### Migration Summary
- Files changed:
- Tables affected:
- Data migration required: Yes/No
- Rollback plan:

### Testing
- [ ] Tested on fresh database
- [ ] Tested on existing database
- [ ] RLS tests pass
- [ ] No data loss confirmed
```

## Remediation Messages
```typescript
const REMEDIATION = {
  missingTasks: `
❌ Migration Compliance Failed

This PR modifies database migrations but is missing required documentation.

To fix:
1. Run: npm run db:check:actual > db-state.txt
2. Create: .specify/tasks/ops-000-preflight-db.md with the output
3. Update: .specify/tasks/data-rls-006-reconciler-migration.md
4. Reference both files in your PR description
5. Push the updates

See: docs/database-migration-guide.md
`,
  
  noPrecheck: `
❌ Database Precheck Missing

Migration PRs must include actual database state verification.

Run: scripts/check-actual-db.ts
Add output to PR description under "Database Precheck Output"
`,
  
  override: `
ℹ️ Admin Override Available

A repository admin can override this check by commenting:
/override migration-guardrails "reason for override"
`
};
```