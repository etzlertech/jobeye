# Supabase Database Analysis Tools

A comprehensive suite of tools for analyzing your Supabase database and understanding how it's used in your codebase.

## Available Tools

### 1. Basic Live Database Analysis
```bash
npm run analyze:supabase
```
Analyzes your live Supabase database and generates comprehensive reports about tables, relationships, and storage.

### 2. Enhanced Database Analysis (NEW!)
```bash
npm run analyze:supabase:enhanced
```
Provides deep analysis including:
- Database objects (functions, views, triggers, sequences)
- Performance metrics (cache hit ratios, unused indexes, bloated tables)
- Security analysis (RLS policies, roles, permissions, vulnerabilities)
- Edge Functions analysis (if configured)
- Realtime subscriptions configuration
- Actionable recommendations with priority levels

### 3. Database-to-Codebase Mapping
```bash
npm run analyze:db-mapping
```
Scans your codebase to understand how each database table is used, identifying access patterns, unused tables, and code quality issues.

## Basic Database Analysis Features

- **Live Database Queries**: Analyzes your actual Supabase database (not migration files)
- **Table Discovery**: Automatically discovers all tables in your database
- **Comprehensive Schema Analysis**: Columns, data types, constraints, row counts
- **RLS Policy Analysis**: Security status for each table
- **Foreign Key Relationships**: Complete relationship mapping
- **Supabase Storage Analysis**: Buckets, folders, file counts, and sizes
- **Cleanup Recommendations**: Identifies empty tables and unused storage
- **AI-Agent Friendly Output**: YAML format for easy parsing
- **Archive System**: Previous reports are automatically archived

## Enhanced Analysis Features (NEW!)

### Database Objects Analysis
- **Functions**: PL/pgSQL functions with source code, volatility, and usage
- **Views**: Regular and materialized views with definitions
- **Triggers**: Event triggers with associated functions
- **Sequences**: Auto-increment sequences with current values
- **Extensions**: Installed PostgreSQL extensions
- **Custom Types**: Enums and composite types with values

### Performance Analysis
- **Index Analysis**: Usage statistics, unused indexes, missing index opportunities
- **Table Statistics**: Row counts, dead tuples, vacuum needs
- **Cache Hit Ratios**: Database and index hit ratios
- **Query Performance**: Identifies slow queries and optimization opportunities
- **Bloat Detection**: Tables and indexes with excessive bloat

### Security Analysis
- **Role Analysis**: Superusers, permissions, object ownership
- **RLS Deep Dive**: Policy expressions, permissive vs restrictive
- **Permission Audit**: Table and column-level permissions
- **Vulnerability Detection**: Critical security issues with severity levels
- **Compliance Checklist**: Security hardening recommendations

### Edge Functions & Realtime
- **Edge Functions**: Deployment status, size, error rates (requires API key)
- **Realtime Subscriptions**: Published tables, message rate estimates
- **Channel Recommendations**: Suggested realtime channels based on table patterns

## Database-to-Codebase Mapping Features

- **TypeScript AST Parsing**: Finds all database table references in your code
- **Access Pattern Detection**: Identifies repository, service, API, and direct access patterns
- **Unused Table Detection**: Finds tables with no code references
- **Code Quality Analysis**: Detects anti-patterns like direct database access
- **Relationship Mapping**: Shows how tables relate to each other
- **Operation Tracking**: Lists all database operations used per table
- **Priority Recommendations**: Actionable suggestions for improving code architecture

## Output Files

### Basic Database Analysis (`/reports/latest/`)
- `database-analysis.yaml` - Complete database analysis in YAML format
- `full-report.md` - Human-readable summary report
- `storage-analysis.yaml` - Storage bucket analysis

### Enhanced Analysis (`/reports/latest/`)
- `enhanced-analysis.yaml` - Complete enhanced analysis data (AI-friendly)
- `enhanced-report.md` - Comprehensive human-readable report
- `security-report.md` - Detailed security analysis and recommendations
- `performance-report.md` - Performance optimization guide
- `action-plan.md` - Prioritized action items (Critical, Short-term, Long-term)

### Mapping Analysis (`/mapping-reports/latest/`)
- `mapping-report.md` - Comprehensive human-readable report
- `db-code-mapping.yaml` - AI-agent friendly mapping data
- `unused-tables.yaml` - Tables with no code references

Previous reports are automatically archived with timestamps.

## Usage Workflow

### Quick Start (Basic Analysis)
```bash
# Basic database and storage analysis
npm run analyze:supabase

# Code mapping analysis
npm run analyze:db-mapping
```

### Comprehensive Analysis (Recommended)
```bash
# Run enhanced analysis with all features
npm run analyze:supabase:enhanced
```

This will generate:
1. Complete database object inventory
2. Performance optimization opportunities
3. Security vulnerability assessment
4. Prioritized action plan
5. Monitoring recommendations

### Review Reports
Check the generated reports to:
- 🚨 Fix critical security vulnerabilities
- ⚡ Optimize database performance
- 🧹 Clean up unused resources
- 📊 Improve code architecture
- 🔒 Harden security policies

## Environment Requirements

### Required Variables
The following environment variables are required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional Variables (for Enhanced Analysis)
For full Edge Functions analysis and deployment information:

```env
SUPABASE_PROJECT_REF=your-project-ref      # Found in Supabase dashboard URL
SUPABASE_MANAGEMENT_API_KEY=your-api-key   # From Supabase account settings
```

## Report Examples

### Mapping Report Structure
```yaml
analyzed_at: "2025-01-03T..."
codebase_path: "/path/to/project"
total_tables: 157
mapped_tables: 85
unmapped_tables: 72
table_mappings:
  users:
    total_references: 45
    access_patterns:
      - pattern: repository
        count: 30
      - pattern: api
        count: 15
    operations: [select, insert, update]
    relationships:
      references: [companies, roles]
      referenced_by: [jobs, properties]
```

### Key Insights Provided

1. **Unused Tables**: Tables with no code references that might be candidates for removal
2. **Direct Access Issues**: Tables accessed directly instead of through repositories
3. **Missing Type Definitions**: Frequently used tables without TypeScript types
4. **Access Pattern Inconsistencies**: Tables accessed through multiple different patterns

## Troubleshooting

### "Failed to load database analysis"
Run `npm run analyze:supabase` first to generate the database analysis that the mapping tool needs.

### "Analysis takes too long"
The tool scans all TypeScript/JavaScript files in src/, scripts/, and migrations/. Large codebases may take a few minutes.

### "Missing environment variables"
Ensure `.env.local` contains both required Supabase credentials.

## Future Enhancements

- [ ] Performance metrics (slow queries, missing indexes)
- [ ] Data quality checks (null percentages, outliers)
- [ ] Historical comparison between analysis runs
- [ ] GraphQL schema analysis
- [ ] API endpoint generation suggestions
- [ ] Automated repository generation for tables