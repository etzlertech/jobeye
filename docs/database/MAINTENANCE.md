# Database Documentation Maintenance Guide

**Last Updated:** 2025-10-18
**Purpose:** Keep database documentation synchronized with live schema changes

---

## 🎯 Documentation Update Strategy

### **Three-Tier Update System**

1. **Automatic** (No human intervention)
   - Git hooks trigger on migration changes
   - Type generation after schema changes
   - Timestamp updates

2. **Semi-Automatic** (One command)
   - `npm run db:refresh` - Full documentation regeneration
   - `npm run db:snapshot` - Point-in-time archive
   - Scheduled via cron/CI

3. **Manual** (Human review required)
   - Breaking schema changes
   - New table documentation
   - Pattern updates from new implementations

---

## 📋 Update Rules by Change Type

### **1. Migration Added** 🔴 CRITICAL

**Trigger:** New file in `supabase/migrations/*.sql`

**Actions Required:**
```bash
# Automatic (git hook)
1. npm run generate:types              # Regenerate database.ts
2. npm run db:refresh                  # Update all docs

# Manual verification
3. Review changes in docs/database/guides/agent-quickstart.md
4. Update CHANGELOG.md with schema changes
5. Commit with schema change message
```

**Git Hook Location:** `.git/hooks/post-merge`, `.git/hooks/post-commit`

**Rule:**
> After ANY migration, documentation MUST be updated before pushing.
> Never commit migrations without updating types + docs.

---

### **2. Table Schema Changed** 🟠 HIGH PRIORITY

**Examples:**
- Column added/removed
- Data type changed
- Constraint added/modified

**Actions Required:**
```bash
1. npm run generate:types              # Regenerate types
2. npm run db:refresh                  # Update docs
3. Check affected repositories         # Search for table usage
4. Update agent-quickstart.md          # If core table changed
5. Update repository-patterns.md       # If pattern changes
```

**Verification:**
```bash
# Find all repositories using this table
grep -r "from('table_name')" src/domains/

# Run type check
npm run type-check
```

**Rule:**
> Schema changes MUST update docs before any repository code changes.
> This ensures CODEX/agents have accurate schema info.

---

### **3. New Table Added** 🟡 MEDIUM PRIORITY

**Actions Required:**
```bash
1. npm run generate:types              # Regenerate types
2. Decide domain classification        # core, inventory, vision, etc.
3. Add to agent-quickstart.md          # If active table
   OR
   Document in README as "experimental" # If future table
4. npm run db:snapshot                 # Archive current state
```

**Manual Documentation Template:**
```markdown
### **{table_name}** ({column_count} columns, {row_count} rows)

**Purpose:** {Brief description}

**Key Columns:**
- `id` (uuid) - Primary key
- `tenant_id` (uuid) - Multi-tenant isolation
- {key columns...}

**Jsonb Fields:** (if applicable)
- `{field_name}` (jsonb) - {description}

**Repository:** `{path_to_repo}` (if exists)
```

**Rule:**
> New tables must be classified as "active" or "experimental" in docs.
> Active tables get full documentation in agent-quickstart.md.

---

### **4. Enum Type Changed** 🟡 MEDIUM PRIORITY

**Examples:**
- New enum value added
- Enum value renamed/removed

**Actions Required:**
```bash
1. npm run generate:types              # Regenerate types
2. Update agent-quickstart.md          # Enum section (lines 301-400)
3. Search for enum usage               # Find all references
4. Update affected repositories        # If enum narrowed
```

**Verification:**
```bash
# Find enum usage
grep -r "job_status\|transaction_type" src/domains/
```

**Rule:**
> Enum changes must update docs AND search for hardcoded string usage.
> Risk: Breaking changes if values removed.

---

### **5. RLS Policy Changed** 🟠 HIGH PRIORITY (Security)

**Actions Required:**
```bash
1. npm run db:analyze-rls              # (Future: RLS analysis script)
2. Update docs/database/analysis/rls-coverage.md
3. Notify team                         # RLS changes affect security
4. Test with non-admin user            # Verify policies work
```

**Rule:**
> RLS policy changes MUST be documented and tested before production.
> Security-critical - review carefully.

---

### **6. Storage Bucket Changed** 🟡 MEDIUM PRIORITY

**Examples:**
- New bucket created
- Size limits changed
- RLS policies updated

**Actions Required:**
```bash
1. Update agent-quickstart.md          # Storage section
2. Update docs/database/analysis/storage-analysis.md
3. Document in CHANGELOG.md
```

**Rule:**
> Storage changes must update docs + test upload/download flows.

---

### **7. Function/Trigger Added** 🟢 LOW PRIORITY

**Actions Required:**
```bash
1. npm run db:snapshot                 # Archive with new function
2. Document in schema file             # If frequently used
```

**Rule:**
> Functions/triggers documented only if used by application code.

---

## 🤖 Automated Update System

### **Git Hooks** (Automatic)

Create `.git/hooks/post-merge`:
```bash
#!/bin/bash
# Post-merge hook - runs after git pull

echo "🔍 Checking for schema changes..."

# Check if migrations were added/modified
if git diff HEAD@{1} HEAD --name-only | grep -q "supabase/migrations\|src/types/database.ts"; then
  echo "📊 Schema changes detected!"
  echo ""
  echo "⚠️  REQUIRED ACTIONS:"
  echo "1. Run: npm run generate:types"
  echo "2. Run: npm run db:refresh"
  echo "3. Review: docs/database/guides/agent-quickstart.md"
  echo "4. Update: CHANGELOG.md"
  echo "5. Commit documentation updates"
  echo ""

  read -p "Run automatic updates now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Regenerating types..."
    npm run generate:types

    echo "📚 Updating documentation..."
    npm run db:refresh

    echo "✅ Automatic updates complete!"
    echo "⚠️  Manual review still required:"
    echo "   - Check docs/database/guides/agent-quickstart.md"
    echo "   - Update CHANGELOG.md"
    echo "   - Commit changes"
  fi
fi
```

Create `.git/hooks/pre-push`:
```bash
#!/bin/bash
# Pre-push hook - verify docs are up to date

echo "🔍 Verifying documentation is up to date..."

# Check if migrations changed but types/docs didn't
MIGRATIONS_CHANGED=$(git diff origin/main...HEAD --name-only | grep "supabase/migrations" | wc -l)
TYPES_CHANGED=$(git diff origin/main...HEAD --name-only | grep "src/types/database.ts" | wc -l)
DOCS_CHANGED=$(git diff origin/main...HEAD --name-only | grep "docs/database" | wc -l)

if [ "$MIGRATIONS_CHANGED" -gt 0 ] && [ "$TYPES_CHANGED" -eq 0 ]; then
  echo "❌ ERROR: Migrations changed but database.ts not updated!"
  echo "   Run: npm run generate:types"
  exit 1
fi

if [ "$MIGRATIONS_CHANGED" -gt 0 ] && [ "$DOCS_CHANGED" -eq 0 ]; then
  echo "⚠️  WARNING: Migrations changed but documentation not updated!"
  echo "   Consider running: npm run db:refresh"
  read -p "Continue push anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "✅ Documentation checks passed"
```

Make hooks executable:
```bash
chmod +x .git/hooks/post-merge
chmod +x .git/hooks/pre-push
```

---

### **NPM Scripts** (Semi-Automatic)

Add to `package.json`:
```json
{
  "scripts": {
    "// Database Documentation": "",
    "db:refresh": "tsx scripts/refresh-database-docs.ts",
    "db:snapshot": "tsx scripts/snapshot-database.ts",
    "db:analyze": "tsx scripts/deep-database-analysis.ts",
    "db:analyze-rls": "tsx scripts/analyze-rls.ts",
    "db:analyze-storage": "tsx scripts/analyze-storage.ts",
    "db:verify": "tsx scripts/verify-docs-sync.ts",

    "// Full update workflow": "",
    "db:full-update": "npm run generate:types && npm run db:refresh && npm run db:snapshot",

    "// Scheduled tasks": "",
    "db:daily": "npm run db:analyze && npm run db:refresh",
    "db:weekly": "npm run db:snapshot",

    "// Pre-commit verification": "",
    "pre-commit": "npm run type-check && npm run db:verify",

    "// Post-migration workflow": "",
    "post-migration": "npm run generate:types && npm run db:full-update && echo 'Update CHANGELOG.md and commit docs'"
  }
}
```

---

### **Scheduled Updates** (Cron/CI)

#### **Option 1: Local Cron (Development)**

Create `scripts/schedule-db-updates.sh`:
```bash
#!/bin/bash
# Schedule database documentation updates

# Daily at 2 AM: Analyze database state
0 2 * * * cd /path/to/jobeye && npm run db:daily >> logs/db-daily.log 2>&1

# Weekly Sunday at 3 AM: Create snapshot
0 3 * * 0 cd /path/to/jobeye && npm run db:weekly >> logs/db-weekly.log 2>&1

# After each pull (manual trigger)
# Run via git hook (post-merge)
```

Install:
```bash
crontab -e
# Paste schedule above
```

#### **Option 2: GitHub Actions (Automated)**

Create `.github/workflows/database-docs-update.yml`:
```yaml
name: Database Documentation Update

on:
  # Run daily at 2 AM UTC
  schedule:
    - cron: '0 2 * * *'

  # Run after migrations are merged
  push:
    paths:
      - 'supabase/migrations/**'

  # Allow manual trigger
  workflow_dispatch:

jobs:
  update-docs:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Regenerate database types
        run: npm run generate:types
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      - name: Update documentation
        run: npm run db:refresh
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      - name: Create snapshot
        run: npm run db:snapshot
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Commit and push
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "Database Docs Bot"
          git config user.email "bot@jobeye.com"
          git add docs/ src/types/database.ts
          git commit -m "docs(database): automated documentation update

          - Regenerated database types
          - Updated agent quickstart guide
          - Created point-in-time snapshot

          🤖 Automated by GitHub Actions"
          git push
```

#### **Option 3: Railway Deploy Hook (Production)**

Create `scripts/railway-db-update.sh`:
```bash
#!/bin/bash
# Run after Railway deployment

echo "🚀 Railway deployment detected - updating database docs..."

# Regenerate types from production database
npm run generate:types

# Update documentation
npm run db:refresh

# Commit if changes detected
if ! git diff --quiet; then
  git add docs/ src/types/
  git commit -m "docs(database): post-deploy documentation update [skip ci]"
  git push
  echo "✅ Documentation updated and pushed"
else
  echo "ℹ️  No documentation changes needed"
fi
```

Add to Railway deploy hooks:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "hooks": {
    "postDeploy": "bash scripts/railway-db-update.sh"
  }
}
```

---

## 📝 Manual Documentation Updates

### **When to Update Manually**

1. **New Repository Implemented**
   - Add to repository-patterns.md as reference
   - Update agent-quickstart.md if uses new pattern
   - Add to README learning path

2. **Breaking Schema Change**
   - Document migration path in CHANGELOG
   - Update agent-quickstart.md with warnings
   - Notify all agents/developers

3. **Major Feature Addition**
   - Add new domain section to agent-quickstart.md
   - Create dedicated table docs (future: per-table markdown)
   - Update README navigation

### **Documentation Review Checklist**

Before committing documentation updates:

- [ ] `src/types/database.ts` regenerated
- [ ] `docs/database/guides/agent-quickstart.md` updated
- [ ] `docs/database/guides/repository-patterns.md` updated (if patterns changed)
- [ ] `docs/database/README.md` updated (if structure changed)
- [ ] `CHANGELOG.md` entry added
- [ ] Timestamp updated in all modified docs
- [ ] `npm run type-check` passes
- [ ] Git hooks installed and working

---

## 🔍 Verification Script

Create `scripts/verify-docs-sync.ts`:
```typescript
#!/usr/bin/env npx tsx
/**
 * Verify database documentation is in sync with live schema
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface VerificationResult {
  inSync: boolean;
  issues: string[];
  warnings: string[];
}

async function verifyDocsSync(): Promise<VerificationResult> {
  const result: VerificationResult = {
    inSync: true,
    issues: [],
    warnings: []
  };

  console.log('🔍 Verifying documentation sync...\n');

  // 1. Check database.ts exists and is recent
  const dbTypesPath = 'src/types/database.ts';
  if (!fs.existsSync(dbTypesPath)) {
    result.inSync = false;
    result.issues.push('❌ database.ts not found - run npm run generate:types');
    return result;
  }

  const dbTypesStat = fs.statSync(dbTypesPath);
  const ageHours = (Date.now() - dbTypesStat.mtimeMs) / (1000 * 60 * 60);

  if (ageHours > 24) {
    result.warnings.push(`⚠️  database.ts is ${Math.round(ageHours)} hours old - consider regenerating`);
  }

  // 2. Check agent-quickstart.md exists and is recent
  const quickstartPath = 'docs/database/guides/agent-quickstart.md';
  if (!fs.existsSync(quickstartPath)) {
    result.inSync = false;
    result.issues.push('❌ agent-quickstart.md not found - run npm run db:refresh');
    return result;
  }

  const quickstartStat = fs.statSync(quickstartPath);
  const quickstartAgeHours = (Date.now() - quickstartStat.mtimeMs) / (1000 * 60 * 60);

  if (quickstartAgeHours > 48) {
    result.warnings.push(`⚠️  agent-quickstart.md is ${Math.round(quickstartAgeHours)} hours old - consider updating`);
  }

  // 3. Check if database.ts is newer than docs (indicates docs need update)
  if (dbTypesStat.mtimeMs > quickstartStat.mtimeMs + 60000) { // 1 min buffer
    result.inSync = false;
    result.issues.push('❌ database.ts is newer than docs - run npm run db:refresh');
  }

  // 4. Check for recent migrations
  const migrationsPath = 'supabase/migrations';
  if (fs.existsSync(migrationsPath)) {
    const migrations = fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .map(f => ({
        name: f,
        mtime: fs.statSync(`${migrationsPath}/${f}`).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (migrations.length > 0) {
      const latestMigration = migrations[0];
      const migrationAgeHours = (Date.now() - latestMigration.mtime) / (1000 * 60 * 60);

      if (migrationAgeHours < 1 && quickstartStat.mtimeMs < latestMigration.mtime) {
        result.inSync = false;
        result.issues.push(`❌ Recent migration "${latestMigration.name}" but docs not updated`);
      }
    }
  }

  return result;
}

async function main() {
  try {
    const result = await verifyDocsSync();

    console.log('\n📊 VERIFICATION RESULTS\n');

    if (result.issues.length > 0) {
      console.log('❌ ISSUES FOUND:\n');
      result.issues.forEach(issue => console.log(`   ${issue}`));
      console.log('');
    }

    if (result.warnings.length > 0) {
      console.log('⚠️  WARNINGS:\n');
      result.warnings.forEach(warning => console.log(`   ${warning}`));
      console.log('');
    }

    if (result.inSync && result.warnings.length === 0) {
      console.log('✅ Documentation is in sync!\n');
      process.exit(0);
    } else if (!result.inSync) {
      console.log('❌ Documentation is OUT OF SYNC\n');
      console.log('Run: npm run db:full-update\n');
      process.exit(1);
    } else {
      console.log('⚠️  Documentation has warnings (not blocking)\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();
```

Usage:
```bash
# Check if docs are in sync
npm run db:verify

# Exit codes:
# 0 = in sync or warnings only
# 1 = out of sync (blocking)
```

---

## 📊 Monitoring Dashboard (Future Enhancement)

Create `docs/database/STATUS.md` (auto-generated):
```markdown
# Database Documentation Status

**Last Updated:** 2025-10-18 14:30:00
**Auto-generated by:** npm run db:status

## Sync Status

| Component | Status | Last Updated | Age |
|-----------|--------|--------------|-----|
| database.ts | ✅ | 2025-10-18 08:06 | 6h |
| agent-quickstart.md | ✅ | 2025-10-18 12:00 | 2h |
| repository-patterns.md | ✅ | 2025-10-18 12:00 | 2h |
| Latest Migration | ✅ | 2025-10-17 09:00 | 29h |
| Latest Snapshot | ⚠️ | 2025-10-15 02:00 | 3d |

## Recent Changes

- 2025-10-18: Added item_transactions documentation
- 2025-10-17: Updated job_status enum (added 'voice_created')
- 2025-10-16: Added storage bucket documentation

## Scheduled Tasks

- **Daily (2 AM):** Database analysis + docs refresh
- **Weekly (Sun 3 AM):** Snapshot creation
- **After migrations:** Automatic type + docs regeneration

## Alerts

- ⚠️ Snapshot is 3 days old (run npm run db:snapshot)
```

---

## 🎯 Quick Reference Commands

```bash
# After creating a migration
npm run post-migration

# Daily maintenance
npm run db:daily

# Weekly archive
npm run db:weekly

# Full update workflow
npm run db:full-update

# Verify sync status
npm run db:verify

# Manual refresh
npm run db:refresh
```

---

## 📋 Maintenance Checklist

### Daily (Automated)
- [ ] Run database analysis
- [ ] Update row counts
- [ ] Refresh agent quickstart guide

### Weekly (Automated)
- [ ] Create snapshot
- [ ] Archive to docs/database/snapshots/

### After Migration (Semi-Automatic)
- [ ] Regenerate types
- [ ] Update documentation
- [ ] Update CHANGELOG
- [ ] Verify with npm run db:verify
- [ ] Commit all changes together

### Monthly (Manual Review)
- [ ] Review repository patterns for new patterns
- [ ] Update learning path if new reference repos added
- [ ] Clean up old snapshots (keep last 4 weeks)
- [ ] Review and update this maintenance guide

---

## 🚨 Emergency: Docs Out of Sync

If documentation is critically out of sync:

```bash
# Nuclear option - full refresh
git pull origin main
npm run generate:types
npm run db:full-update
npm run db:verify

# Review changes
git diff docs/

# Commit
git add -A
git commit -m "docs(database): emergency sync - full refresh

- Regenerated types from live database
- Updated all documentation
- Created new snapshot

🚨 Emergency sync due to documentation drift
"
git push origin main
```

---

**End of Maintenance Guide**
