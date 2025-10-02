# MEMORY.md - Critical Rules for Every Claude Code Session

## 🔥 ABSOLUTE DATABASE RULES - NEVER IGNORE

### 1. ALWAYS CHECK LIVE DATABASE FIRST
Before ANY database work (new tables, migrations, schema changes, queries):
```bash
npm run check:db-actual
```

### 2. NEVER TRUST MIGRATION FILES
Migration files in the codebase DO NOT reflect actual database state. 
**ALWAYS verify by querying the live database using Supabase client.**

### 3. USE ONLY SUPABASE CLIENT FOR DATABASE OPERATIONS
**✅ WORKING METHOD - Use Supabase Client RPC:**
```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Execute SQL via RPC
const { error } = await client.rpc('exec_sql', {
  sql: 'YOUR_SQL_STATEMENT_HERE'
});
```

**❌ THESE DON'T WORK:**
- `psql` command (not available)
- `npx supabase db push` (connection errors)
- Direct TCP connections (firewall blocked)
- PGBouncer URLs with standard postgres clients

### 4. BEFORE ANY DATABASE CODING
1. Run `npm run check:db-actual`
2. Query live schema using Supabase client
3. Verify actual table structure exists
4. Check actual RLS policies exist
5. THEN write code based on ACTUAL state

## 🚨 WORKFLOW ENFORCEMENT

### Database Decision Checklist
- [ ] Ran `npm run check:db-actual`
- [ ] Queried live database with Supabase client
- [ ] Verified actual schema vs migration files
- [ ] Confirmed RLS policies exist
- [ ] Based decisions on LIVE data, not migration files

### Working Examples That Succeeded
- `scripts/fix-rls-policies.ts` - Fixed RLS policies via Supabase RPC
- `scripts/apply-job-limit-trigger.ts` - Added trigger via Supabase RPC
- Both executed complex SQL successfully via `client.rpc('exec_sql', { sql })`

## 💰 COST CONTROL RULES

### Always Use TodoWrite for Multi-Step Tasks
For any task with 3+ steps or complexity, use TodoWrite to:
- Track progress systematically
- Prevent forgotten steps
- Show user clear progress
- Avoid costly tangents and rework

### Respect Complexity Budgets
- Default: 300 LoC max per file
- Maximum: 500 LoC per file
- Break large features into smaller, focused files

## 🔧 CRITICAL DEVELOPMENT PATTERNS

### Single Developer Team with Multiple Claude Agents
- **ONE HUMAN DEVELOPER** with multiple Claude Code CLI agents running in parallel
- **MAIN BRANCH ONLY** - Never create feature branches, never deviate from main
- **AUTO-DEPLOY DEPENDENCY** - Railway auto-deploys from main branch pushes
- **PAT TOKEN AVAILABLE** - You have Personal Access Token for direct git operations

### Parallel Agent Coordination
- **AWARENESS REQUIRED** - Check `git status` and recent commits before starting work
- **WORK IN APPROVED LANES** - Coordinate to avoid editing same files simultaneously
- **FILE CONFLICT PREVENTION** - If another agent recently modified a file, communicate before editing
- **COMMIT FREQUENCY** - Push small, focused changes frequently to minimize conflicts
- **DOMAIN SEPARATION** - Prefer working in different `/domains/` directories when possible

### Push Changes Directly to Main
- **ALWAYS push to main branch** - Never create or switch branches
- **Never ask user to commit/push** - You have PAT token, do it directly
- Use `git push origin main` when changes need deployment
- Railway will auto-deploy within 2-3 minutes of push
- Multiple agents can work simultaneously without branch conflicts

### Railway Monitoring
- Use `npm run railway:monitor <deployment-id>` for 5-second polling
- Auto-fetch error logs on failure
- Apply fixes and push immediately

### Testing Requirements
- Run `npm run test` before deployment
- Maintain >80% coverage
- Fix failing tests immediately

## 🎯 SUCCESS METRICS

Following these rules prevents:
- ❌ Hours wasted on incorrect database assumptions
- ❌ Token burn on unnecessary exploration
- ❌ Failed deployments due to schema mismatches
- ❌ Costly debugging of non-existent problems

These rules are based on real failures and proven solutions in this codebase.