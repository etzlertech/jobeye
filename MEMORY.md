# MEMORY.md - Critical Rules for Every Claude Code Session

## 🚨 CRITICAL: EXACT WORKING METHODS (USE THESE ONLY)

### 1️⃣ DIRECT SUPABASE CONNECTION - PYTHON ONLY
```python
#!/usr/bin/env python3
import requests
import json

# Get from .env.local
# Get these from .env.local
SUPABASE_URL = "<NEXT_PUBLIC_SUPABASE_URL from .env.local>"
SUPABASE_SERVICE_KEY = "<SUPABASE_SERVICE_ROLE_KEY from .env.local>"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Execute SQL - returns 204 on success
url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
response = requests.post(url, headers=headers, json={"sql": "YOUR_SQL_HERE"})
```
**DO NOT USE**: Node.js/TypeScript scripts - module resolution is broken

### 2️⃣ GIT PUSH - EXACT STEPS
```bash
# One-time setup per session
git remote set-url origin https://<GITHUB_PAT from .env.local>@github.com/etzlertech/jobeye.git
git config credential.helper store
echo "https://<GITHUB_PAT>:x-oauth-basic@github.com" > ~/.git-credentials

# Every push
git add .
git commit -m "$(cat <<'EOF'
type: message

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push origin main
```

### 3️⃣ RAILWAY MONITORING - MANUAL METHOD
```bash
# After push, note the time
echo "Pushed at $(date)"
# Wait 2-3 minutes (not 5!)
sleep 180
# Then test with Browser MCP
```
**BROKEN**: npm run railway:* scripts due to Node.js dependency issues

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

### Demo Tenant Testing Reminder
- Demo UI screens hit supervisor APIs directly and depend on `x-tenant-id`.
- Always confirm the header matches the tenant whose data you expect, or the UI will appear empty / return 404s.
- When in doubt, echo tenant/user info on screen to validate context quickly.

## 🌐 BROWSER MCP CAPABILITIES

### Real-Time Browser Control
- **BROWSER MCP INSTALLED**: User has Browser MCP Chrome extension active
- **REAL-TIME CONTROL**: Can control user's live browser tab in production Railway environment
- **VISUAL FEEDBACK**: Take screenshots to see exactly what user sees
- **FORM TESTING**: Fill out forms, click buttons, navigate pages in real-time
- **PRODUCTION TESTING**: Test CRUD operations on live Railway deployment directly

### Browser MCP Tools Available
```javascript
// Navigate to any URL
mcp__browsermcp__browser_navigate({ url: "https://jobeye-production.up.railway.app" })

// Take screenshot to see current state
mcp__browsermcp__browser_screenshot()

// Get page structure for element references
mcp__browsermcp__browser_snapshot()

// Click elements (requires ref from snapshot)
mcp__browsermcp__browser_click({ element: "Save button", ref: "s1e42" })

// Type into form fields
mcp__browsermcp__browser_type({ element: "Email field", ref: "s1e24", text: "test@example.com", submit: false })

// Wait for page loads
mcp__browsermcp__browser_wait({ time: 3 })
```

### Railway Deployment Monitoring (Updated Strategy)
- **NEVER BLINDLY WAIT 5 MINUTES**: Use active monitoring instead of passive waiting
- **DEPLOYMENT RANGE**: Typically 2-5 minutes, but can finish earlier
- **ACTIVE MONITORING WORKFLOW**:
  1. Push code: `git push`
  2. **IMMEDIATELY start monitoring**: `npm run railway:check` to get deployment ID
  3. **Monitor every 30 seconds**: `npm run railway:monitor <deployment-id>`
  4. **Test as soon as deployment succeeds** (don't wait the full 5 minutes)
  5. If deployment fails, logs are automatically shown for debugging

### Railway Monitoring Commands (Use These!)
```bash
# Get latest deployment ID immediately after push
npm run railway:check

# Monitor specific deployment with 5-second polling
npm run railway:monitor <deployment-id>

# View build logs if needed
npm run railway:build-logs <deployment-id>

# View runtime logs if needed  
npm run railway:deploy-logs <deployment-id>
```

### Efficient Railway Workflow
- **STEP 1**: `git push` 
- **STEP 2**: `npm run railway:check` (get deployment ID)
- **STEP 3**: `npm run railway:monitor <id>` (watch real-time status)
- **STEP 4**: Test via Browser MCP as soon as status shows "SUCCESS"
- **RESULT**: Test in 2-3 minutes instead of waiting full 5 minutes

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
- **Use exact commit format from CLAUDE.md:**
  ```bash
  git add <files>
  git commit -m "$(cat <<'EOF'
  conventional commit message
  
  🤖 Generated with [Claude Code](https://claude.ai/code)
  
  Co-Authored-By: Claude <noreply@anthropic.com>
  EOF
  )"
  git push
  ```
- Railway will auto-deploy within 2-3 minutes of push
- Multiple agents can work simultaneously without branch conflicts

### Railway Monitoring & Browser MCP Integration
- **POST-PUSH MONITORING**: After every `git push`, ACTIVELY MONITOR deployment (don't wait blindly)
- **IMMEDIATE ACTION**: Run `npm run railway:check` then `npm run railway:monitor <deployment-id>`
- **SMART TIMING**: Test as soon as deployment succeeds (usually 2-4 minutes, not always 5)
- Auto-fetch error logs on failure
- **BROWSER MCP AVAILABLE**: Can control user's browser in real-time via Browser MCP tools:
  - `mcp__browsermcp__browser_navigate` - Navigate to URLs
  - `mcp__browsermcp__browser_screenshot` - Take real-time screenshots
  - `mcp__browsermcp__browser_click` - Click elements on page
  - `mcp__browsermcp__browser_type` - Type into form fields
  - `mcp__browsermcp__browser_snapshot` - Get page structure
- **LIVE TESTING WORKFLOW**: 
  1. Push code changes to main
  2. Monitor Railway deployment status via API
  3. Wait 5 minutes for deployment completion
  4. Use Browser MCP to test live Railway deployment in user's browser
  5. Verify CRUD operations, UI behavior, API responses in real production environment
- **BROWSER MCP SETUP**: User must have Browser MCP Chrome extension connected to Railway tab
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
