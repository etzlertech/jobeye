# Supabase Database Analysis Tools

This directory contains tools for analyzing your Supabase database to get detailed information about tables, columns, indexes, foreign keys, and more.

## Problem

The default Supabase analyzers were not getting table details (columns, foreign keys, indexes) because:
1. The `exec_sql` RPC function returns `void`, not query results
2. Direct database queries via Supabase client are limited
3. Information schema queries require special permissions

## Solution

We've created three approaches to analyze your database:

### 1. Basic Analysis (db-analyzer-detailed.ts)
Uses REST API OpenAPI spec to discover tables and infer schema from the API definitions.

```bash
npm run analyze:db:detailed
```

**Pros:**
- Works without any database modifications
- Gets basic column information from API schema
- Can infer foreign keys from column naming conventions

**Cons:**
- Limited to what's exposed through REST API
- No index or policy information
- Schema might not match actual database

### 2. Comprehensive Analysis (db-analyzer-comprehensive.ts)
Uses custom RPC functions to query PostgreSQL system catalogs directly.

**Setup Required:**
```bash
# First, create the required database functions
npm run analyze:db:create-functions

# Then run the comprehensive analyzer
npm run analyze:db:comprehensive
```

**Pros:**
- Gets complete table information including:
  - All columns with exact PostgreSQL types
  - Primary keys and foreign keys
  - All indexes with their definitions
  - RLS policies with their expressions
  - Table sizes and row counts
- Generates multiple reports:
  - Markdown analysis report
  - YAML data dump
  - Complete SQL schema
  - Migration recommendations

**Cons:**
- Requires creating RPC functions in your database
- Needs service role key access

### 3. Enhanced Analysis (existing tools)
The existing enhanced analyzer that combines multiple analysis approaches.

```bash
npm run analyze:supabase:enhanced
```

## Output Files

All analyzers generate reports in timestamped directories:

```
supabase-analysis/
├── reports/
│   ├── comprehensive/
│   │   ├── 2025-10-03T.../
│   │   │   ├── comprehensive-analysis.md    # Full markdown report
│   │   │   ├── comprehensive-data.yaml      # Structured data
│   │   │   ├── complete-schema.sql          # SQL DDL statements
│   │   │   └── migration-recommendations.sql # Suggested improvements
│   │   └── latest/                          # Symlink to most recent
│   └── detailed/
│       └── 2025-10-03T.../
│           ├── detailed-analysis.md
│           ├── detailed-data.yaml
│           └── table-definitions.sql
```

## What Information You Get

### From Comprehensive Analysis:
- **Table Overview**: Name, row count, total size, feature flags
- **Columns**: Name, type, nullable, defaults, max length
- **Keys**: Primary keys, foreign keys with references
- **Indexes**: Name, type (unique/primary), columns, size
- **RLS Policies**: Name, command, roles, USING/CHECK expressions
- **Triggers**: Custom triggers on tables
- **Recommendations**: 
  - Missing primary keys
  - Missing indexes on foreign keys
  - Tables without RLS
  - Tables with RLS but no policies

### Example Output

```markdown
### 📋 customers
#### Overview
- **Row Count**: 91
- **Total Size**: 48 KB
- **RLS Enabled**: ❌ No
- **Has Primary Key**: ✅ Yes
- **Has Foreign Keys**: ✅ Yes
- **Has Indexes**: ✅ Yes

#### Columns
| Column | Type | Nullable | Default | PK | FK Reference |
|--------|------|----------|---------|----|--------------| 
| id | uuid | No | gen_random_uuid() | 🔑 | - |
| tenant_id | uuid | No | - | - | tenants.id |
| name | text | No | - | - | - |
| email | text | Yes | - | - | - |
| phone | text | Yes | - | - | - |
| created_at | timestamptz | No | now() | - | - |
```

## Troubleshooting

### Error: "Required info functions not found"
Run `npm run analyze:db:create-functions` first to create the necessary RPC functions.

### Error: "exec_sql not available"
The basic `exec_sql` function only returns void. Use the comprehensive analyzer instead.

### Error: "Permission denied"
Make sure you're using the service role key, not the anon key, for comprehensive analysis.

## Which Analyzer to Use?

1. **Quick Overview**: Use `analyze:db:detailed` for a fast overview without setup
2. **Full Analysis**: Use `analyze:db:comprehensive` for complete database documentation
3. **Migration Planning**: Use comprehensive analyzer's migration recommendations
4. **Regular Monitoring**: Set up a cron job to run comprehensive analysis weekly

## Adding New Analysis Features

To add new analysis capabilities:

1. Add new RPC functions in `create-db-info-functions.ts`
2. Update the analyzer to call your new functions
3. Add new sections to the report generator

Example: Adding constraint analysis
```sql
CREATE FUNCTION get_constraint_info(p_table_name text)
RETURNS TABLE (
  constraint_name text,
  constraint_type text,
  definition text
) AS $$
BEGIN
  -- Your query here
END
$$ LANGUAGE plpgsql SECURITY DEFINER;
```