# MCP (Model Context Protocol) Configuration

## Configured MCP Servers

### 1. Supabase MCP Server

**Package:** `@supabase/mcp-server-supabase@latest`

**Project:** rtwigjwqufozqfwozpvo

**Configuration Location:** `.claude/mcp.json`

**Capabilities:**
The Supabase MCP server provides the following tools:

#### Database Operations
- **Query Database** - Execute SQL queries against your Supabase database
- **List Tables** - Get all tables in your database schema
- **Describe Table** - Get detailed schema information for a specific table
- **List Functions** - View all database functions
- **List Views** - View all database views

#### Schema Management
- **Get Schema** - Retrieve complete database schema
- **Run Migrations** - Execute database migrations
- **Generate Types** - Generate TypeScript types from database schema

#### Edge Functions
- **List Functions** - View all edge functions
- **Deploy Function** - Deploy new edge functions
- **Invoke Function** - Test edge function execution
- **Get Function Logs** - View edge function logs

#### Storage
- **List Buckets** - View all storage buckets
- **List Files** - Browse files in storage
- **Upload File** - Upload files to storage
- **Download File** - Retrieve files from storage

#### Auth & Security
- **List Users** - View authentication users
- **Get RLS Policies** - View Row Level Security policies
- **Manage API Keys** - View and manage API keys

#### Monitoring
- **Get Logs** - Access application logs
- **Get Metrics** - View database performance metrics
- **Check Health** - Database health checks

## Usage in Claude Code

When you're in a Claude Code session (web interface), the MCP tools should be available automatically if configured.

## Usage with Claude CLI

To use MCP servers with Claude CLI, the configuration needs to be in the global Claude config directory:

```bash
# Copy project MCP config to global config
mkdir -p ~/.config/claude
cp .claude/mcp.json ~/.config/claude/mcp.json
```

Then use Claude CLI with natural language:
```bash
claude "list all tables in the database"
claude "show me the schema for the jobs table"
claude "get the RLS policies for users_extended"
```

## Connection Details

- **URL:** https://rtwigjwqufozqfwozpvo.supabase.co
- **Project ID:** rtwigjwqufozqfwozpvo
- **Authentication:** Service role key (configured in environment)

## Python Fallback

If MCP tools are not available, you can use the direct database connection via `list_tables.py` or similar scripts using:

```python
connection_string = "postgresql://postgres:Duke-neepo-oliver-ttq5@db.rtwigjwqufozqfwozpvo.supabase.co:5432/postgres"
```

## Notes

- The MCP server runs via `npx` and connects directly to your Supabase project
- All credentials are loaded from environment variables
- Service role key provides full database access (use carefully)
- MCP provides a standardized way for AI assistants to interact with external systems
