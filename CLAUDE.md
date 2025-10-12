# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- Last updated: 2025-10-04 for critical operations clarity -->

## 🚨 CRITICAL OPERATIONS - USE THESE EXACT METHODS

### 1️⃣ DATABASE OPERATIONS - PYTHON ONLY (Node.js is BROKEN)
```python
#!/usr/bin/env python3
import requests

# From .env.local
# Get from .env.local
SUPABASE_URL = "<NEXT_PUBLIC_SUPABASE_URL>"
SUPABASE_SERVICE_KEY = "<SUPABASE_SERVICE_ROLE_KEY>"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Execute SQL
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": "YOUR_SQL_HERE"}
)
# Success = status 204
```

### 2️⃣ GIT PUSH - ALWAYS USE THIS SEQUENCE
```bash
# Setup (once per session)
git remote set-url origin https://<GITHUB_PAT from .env.local>@github.com/etzlertech/jobeye.git
git config credential.helper store
echo "https://<GITHUB_PAT>:x-oauth-basic@github.com" > ~/.git-credentials

# Push (every time)
git add .
git commit -m "$(cat <<'EOF'
type: description

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push origin main
```

### 3️⃣ RAILWAY DEPLOY - MANUAL MONITORING
- Railway scripts are BROKEN (tsx/node module issues)
- After push: `echo "Pushed at $(date)"`
- Wait 2-3 minutes (NOT 5)
- Test with Browser MCP

## Project Overview

[... rest of the existing content remains unchanged ...]

## Supabase Access Guidance

- **IMPORTANT**: You have direct access to Supabase schema
- Never create SQL for users to run
- Investigate the schema directly using Supabase client methods
- Use `client.rpc('exec_sql', { sql: '...' })` for direct database operations
- Always check the actual database schema before making assumptions