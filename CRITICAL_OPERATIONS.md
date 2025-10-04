# CRITICAL OPERATIONS - EXACT STEPS FOR EVERY SESSION

## 🔴 1. DIRECT DATABASE CONNECTION (ALWAYS USE THIS)

### Python Script Method (PROVEN TO WORK)
```python
#!/usr/bin/env python3
import requests
import json

# Supabase credentials from .env.local
# Get these from .env.local
SUPABASE_URL = "<NEXT_PUBLIC_SUPABASE_URL from .env.local>"
SUPABASE_SERVICE_KEY = "<SUPABASE_SERVICE_ROLE_KEY from .env.local>"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

def exec_sql(sql):
    """Execute SQL via Supabase RPC - WORKS RELIABLY"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    response = requests.post(url, headers=headers, json={"sql": sql})
    return response.status_code == 204  # 204 = Success
```

### What DOESN'T Work:
- ❌ Node.js scripts with require('@supabase/supabase-js') - module resolution fails
- ❌ TypeScript scripts with tsx - dependency issues
- ❌ Direct psql commands - not available
- ❌ Supabase CLI commands - connection errors

## 🔴 2. GIT PUSH TO MAIN (EXACT WORKING METHOD)

### Step 1: Configure Git Authentication
```bash
# Set the authenticated remote URL with PAT token
git remote set-url origin https://<GITHUB_PAT>@github.com/etzlertech/jobeye.git

# Configure credential helper
git config credential.helper store
echo "https://<GITHUB_PAT>:x-oauth-basic@github.com" > ~/.git-credentials
```

### Step 2: Commit and Push
```bash
# Add files
git add <files>

# Commit with proper format
git commit -m "$(cat <<'EOF'
type: your commit message here

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push to main
git push origin main
```

### What DOESN'T Work:
- ❌ git push without authentication setup - returns 403 error
- ❌ Using GITHUB_PAT environment variable - it's commented out in .env.local

## 🔴 3. RAILWAY MONITORING (ACTIVE, NOT PASSIVE)

### The Problem with Current Scripts:
- `npm run railway:check` - FAILS due to missing tsx
- `npx tsx scripts/railway-check-latest.ts` - FAILS due to missing dependencies
- Node.js module resolution is broken in this environment

### Working Alternative (Until Scripts Are Fixed):
```bash
# 1. Note the time of push
git push origin main
echo "Pushed at $(date)"

# 2. Monitor GitHub Actions (if configured)
# Check https://github.com/etzlertech/jobeye/actions

# 3. Wait 2-3 minutes then test directly
# Railway typically deploys in 2-3 minutes, not always 5
```

### What NOT to Do:
- ❌ DON'T wait blindly for 5 minutes
- ❌ DON'T assume deployment succeeded without verification
- ❌ DON'T test before deployment completes

## 🔴 4. COMPLETE WORKFLOW EXAMPLE

```bash
# 1. Make code changes
# Edit files as needed

# 2. Check what changed
git status

# 3. Setup git auth (only needed once per session)
git remote set-url origin https://<GITHUB_PAT>@github.com/etzlertech/jobeye.git
git config credential.helper store
echo "https://<GITHUB_PAT>:x-oauth-basic@github.com" > ~/.git-credentials

# 4. Commit and push
git add .
git commit -m "$(cat <<'EOF'
fix: your change description

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push origin main

# 5. Note deployment start time
echo "Deployment started at $(date)"

# 6. Wait 2-3 minutes (Railway typical deploy time)
sleep 180

# 7. Test with Browser MCP
# Navigate to https://jobeye-production.up.railway.app
```

## 🔴 5. DEPENDENCIES ISSUE

### Current Problem:
- Node.js module resolution is broken
- Can't use npm scripts that require tsx or other modules
- Python works more reliably than Node.js in this environment

### Solution:
- Use Python scripts for database operations
- Use bash/git directly for version control
- Avoid Node.js scripts until dependency issues are resolved