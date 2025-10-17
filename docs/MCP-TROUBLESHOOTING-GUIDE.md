# MCP Troubleshooting Guide

**Last Updated**: 2025-10-16 (Updated: Discovered global config location)
**Purpose**: Document MCP server configurations, common issues, and solutions for faster debugging in the future.

---

## 🚨 CRITICAL INFORMATION

**MCP Configuration Location**: Claude Code reads MCP configuration from the **GLOBAL** config file ONLY:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**NOT from project-specific** `.claude/mcp.json` files (these are ignored).

After any configuration changes, you **MUST restart Claude Code completely** for changes to take effect.

---

## Table of Contents
1. [Current MCP Configuration](#current-mcp-configuration)
2. [Installation History](#installation-history)
3. [Common Issues & Solutions](#common-issues--solutions)
4. [Verification Checklist](#verification-checklist)
5. [Reference Documentation](#reference-documentation)

---

## Current MCP Configuration

### Active MCP Servers
As of 2025-10-16, we have the following MCP servers configured:

#### 1. Supabase MCP Server (Official)
**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Status**: ✅ WORKING

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=rtwigjwqufozqfwozpvo"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "[from Supabase Dashboard]",
        "SUPABASE_URL": "https://rtwigjwqufozqfwozpvo.supabase.co",
        "SUPABASE_ANON_KEY": "[from .env.local NEXT_PUBLIC_SUPABASE_ANON_KEY]",
        "SUPABASE_SERVICE_ROLE_KEY": "[from .env.local SUPABASE_SERVICE_ROLE_KEY]"
      }
    }
  }
}
```

**Package**: `@supabase/mcp-server-supabase@0.5.6` (official package)
**NPM**: https://www.npmjs.com/package/@supabase/mcp-server-supabase
**Docs**: https://supabase.com/docs/guides/getting-started/mcp

**Available Tools**:
- `search_docs` - Search Supabase documentation
- `list_tables` - List all tables in schema(s)
- `list_extensions` - List database extensions
- `list_migrations` - List applied migrations
- `apply_migration` - Apply new migration (DDL)
- `execute_sql` - Execute raw SQL queries
- `get_logs` - Get project logs by service
- `get_advisors` - Get security/performance advisories
- `get_project_url` - Get API URL
- `get_anon_key` - Get anonymous key
- `generate_typescript_types` - Generate TypeScript types
- Edge Functions tools (list, get, deploy)
- Branch management tools (create, list, delete, merge, reset, rebase)

#### 2. Browser MCP Server
**Status**: Built-in, automatically available
**Resources**: Console logs, Playwright automation

---

## Installation History

### 2025-10-16: Supabase MCP Server Fix

#### Problem
- Supabase MCP server was not connecting
- `ListMcpResourcesTool` only showed browser MCP, not Supabase
- Configuration used non-existent package `@modelcontextprotocol/server-supabase`

#### Investigation Steps
1. Tested MCP connection with `ListMcpResourcesTool` - only browser MCP appeared
2. Attempted to run configured command manually - got 404 error from npm
3. Searched npm for correct Supabase MCP packages
4. Found community package `supabase-mcp` (latest: 1.5.0)
5. Researched correct configuration format via web search

#### Root Cause
- **Wrong package name**: Used `@modelcontextprotocol/server-supabase` (doesn't exist)
- **Wrong argument format**: Tried passing credentials as CLI args instead of env vars
- **Wrong command**: Used generic package instead of Claude-specific `supabase-mcp-claude` binary

#### Solution Applied
1. Updated `.claude/mcp.json` to use correct package: `supabase-mcp@latest`
2. Changed command to Claude-specific binary: `supabase-mcp-claude`
3. Moved credentials from args to `env` object
4. Added required `MCP_API_KEY` environment variable

#### Verification
```bash
# Test package exists
npm view supabase-mcp version
# Output: 1.5.0 ✓

# Test command with env vars
SUPABASE_URL="..." SUPABASE_ANON_KEY="..." \
SUPABASE_SERVICE_ROLE_KEY="..." MCP_API_KEY="..." \
npx -y supabase-mcp@latest supabase-mcp-claude
# Should start without errors ✓
```

#### Required Action
**IMPORTANT**: Changes to `.claude/mcp.json` require **restarting Claude Code** to take effect. MCP servers are initialized at startup.

### 2025-10-16: RESOLUTION - Found Correct Config Location

#### Discovery Process
1. MCP logs showed Supabase server WAS loading, but with different config than `.claude/mcp.json`
2. Logs revealed Claude was using `@supabase/mcp-server-supabase` (official) not `supabase-mcp` (community)
3. Found global config at `~/Library/Application Support/Claude/claude_desktop_config.json`
4. Confirmed `.claude/mcp.json` is completely ignored by Claude Code

#### Final Resolution
✅ **WORKING**: Official Supabase MCP server (`@supabase/mcp-server-supabase@0.5.6`)
✅ **Configuration**: Global config file properly updated with all credentials
✅ **Tools Available**: 20+ tools including `list_tables`, `execute_sql`, `apply_migration`, etc.

#### Previous Status (OBSOLETE)
~~**SUPABASE MCP IS NOT WORKING**~~

The MCP server configuration in `.claude/mcp.json` appears correct, but Claude Code is not loading the Supabase MCP server at runtime.

#### Possible Causes
1. **Claude Code Not Restarted**: MCP configuration changes require full restart
2. **Environment Variable Issue**: The `env` object in mcp.json may not be properly passed to the npx process
3. **Command Format Issue**: The `supabase-mcp-claude` binary might not exist or have a different name
4. **MCP Server Initialization Failure**: Silent failure during Claude Code startup (check logs)

#### Next Steps
1. ✅ Verify configuration syntax (DONE - looks correct)
2. ✅ Verify package exists (DONE - v1.5.0 confirmed)
3. ⚠️ **User must restart Claude Code completely** (if not already done)
4. ⚠️ Check Claude Code logs at `~/Library/Logs/Claude/` for MCP initialization errors
5. ⚠️ Test alternative command format (use package binary name from docs)
6. ⚠️ Consider using official Supabase MCP if available (search for alternatives)

#### Binary Verification
Confirmed binaries provided by `supabase-mcp@1.5.0`:
```bash
$ npm info supabase-mcp bin
{
  'supabase-mcp': 'dist/esm/index.js',
  'supabase-mcp-claude': 'dist/esm/claude-entry.js'
}
```
✅ The `supabase-mcp-claude` binary **does exist** and is correct in our config.

#### Diagnosis Summary
**Configuration**: ✅ Correct
**Package**: ✅ Exists (v1.5.0)
**Binary**: ✅ Exists (`supabase-mcp-claude`)
**Loading**: ❌ **Not loading in Claude Code**

**Most Likely Cause**: Claude Code has not been restarted since `.claude/mcp.json` was updated, OR there is a silent initialization failure.

#### CRITICAL DISCOVERY: Configuration File Location

**IMPORTANT**: Claude Code does NOT read project-specific `.claude/mcp.json` files!

The correct configuration location is:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

This means `.claude/mcp.json` in your project directory is **completely ignored**. All MCP configuration must be done in the global config file.

#### Required Actions for User
1. **Update the global config file** at `~/Library/Application Support/Claude/claude_desktop_config.json`
2. **Restart Claude Code completely** (quit and reopen the application) after any config changes
3. Verify MCP loads by checking `~/Library/Logs/Claude/mcp.log`
4. Note: You can remove `.claude/mcp.json` from the project as it serves no purpose

#### Fallback Method
Until MCP is working, use Python script method from CLAUDE.md:
```python
#!/usr/bin/env python3
import requests
SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "[from .env.local]"
# ... see CLAUDE.md for full script
```

---

## Common Issues & Solutions

### Issue 1: MCP Server Not Appearing in Available Servers

**Symptoms**:
- `ListMcpResourcesTool` doesn't show your MCP server
- Only default servers (browser) appear

**Diagnosis**:
```bash
# Check if package exists
npm view <package-name> version

# Try running command manually with env vars
npx -y <package-name> <command>
```

**Solutions**:
1. Verify package name is correct on npm registry
2. Check `.claude/mcp.json` syntax is valid JSON
3. Restart Claude Code to pick up configuration changes
4. Check Claude Code logs for MCP initialization errors

### Issue 2: Wrong Package or Command

**Symptoms**:
- npm 404 errors when MCP tries to start
- "command not found" errors
- MCP server not appearing in ListMcpResourcesTool

**Common Package Name Mistakes**:
- ❌ `@modelcontextprotocol/server-supabase` (doesn't exist)
- ✅ `supabase-mcp` (community package)
- ✅ `@supabase/mcp-server-postgrest` (official, different purpose)

**Binary Name Investigation**:
The `supabase-mcp` package documentation mentions a `supabase-mcp-claude` binary, but we need to verify what binaries are actually included:

```bash
# Check what binaries the package provides
npm info supabase-mcp bin

# Or install and check node_modules/.bin/
npx -y supabase-mcp@latest --version 2>&1 | head -20
```

**Solution**:
1. Search npm: `npm search <technology> mcp`
2. Verify on npmjs.com
3. **Check package.json for actual binary names**: `npm info <package> bin`
4. Read the package README on GitHub for Claude Desktop setup examples
5. Try using the package name without a subcommand if binary doesn't exist

### Issue 3: Missing Environment Variables

**Symptoms**:
- "Configuration error: Missing required environment variables"
- MCP server starts but fails to authenticate

**Solution**:
1. Check package docs for required env vars
2. Add all required vars to `env` object in `.claude/mcp.json`
3. Source credentials from `.env.local` (don't commit secrets!)
4. Common required vars:
   - Database: `*_URL`, `*_API_KEY`, `*_SERVICE_KEY`
   - MCP: `MCP_API_KEY` (custom secret)

### Issue 4: Credentials in Wrong Format

**Old/Wrong Format** (supabase-mcp):
```json
{
  "command": "npx",
  "args": ["-y", "package", "https://url", "api-key-here"]
}
```

**Correct Format**:
```json
{
  "command": "npx",
  "args": ["-y", "package", "command-name"],
  "env": {
    "SERVICE_URL": "https://url",
    "SERVICE_KEY": "api-key-here"
  }
}
```

---

## Verification Checklist

Use this checklist after making MCP configuration changes:

- [ ] Valid JSON syntax in `.claude/mcp.json`
- [ ] Package exists on npm registry (`npm view <pkg> version`)
- [ ] All required environment variables provided
- [ ] Credentials are correct and not expired
- [ ] Claude Code restarted after config changes
- [ ] `ListMcpResourcesTool` shows the new server
- [ ] Can query/test MCP resources successfully

---

## Reference Documentation

### Supabase MCP
- Official Docs: https://supabase.com/docs/guides/getting-started/mcp
- Community Package: https://www.npmjs.com/package/supabase-mcp
- GitHub: https://github.com/Cappahccino/SB-MCP

### Model Context Protocol (MCP)
- Anthropic MCP Docs: https://modelcontextprotocol.io/
- Claude Code MCP Guide: https://docs.claude.com/en/docs/claude-code/

### Finding MCP Servers
- npm search: `npm search <service> mcp`
- MCP Server Directory: https://glama.ai/mcp/servers
- LobeHub MCP Servers: https://lobehub.com/mcp

---

## Debugging Commands

```bash
# List all available MCP resources
# (Use ListMcpResourcesTool in Claude Code)

# Check npm package
npm view <package-name>

# Test package installation
npx -y <package-name>@latest --version

# Test with env vars (macOS/Linux)
SUPABASE_URL="..." npx -y supabase-mcp@latest supabase-mcp-claude

# Check Node/npm versions
node --version  # Should be v18+
npm --version

# View Claude Code logs (location varies by OS)
# macOS: ~/Library/Logs/Claude/
# Linux: ~/.config/Claude/logs/
# Windows: %APPDATA%\Claude\logs\
```

---

## Future Improvements

### Potential MCP Servers to Add
- [ ] GitHub MCP (for PR management, issues)
- [ ] Filesystem MCP (for advanced file operations)
- [ ] Custom JobEye MCP (expose domain logic to Claude)

### Configuration Management
- Consider using environment variable references in mcp.json
- Document all MCP server capabilities
- Add health check script to verify MCP servers

---

## Emergency Fallback Methods

If Supabase MCP is down, use these fallback methods:

### Python Script Method
```python
#!/usr/bin/env python3
import requests

SUPABASE_URL = "https://rtwigjwqufozqfwozpvo.supabase.co"
SUPABASE_SERVICE_KEY = "[from .env.local]"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Execute SQL
response = requests.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers=headers,
    json={"sql": "SELECT * FROM jobs LIMIT 5"}
)
print(response.json())
```

### Direct PostgREST API
```bash
curl -X POST "https://rtwigjwqufozqfwozpvo.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT current_user, current_database()"}'
```

---

## Notes

- **Security**: Never commit `.claude/mcp.json` with real credentials. Use env var references or keep it in `.gitignore`
- **Restart Required**: Always restart Claude Code after changing MCP configuration
- **Debugging**: Check both Claude Code logs and terminal output when testing MCP commands
- **Package Updates**: Pin versions in production, use `@latest` in development
- **Multiple Servers**: You can configure multiple MCP servers in the same `mcpServers` object

### KNOWN ISSUE (2025-10-16): MCP Tools Not Exposed to Claude

**Problem**: Supabase MCP server loads successfully and tools are listed in logs (`~/Library/Logs/Claude/mcp-server-supabase.log`), but tools like `apply_migration`, `execute_sql`, and `generate_typescript_types` are **NOT available as callable functions** in Claude Code.

**Evidence**:
- Log shows: `{"name":"generate_typescript_types"...}` and 20+ other tools
- `ListMcpResourcesTool` returns empty for supabase server
- No `mcp__supabase__*` functions appear in available tool list (unlike `mcp__browser__*` which DO appear)

**Current Workaround**:
- Use Python `psycopg2` for migrations (direct DB connection)
- Use `npx supabase gen types typescript` for type generation
- Use Python `requests` for SQL queries via PostgREST API

**Root Cause**: Unknown - possibly:
1. Claude Code version issue (tools not fully integrated yet)
2. MCP protocol version mismatch
3. Supabase MCP tools require different invocation pattern than browser MCP
4. Configuration issue preventing tool exposure

**Next Investigation**: Check if other users have Supabase MCP tools callable, or if this is a known limitation.

---

## Fix: Supabase MCP Not Working in Claude Code CLI (macOS) - October 16, 2025

**Problem**: Claude Code CLI couldn't execute Supabase MCP commands due to missing permissions and PATH issues.

**Root Cause**:
- Claude Code CLI requires explicit command allowlist in `~/.claude/settings.local.json`
- The sandbox environment didn't have proper PATH to find `node` and `npx`

**Solution Applied**:

1. Created `~/.claude/settings.local.json` with proper permissions:
```json
{
  "permissions": {
    "allow": [
      "Bash(npx supabase-mcp:*)",
      "Bash(npx @supabase/mcp-server-supabase:*)",
      "Bash(npx -y @supabase/mcp-server-supabase@latest:*)",
      "Bash(/usr/local/bin/npx:*)",
      "Bash(/usr/local/bin/node:*)",
      "Bash(node:*)",
      "Bash(npm:*)"
    ],
    "deny": [],
    "ask": []
  },
  "environment": {
    "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  }
}
```

2. Verified `~/Library/Application Support/Claude/claude_desktop_config.json` had correct Supabase MCP config with:
   - Correct package: `@supabase/mcp-server-supabase@latest`
   - Project reference: `--project-ref=rtwigjwqufozqfwozpvo`
   - Environment variables: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

3. Updated `.claude/mcp.json` in project directory to match (though this is for reference only - Claude Code CLI reads from global config)

4. **Required restart** of Claude Code CLI session for changes to take effect

**Key Insights**:
- The allowlist patterns must match how the MCP server is invoked
- PATH must include Node.js binary locations (`/usr/local/bin` for Homebrew installs)
- Both global config (`claude_desktop_config.json`) AND local settings (`settings.local.json`) are needed
- Restart is mandatory after any configuration change

**Verification Steps After Fix**:
```bash
# Test database connection with Python fallback
python3 test_supabase_rest.py

# After restart, test MCP tools
# Use ListMcpResourcesTool to verify supabase server appears
# Try executing queries via MCP tools
```

**Date Fixed**: October 16, 2025

---

**Maintainer**: JobEye Development Team
**Document Version**: 1.1.0
**Next Review**: When MCP issues occur or new servers are added
