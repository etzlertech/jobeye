# Database Documentation Update Strategy

**Created:** 2025-10-18
**Status:** ✅ Implemented
**Purpose:** Keep database documentation synchronized with schema changes

---

## 🎯 Overview

This document describes the **three-tier update system** that keeps database documentation current:

1. **Automatic** - Git hooks trigger on changes
2. **Semi-Automatic** - Single command updates
3. **Manual** - Human review for breaking changes

---

## 🤖 Tier 1: Automatic Updates

### **Git Hooks** (Best Practice)

Install once, runs automatically:

```bash
# Copy hook templates
cp .git/hooks/post-merge.sample .git/hooks/post-merge
cp .git/hooks/pre-push.sample .git/hooks/pre-push

# Make executable
chmod +x .git/hooks/post-merge .git/hooks/pre-push
```

**What they do:**
- `post-merge`: Detects schema changes after `git pull`, prompts to update docs
- `pre-push`: Prevents pushing migrations without updating types/docs

**See:** `docs/database/MAINTENANCE.md` for full hook implementations

---

## ⚡ Tier 2: Semi-Automatic Updates

### **NPM Scripts** (One Command)

```bash
# After creating a migration
npm run post-migration
# → Regenerates types + updates docs + creates snapshot
# → Reminds you to update CHANGELOG.md

# Daily maintenance (can be scheduled)
npm run db:daily
# → Analyzes database + refreshes documentation

# Weekly archive
npm run db:weekly
# → Creates point-in-time snapshot

# Verify docs are in sync
npm run db:verify
# → Checks if types are newer than docs
# → Checks if recent migrations exist without doc updates

# Emergency full refresh
npm run db:full-update
# → Regenerates everything
```

### **Available Commands**

| Command | When to Use | What It Does |
|---------|-------------|--------------|
| `npm run post-migration` | After creating migration | Types + docs + snapshot + reminder |
| `npm run db:refresh` | After schema changes | Update agent-quickstart.md timestamps |
| `npm run db:snapshot` | Weekly or before major changes | Create point-in-time archive |
| `npm run db:verify` | Before committing | Check sync status |
| `npm run db:full-update` | Emergency or drift detected | Complete refresh |
| `npm run db:daily` | Scheduled (cron/CI) | Analysis + docs refresh |
| `npm run db:weekly` | Scheduled (cron/CI) | Create snapshot |

---

## 📋 Tier 3: Manual Updates

### **When Human Review Required**

1. **New table added** - Classify as "active" or "experimental" in docs
2. **Breaking schema change** - Document migration path in CHANGELOG
3. **New repository pattern** - Add to repository-patterns.md
4. **RLS policy change** - Security review required

### **Manual Update Workflow**

```bash
# 1. Make schema change (migration, etc.)
git add supabase/migrations/

# 2. Regenerate types
npm run generate:types

# 3. Update documentation
# Edit docs/database/guides/agent-quickstart.md
# - Add/update table schema
# - Update enum values
# - Add examples

# 4. Update CHANGELOG
# Edit CHANGELOG.md
# - Describe schema change
# - Note breaking changes
# - Migration steps if needed

# 5. Verify
npm run db:verify
npm run type-check

# 6. Commit all together
git add src/types/ docs/database/ CHANGELOG.md supabase/migrations/
git commit -m "feat(database): add new_table with documentation

- Add new_table schema
- Update agent-quickstart.md
- Regenerate database types

BREAKING: Requires migration XYZ
"
```

---

## 📅 Scheduled Updates (Recommended)

### **Option 1: Local Cron (Development)**

```bash
# Edit crontab
crontab -e

# Add these lines:
# Daily at 2 AM: Analyze + refresh docs
0 2 * * * cd /path/to/jobeye && npm run db:daily >> logs/db-daily.log 2>&1

# Weekly Sunday at 3 AM: Create snapshot
0 3 * * 0 cd /path/to/jobeye && npm run db:weekly >> logs/db-weekly.log 2>&1
```

### **Option 2: GitHub Actions (Production)**

Create `.github/workflows/database-docs-update.yml`:

```yaml
name: Database Documentation Update

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  push:
    paths:
      - 'supabase/migrations/**'
  workflow_dispatch:

jobs:
  update-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run db:full-update
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
      - name: Commit if changed
        run: |
          git config user.name "Database Docs Bot"
          git config user.email "bot@jobeye.com"
          git add docs/ src/types/
          git commit -m "docs(database): automated update [skip ci]" || exit 0
          git push
```

### **Option 3: Railway Post-Deploy Hook**

Automatically update docs after production deployment.

**See:** `docs/database/MAINTENANCE.md` for implementation details

---

## 🔍 Update Rules by Change Type

Quick reference - see `docs/database/MAINTENANCE.md` for details:

| Change Type | Priority | Actions Required |
|-------------|----------|------------------|
| **Migration Added** | 🔴 CRITICAL | `npm run post-migration` + CHANGELOG |
| **Table Schema Changed** | 🟠 HIGH | Types + docs + check affected repos |
| **New Table Added** | 🟡 MEDIUM | Types + classify + document |
| **Enum Changed** | 🟡 MEDIUM | Types + docs + search usage |
| **RLS Policy Changed** | 🟠 HIGH | Docs + security review + test |
| **Storage Bucket Changed** | 🟡 MEDIUM | Docs + test upload/download |
| **Function/Trigger Added** | 🟢 LOW | Snapshot + document if used |

---

## ✅ Pre-Commit Checklist

Before pushing changes that affect database:

- [ ] `npm run generate:types` - Types regenerated
- [ ] `npm run db:refresh` - Documentation updated (or manual edit)
- [ ] `CHANGELOG.md` - Entry added (if breaking change)
- [ ] `npm run db:verify` - Verification passes
- [ ] `npm run type-check` - TypeScript compiles
- [ ] All affected files committed together

---

## 🚨 Emergency: Docs Out of Sync

If documentation has drifted significantly:

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

🚨 Emergency sync due to documentation drift
"
git push origin main
```

---

## 📊 Monitoring Documentation Health

### **Status Checks**

```bash
# Is documentation in sync?
npm run db:verify

# When was database.ts last updated?
ls -lh src/types/database.ts

# When was agent-quickstart.md last updated?
ls -lh docs/database/guides/agent-quickstart.md

# Recent migrations?
ls -lt supabase/migrations/ | head -5
```

### **Health Indicators**

✅ **Healthy:**
- `database.ts` < 24 hours old
- `agent-quickstart.md` < 48 hours old
- `db:verify` passes
- Snapshots < 7 days old

⚠️ **Warning:**
- `database.ts` 24-72 hours old
- `agent-quickstart.md` 2-7 days old
- Snapshots 7-14 days old

🔴 **Critical:**
- `database.ts` > 72 hours old
- `agent-quickstart.md` > 7 days old
- Migration exists but docs not updated
- `db:verify` fails

---

## 🎯 Quick Reference

### **After Creating Migration**
```bash
npm run post-migration
# Edit CHANGELOG.md
git add -A
git commit -m "feat(database): [description]"
```

### **Before Committing**
```bash
npm run db:verify
npm run type-check
```

### **Weekly Maintenance**
```bash
npm run db:weekly  # Create snapshot
```

### **Emergency Sync**
```bash
npm run db:full-update
```

---

## 📚 Related Documentation

- **Maintenance Guide:** `docs/database/MAINTENANCE.md` (full details)
- **Agent Guide:** `docs/database/guides/agent-quickstart.md` (schema reference)
- **Repository Patterns:** `docs/database/guides/repository-patterns.md` (type safety)
- **Main README:** `docs/database/README.md` (navigation)
- **CLAUDE.md:** Updated with database doc rules

---

## 🎓 Key Principles

1. **Types are source of truth** - Always regenerate after schema changes
2. **Update docs before code** - CODEX needs accurate schema info
3. **Commit together** - Types + docs + migrations in one commit
4. **Automate where possible** - Use hooks and scheduled tasks
5. **Verify before push** - Run `npm run db:verify`

---

**End of Update Strategy Document**
