# Database Documentation

**Last Updated:** 2025-10-18

This folder contains comprehensive database documentation for JobEye, designed to support both agents with direct Supabase access (Claude Code via MCP) and agents without access (CODEX).

---

## 📚 Quick Navigation

### **For Agents (CODEX) - Start Here** 👈

1. **[Agent Quickstart Guide](./guides/agent-quickstart.md)** ⭐
   - Complete schema reference for agents without MCP access
   - All 68 tables documented with column details
   - 28 enum types with values
   - Storage bucket configuration
   - Type safety patterns
   - Common mistakes to avoid
   - **Recommended for:** CODEX working on TypeScript fixes

2. **[Repository Patterns Reference](./guides/repository-patterns.md)** ⭐
   - 8 proven type safety patterns
   - 3 reference implementations (material, property, jobs)
   - Complete repository template
   - Real code examples from production
   - **Recommended for:** Implementing new repositories

### **For Reference**

3. **[Live Database Analysis](../live-database-analysis.md)**
   - Current database state (which tables have data)
   - Table usage by domain
   - Row counts and statistics
   - Cleanup candidates

4. **Schema Snapshots** (coming soon)
   - Point-in-time schema exports
   - Historical schema changes
   - RLS policy archives

---

## 🎯 Use Cases

### "I need to fix TypeScript errors in a repository"
→ Read **Agent Quickstart Guide** → find your table → copy type patterns

### "I'm creating a new repository"
→ Read **Repository Patterns Reference** → copy template → reference existing repos

### "I need to know what's in the database"
→ Read **Live Database Analysis** → see row counts and active tables

### "I need to verify a schema detail"
→ Search **Agent Quickstart Guide** or check `src/types/database.ts`

---

## 🏗️ Documentation Structure

```
docs/database/
├── README.md (this file)
├── guides/
│   ├── agent-quickstart.md          # Schema reference for agents
│   └── repository-patterns.md       # Type safety patterns
├── analysis/ (coming soon)
│   ├── rls-coverage.md              # RLS policy audit
│   ├── index-performance.md         # Index analysis
│   └── storage-analysis.md          # Storage buckets
└── snapshots/ (coming soon)
    ├── 2025-10-18-schema.json       # Full schema
    ├── 2025-10-18-rls-policies.json # RLS policies
    └── latest -> 2025-10-18-*       # Symlinks
```

---

## 📊 Database Overview

**Type:** PostgreSQL 15 (via Supabase)
**Total Tables:** 68
**Active Tables:** 7 (with production data)
**Total Enums:** 28
**Extensions:** PostGIS (geography), pgcrypto (UUIDs)

**Key Business Tables:**
- `jobs` (55 columns) - Job execution
- `properties` (25 columns) - Property management
- `customers` (23 columns) - Customer data
- `items` (40 columns) - Unified inventory
- `item_transactions` (21 columns) - Inventory transactions
- `users_extended` (25 columns) - User profiles

**Generated Types:** `src/types/database.ts` (auto-generated from live database)

---

## 🔄 Update Schedule

### **Automatic Updates**
- `src/types/database.ts` - Regenerated after migrations

### **Manual Updates**
- Agent Quickstart Guide - Updated when major schema changes occur
- Repository Patterns - Updated when new patterns emerge
- Live Analysis - Run `npm run db:analyze` to refresh

### **Planned Automation**
- Daily: Agent guide refresh (schema + row counts)
- After migrations: Full snapshot + documentation update
- Weekly: Historical snapshot archive

---

## 🛠️ Maintenance Scripts

```bash
# Regenerate database types
npm run generate:types

# Analyze current database state
npm run db:analyze

# Create point-in-time snapshot (coming soon)
npm run db:snapshot

# Generate agent guide (coming soon)
npm run db:agent-guide

# Full analysis refresh (coming soon)
npm run db:full-analysis
```

---

## 🤝 For Agents

### **If you have Supabase MCP access (Claude Code):**
- Use MCP tools for real-time schema queries
- Update documentation after schema changes
- Validate CODEX's work against live database

### **If you DON'T have Supabase MCP access (CODEX):**
- Start with **Agent Quickstart Guide**
- Reference **Repository Patterns** for implementation
- Use `src/types/database.ts` as source of truth
- Ask user for clarification if schema is unclear

---

## 📝 Key Files

- **`src/types/database.ts`** - Generated TypeScript types (source of truth)
- **`docs/database/guides/agent-quickstart.md`** - Human-readable schema reference
- **`docs/database/guides/repository-patterns.md`** - Implementation patterns
- **`docs/live-database-analysis.md`** - Current database state
- **`scripts/deep-database-analysis.ts`** - Analysis script

---

## 🎓 Learning Path

**For new agents working on JobEye:**

1. **Day 1:** Read Agent Quickstart Guide (focus on core tables section)
2. **Day 2:** Study Repository Patterns Reference (focus on 8 patterns)
3. **Day 3:** Review reference implementations:
   - Material repository (`src/domains/material/repositories/material-repository.ts:126`)
   - Property repository (`src/domains/property/repositories/property-repository.ts:123`)
   - Jobs repository (`src/domains/jobs/repositories/jobs.repository.ts:37`)
4. **Day 4+:** Apply patterns to your work, reference guides as needed

---

## 🚨 Critical Rules

**ALWAYS:**
- ✅ Use generated types from `Database['public']['Tables'][...]`
- ✅ Filter queries by `tenant_id` (security)
- ✅ Cast jsonb fields: `as unknown as Insert['field']`
- ✅ Prefer soft delete over hard DELETE
- ✅ Use enum types for status/type fields

**NEVER:**
- ❌ Hardcode table types manually
- ❌ Skip `tenant_id` filtering
- ❌ Hard DELETE records (use soft delete)
- ❌ Assign jsonb without casting in strict mode

---

## 📞 Need Help?

1. **Check Agent Quickstart Guide** - Most questions answered there
2. **Review Repository Patterns** - Implementation patterns
3. **Search `src/types/database.ts`** - Source of truth for schema
4. **Ask user** - For row counts, business logic, or unclear requirements

---

## 🏆 Success Metrics

**For CODEX TypeScript error fixing:**
- Can find table schema without asking user: ✅
- Can copy correct type patterns: ✅
- Can implement tenant isolation correctly: ✅
- Can handle jsonb fields without errors: ✅

**For repository implementation:**
- All 8 patterns applied: ✅
- Follows reference implementation structure: ✅
- Passes type checking: ✅
- Includes tenant isolation: ✅

---

**Generated:** 2025-10-18
**Maintained by:** Claude Code (with Supabase MCP access)
**Used by:** CODEX, other agents, and developers
