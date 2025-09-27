# Supabase Direct Database Access Instructions

## Overview
This document describes how to properly connect to and inspect the ACTUAL Supabase database schema, not rely on assumptions from migration files or expected tables.

## Key Learning
**IMPORTANT**: Always check the ACTUAL database state before writing migrations or assuming tables exist. Migration files may not have been applied, and the actual schema may differ significantly from what's in the codebase.

## Connection Methods Attempted

### 1. Direct PostgreSQL Connection (Failed)
```typescript
// Attempted with both 'postgres' and 'pg' npm packages
const DIRECT_URL = 'postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres';
```
**Issues**: 
- Network connectivity issues (ENETUNREACH)
- IPv6 resolution problems in WSL environment
- SSL certificate validation failures

### 2. Session Pooler Connection (Failed)
```typescript
const CONNECTION_STRING = 'postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
```
**Issues**:
- SASL authentication errors
- Server signature missing errors

### 3. Transaction Pooler Connection (Failed)
```typescript
const CONNECTION_STRING = 'postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
```
**Issues**:
- Same authentication errors as session pooler

### 4. Supabase Client with Service Role Key (SUCCESS!)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://PROJECT_ID.supabase.co';
const supabaseKey = 'SERVICE_ROLE_KEY'; // Use service role, not anon key

const supabase = createClient(supabaseUrl, supabaseKey);
```

## Successful Method: REST API Schema Discovery

### Step 1: Fetch OpenAPI Schema
```typescript
const response = await fetch(`${supabaseUrl}/rest/v1/`, {
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
});

const openapi = await response.json();
```

### Step 2: Extract Table Names
```typescript
const paths = Object.keys(openapi.paths || {});
const tables = paths
  .filter(path => path !== '/' && path.startsWith('/'))
  .map(path => path.substring(1))
  .filter(name => !name.includes('/'));
```

### Step 3: Query Each Table
```typescript
for (const tableName of tables) {
  const { error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (!error) {
    console.log(`Table: ${tableName} - Rows: ${count}`);
    
    // Get column info from OpenAPI definitions
    const tableDef = openapi.definitions?.[tableName];
    if (tableDef?.properties) {
      Object.entries(tableDef.properties).forEach(([col, def]) => {
        console.log(`  - ${col}: ${def.type}`);
      });
    }
  }
}
```

## Required Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_ID.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..." # Full service role key required
```

## Scripts Created

### 1. `/scripts/check-db-status.ts`
- Original script that tried to check expected tables
- Modified to use direct connection (failed due to network issues)

### 2. `/scripts/check-actual-db.ts`
- **Primary script for database inspection**
- Uses Supabase REST API to discover actual tables
- Shows row counts and column schemas
- This is the script to use for database inspection

### 3. `/scripts/check-db-detailed.ts`
- Attempted to use direct PostgreSQL for detailed schema info
- Failed due to connection issues
- Keep for reference but not functional in current environment

## Key Discoveries

### Common Pitfalls
1. **Don't assume tables exist** - The actual database had completely different tables than expected
2. **Migration files ≠ Database state** - Migrations in the repo may not have been applied
3. **Use service role key** - Anon key may not have permissions to list all tables
4. **REST API is more reliable** - Direct PostgreSQL connections often fail in cloud environments

### Actual vs Expected Tables
- **Expected** (from codebase): jobs, customers, equipment, materials, etc.
- **Actual** (from database): auth_audit_log, tenant_assignments, voice_profiles, etc.
- Completely different schema focused on auth/permissions rather than field service

## Recommended Workflow

1. **Before writing any migration**:
   ```bash
   npm run check:db-actual
   ```

2. **Review the output** to understand:
   - What tables actually exist
   - Current row counts
   - Column definitions

3. **Write migrations** based on actual state, not assumptions

4. **After running migrations**, check again to verify changes applied

## Troubleshooting

### If REST API method fails:
1. Verify service role key is correct
2. Check Supabase URL is accessible
3. Ensure you're using service role key, not anon key

### Network issues in WSL:
- REST API over HTTPS is more reliable than direct PostgreSQL
- Avoid IPv6 addresses that WSL may have trouble with
- SSL certificate issues can be bypassed with Supabase client

## Summary
Always use `/scripts/check-actual-db.ts` to inspect the database before making schema assumptions. The REST API method is the most reliable way to discover actual database structure in Supabase.