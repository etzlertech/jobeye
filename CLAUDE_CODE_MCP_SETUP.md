# Claude Code CLI - Supabase MCP Setup

## ✅ Configuration Complete (Last Updated: 2025-10-16)

The Supabase MCP server is now configured and **WORKING** for Claude Code CLI!

### Configuration Locations

**Project-Specific Config (CURRENT - WORKING):**
```
/Users/travisetzler/Documents/GitHub/jobeye/.claude/mcp.json
```

**Global Config (Alternative):**
```
~/.config/claude/mcp.json
```

### Working Configuration Details
- **MCP Server**: supabase
- **Project ID**: rtwigjwqufozqfwozpvo (jobeye)
- **Project URL**: https://rtwigjwqufozqfwozpvo.supabase.co
- **Access Token**: sbp_d4b9dde47b02f3a2185a7f466acd141d18c2bb41
- **Status**: ✅ Active and Connected
- **Region**: us-east-1
- **Database**: PostgreSQL 17.4

---

## 🎯 How We Got It Working (2025-10-16)

### The Problem
- Initial config had wrong format for Claude Code CLI
- Used `"url"` field instead of `"command"` + `"args"`
- MCP server wasn't loading on startup

### The Solution
1. **Updated `.claude/mcp.json` with correct CLI format:**
   ```json
   {
     "mcpServers": {
       "supabase": {
         "command": "npx",
         "args": [
           "-y",
           "@supabase/mcp-server-supabase@latest",
           "--access-token",
           "sbp_d4b9dde47b02f3a2185a7f466acd141d18c2bb41"
         ]
       }
     }
   }
   ```

2. **Exited and restarted Claude session** (this is CRITICAL - config only loads on startup)
   ```bash
   exit
   claude
   ```

3. **Manually connected to MCP** using `/mcp` command
   - Saw: "Failed to reconnect to browser" (ignored - that's a different MCP server)
   - Ran `/mcp` again
   - Saw: "Authentication successful. Connected to supabase."

4. **Verified with test query:**
   ```
   list all tables in the database
   ```

### Key Learnings
- **CLI vs Web**: Claude Code CLI uses different config format than web interface
  - CLI: `"command"` + `"args"` array with `--access-token` flag
  - Web: `"url"` field pointing to MCP endpoint
- **Must Restart**: Config changes require full session restart (exit + new `claude` command)
- **Manual Connect**: Use `/mcp` command if server doesn't auto-connect
- **Project-Specific**: `.claude/mcp.json` in project directory works great (no need for global config)
- **Token Format**: Use `--access-token` flag, not project ref
- **Query Optimization**: For large result sets, use `execute_sql` with targeted queries instead of `list_tables`

---

## 🚀 Using Claude Code CLI with MCP

### Start Interactive Session with MCP
```bash
claude --mcp
```

### Run One-off Commands
```bash
claude --mcp "your command here"
```

---

## 📋 Example Commands

### Database Operations
```bash
# List all tables
claude --mcp "show me all tables in the database"

# Query specific table
claude --mcp "query the users_extended table and show me the first 5 records"

# Execute custom SQL
claude --mcp "count how many jobs are in 'completed' status"

# Check database schema
claude --mcp "show me the schema for the jobs table"
```

### Migrations
```bash
# Create a new migration
claude --mcp "create a migration to add an index on jobs.status"

# Apply a migration
claude --mcp "apply the pending migrations"

# List migrations
claude --mcp "show me all database migrations"
```

### Edge Functions
```bash
# List Edge Functions
claude --mcp "list all edge functions"

# Deploy an Edge Function
claude --mcp "deploy a new edge function that sends email notifications"

# Get Edge Function details
claude --mcp "show me the code for the email notification function"
```

### Security & Performance
```bash
# Security audit
claude --mcp "check for security advisors and show any issues"

# Performance check
claude --mcp "check for performance advisors"

# Get service logs
claude --mcp "show me the latest postgres logs"
```

### Project Information
```bash
# Get project URL
claude --mcp "what is the API URL for this project?"

# Get API keys
claude --mcp "show me the anon key"

# Generate TypeScript types
claude --mcp "generate typescript types for the database"
```

---

## 🛠️ Available Supabase MCP Tools

### ✅ Tested and Working
| Tool | Description | Status |
|------|-------------|--------|
| `mcp__supabase__list_projects` | List all Supabase projects | ✅ Tested |
| `mcp__supabase__get_project` | Get project details | ✅ Available |
| `mcp__supabase__execute_sql` | Execute raw SQL queries | ✅ Tested |
| `mcp__supabase__list_tables` | List database tables (use with caution - large output) | ⚠️ Works but may exceed token limit |

### 🔧 Available (Not Yet Tested)
| Tool | Description |
|------|-------------|
| `mcp__supabase__apply_migration` | Apply database migrations (DDL operations) |
| `mcp__supabase__list_migrations` | List all migrations |
| `mcp__supabase__list_extensions` | List database extensions |
| `mcp__supabase__list_edge_functions` | List all Edge Functions |
| `mcp__supabase__get_edge_function` | Get Edge Function source code |
| `mcp__supabase__deploy_edge_function` | Deploy Edge Functions |
| `mcp__supabase__get_logs` | Get service logs (api, postgres, auth, storage, etc.) |
| `mcp__supabase__get_advisors` | Get security/performance advisors |
| `mcp__supabase__get_project_url` | Get API URL |
| `mcp__supabase__get_anon_key` | Get anonymous API key |
| `mcp__supabase__generate_typescript_types` | Generate TypeScript types |
| `mcp__supabase__create_branch` | Create development branch |
| `mcp__supabase__list_branches` | List all branches |
| `mcp__supabase__merge_branch` | Merge branch to production |
| `mcp__supabase__search_docs` | Search Supabase documentation |

### 📝 Tool Naming Convention
- All Supabase MCP tools are prefixed with `mcp__supabase__`
- Use natural language in Claude Code CLI - Claude will map to the correct tool
- Example: "list all tables" → `mcp__supabase__list_tables` or `mcp__supabase__execute_sql`

### ⚠️ Important Notes
- **list_tables**: Returns full schema for all tables - can exceed token limits (36K+ tokens for this project)
  - **Better approach**: Use `execute_sql` with targeted queries:
    ```sql
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    ```
- **Project ID**: Always use `rtwigjwqufozqfwozpvo` for JobEye project
- **SQL Results**: All SQL query results are wrapped in untrusted data tags - this is normal security behavior

---

## 🔍 Verification

### Test the MCP Connection
```bash
# Simple test
claude --mcp "list all tables"

# More detailed test
claude --mcp "show me the users_extended table structure and row count"
```

### Expected Output
You should see Claude Code CLI successfully:
1. Connect to the Supabase MCP server
2. Execute the tool calls
3. Return formatted results

---

## 📂 Configuration Files

### Global Config (for all projects)
```
~/.config/claude/mcp.json
```

### Project-Specific Config (optional)
```
/path/to/project/.claude/mcp.json
```

**Note**: Project-specific configs override global configs when you're in that project directory.

---

## 🎯 Pro Tips

1. **Use Natural Language**: Claude Code CLI understands natural language, so you don't need to memorize tool names
   ```bash
   claude --mcp "what tables do I have?"
   ```

2. **Multi-step Tasks**: Claude can chain multiple tool calls together
   ```bash
   claude --mcp "list all tables, then query the jobs table for today's jobs"
   ```

3. **Complex Operations**: Ask for complex database operations
   ```bash
   claude --mcp "analyze the jobs table and create a migration to optimize it"
   ```

4. **Interactive Mode**: Use `claude --mcp` for back-and-forth conversations
   ```bash
   claude --mcp
   # Then ask questions interactively
   ```

---

## 🐛 Troubleshooting & Recovery Steps

### If MCP Stops Working - COMPLETE RECOVERY GUIDE

#### Step 1: Verify Configuration File Exists
```bash
# Check project-specific config (preferred)
cat /Users/travisetzler/Documents/GitHub/jobeye/.claude/mcp.json

# Should show:
# {
#   "mcpServers": {
#     "supabase": {
#       "command": "npx",
#       "args": [
#         "-y",
#         "@supabase/mcp-server-supabase@latest",
#         "--access-token",
#         "sbp_d4b9dde47b02f3a2185a7f466acd141d18c2bb41"
#       ]
#     }
#   }
# }
```

#### Step 2: Verify NPX is Available
```bash
npx --version
# Should show: 10.x.x or higher

which npx
# Should show: /usr/local/bin/npx or similar
```

#### Step 3: Test MCP Server Manually
```bash
# This should start the MCP server (will hang - that's good!)
npx -y @supabase/mcp-server-supabase@latest --access-token sbp_d4b9dde47b02f3a2185a7f466acd141d18c2bb41

# Press Ctrl+C to stop
```

#### Step 4: Restart Claude Code Session
```bash
# Exit current session
exit

# Start new session IN THE PROJECT DIRECTORY
cd /Users/travisetzler/Documents/GitHub/jobeye
claude
```

#### Step 5: Connect MCP Manually (If Needed)
If MCP doesn't auto-connect, use the `/mcp` command:
```
/mcp
```

You should see:
```
Authentication successful. Connected to supabase.
```

#### Step 6: Verify Connection
Test with a simple query:
```
list all tables in the database
```

### Common Issues & Solutions

#### Issue: "Failed to reconnect to browser"
- **Solution**: This is a separate MCP server (browser). Ignore it - we only need Supabase.
- Run `/mcp` again to connect to Supabase specifically.

#### Issue: "You do not have permission to perform this action"
- **Cause**: Using wrong project ID
- **Solution**: Use correct project ID: `rtwigjwqufozqfwozpvo` (not `bozlezlyzmdtryjqbfwl`)
- Get correct ID with: `list all my Supabase projects`

#### Issue: "MCP tool response exceeds maximum allowed tokens"
- **Cause**: Result set is too large (common with list_tables)
- **Solution**: Use `execute_sql` instead with specific queries:
  ```sql
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  ORDER BY table_name;
  ```

#### Issue: MCP Server Not Loading on Startup
- **Check**: Are you in the correct directory?
  ```bash
  pwd
  # Should show: /Users/travisetzler/Documents/GitHub/jobeye
  ```
- **Check**: Does `.claude/mcp.json` exist?
  ```bash
  ls -la .claude/mcp.json
  ```
- **Fix**: Recreate the config file (see Configuration section below)

### Permission Issues
```bash
# Ensure config directory has correct permissions
chmod 700 .claude
chmod 600 .claude/mcp.json

# Or for global config
chmod 700 ~/.config/claude
chmod 600 ~/.config/claude/mcp.json
```

### Authentication Issues
If you see auth errors:
1. Verify the access token in `.claude/mcp.json` matches: `sbp_d4b9dde47b02f3a2185a7f466acd141d18c2bb41`
2. Check token is still valid in Supabase dashboard
3. Generate new token if needed and update config

### Nuclear Option: Complete Reset
If nothing else works, recreate the configuration:

```bash
# 1. Remove old config
rm .claude/mcp.json

# 2. Create new config
cat > .claude/mcp.json << 'EOF'
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_d4b9dde47b02f3a2185a7f466acd141d18c2bb41"
      ]
    }
  }
}
EOF

# 3. Set permissions
chmod 600 .claude/mcp.json

# 4. Restart Claude
exit
claude

# 5. Connect manually
/mcp

# 6. Verify
# Type: "list all tables"
```

---

## 📚 Additional Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Supabase MCP Server](https://github.com/supabase/mcp-server-supabase)
- [MCP Protocol](https://modelcontextprotocol.io)

---

## ✨ What's Next?

Now that Claude Code CLI has MCP access, you can:

1. **Database Management**: Query, update, and manage your database from the terminal
2. **Migration Creation**: Ask Claude to create and apply migrations
3. **Edge Function Deployment**: Deploy serverless functions conversationally
4. **Security Audits**: Regular security and performance checks
5. **Development Workflows**: Integrate database operations into your dev workflow

Try it now:
```bash
claude "show me what you can do with the database"
```

---

## 🚀 Quick Reference: Common Operations

### Schema Inspection
```sql
-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Get table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs'
ORDER BY ordinal_position;

-- View RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'jobs';

-- Check foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='jobs';
```

### Data Queries
```sql
-- Count records
SELECT COUNT(*) FROM jobs;

-- Recent records
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10;

-- Filtered search
SELECT * FROM jobs WHERE status = 'active' AND tenant_id = '<uuid>';
```

### Best Practices for This Project
1. **Always filter by tenant_id** when querying tenant-scoped tables
2. **Use execute_sql** for targeted queries (avoid list_tables)
3. **Document MCP queries** in planning artifacts (as per CLAUDE.md requirements)
4. **Test with small limits** first (LIMIT 5) before running full queries
5. **Verify RLS policies** before querying user data

### Integration with CLAUDE.md Workflow
According to project constitution (`.specify/constitution.md`):
- ✅ Use Supabase MCP as PRIMARY method for all database operations
- ✅ Document every MCP query in planning artifacts (research.md, data-model.md, etc.)
- ✅ Query live schema BEFORE making any code changes
- ✅ Include query timestamp, SQL, and key results in documentation
- ❌ Never assume schema structure - always verify with live queries
- ❌ Never create SQL for users to run - execute it directly via MCP
