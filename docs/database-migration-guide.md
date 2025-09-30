# Database Migration Guide - Supabase Direct Execution

## Problem: Traditional Migration Tools Don't Work

When working with hosted Supabase instances, traditional PostgreSQL tools fail:

- ❌ **`psql`** - Not available in most development environments
- ❌ **`npx supabase db push`** - Fails with connection errors, tries to connect to local postgres
- ❌ **Direct TCP/PGBouncer** - Often blocked by firewalls, requires complex connection strings
- ❌ **DO $$ blocks** - Can fail partially and leave database in inconsistent state

## Solution: Supabase Client RPC Method

The **ONLY reliable method** that consistently works is using the Supabase JavaScript client with `client.rpc('exec_sql')`.

### Why This Works

1. Uses HTTPS (always works through firewalls)
2. Leverages existing Supabase credentials (no special connection strings)
3. Service role key has full database access
4. Same client used in application code
5. Can execute any SQL statement

## Step-by-Step Process

### 1. Create Migration SQL File

Store your migration in `supabase/migrations/`:

```sql
-- supabase/migrations/042_add_new_feature.sql
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY new_table_tenant_access ON new_table
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );
```

### 2. Create TypeScript Execution Script

Create `scripts/apply-042-migration.ts`:

```typescript
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Applying migration 042...\n');

  // Read migration file
  const sql = fs.readFileSync(
    'supabase/migrations/042_add_new_feature.sql',
    'utf-8'
  );

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    console.log(`→ ${statement.substring(0, 60)}...`);

    const { error } = await client.rpc('exec_sql', { sql: statement });

    if (error) {
      console.error('  ❌ Error:', error.message);
      process.exit(1);
    } else {
      console.log('  ✅ Success\n');
    }
  }

  console.log('✅ Migration 042 applied successfully!');
}

applyMigration().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
```

### 3. Execute the Migration

```bash
npx tsx scripts/apply-042-migration.ts
```

### 4. Verify Changes

Query the database to confirm:

```typescript
// scripts/verify-migration.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  // Check table exists
  const { data: tables } = await client
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'new_table');

  console.log('Table exists:', tables && tables.length > 0);

  // Check RLS enabled
  const { data: policies } = await client.rpc('exec_sql', {
    sql: `SELECT tablename FROM pg_tables WHERE tablename = 'new_table' AND rowsecurity = true;`
  });

  console.log('RLS enabled:', policies);
}

verify();
```

## Real-World Examples

### Example 1: Fix RLS Policies

**Problem**: RLS policies were checking wrong JWT path
**File**: `scripts/fix-rls-policies.ts`

```typescript
const statements = [
  'DROP POLICY IF EXISTS day_plans_tenant_access ON public.day_plans',
  'DROP POLICY IF EXISTS schedule_events_tenant_access ON public.schedule_events',
  `CREATE POLICY day_plans_tenant_access ON public.day_plans
    USING (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))
    WITH CHECK (company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id'))`,
];

for (const stmt of statements) {
  const { error } = await client.rpc('exec_sql', { sql: stmt });
  if (error) console.error('Error:', error);
  else console.log('✅ Success');
}
```

**Result**: Successfully fixed RLS policies, multi-tenant isolation now working

### Example 2: Add Database Trigger

**Problem**: Race conditions in API causing job limit violations
**File**: `scripts/apply-job-limit-trigger.ts`

```typescript
const sql = `
CREATE OR REPLACE FUNCTION check_job_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_job_count INTEGER;
BEGIN
  IF NEW.event_type = 'job' THEN
    SELECT COUNT(*) INTO current_job_count
    FROM schedule_events
    WHERE day_plan_id = NEW.day_plan_id
      AND event_type = 'job'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF current_job_count >= 6 THEN
      RAISE EXCEPTION 'Cannot add job: maximum of 6 jobs per technician per day';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_job_limit
  BEFORE INSERT OR UPDATE ON schedule_events
  FOR EACH ROW
  EXECUTE FUNCTION check_job_limit();
`;

const { error } = await client.rpc('exec_sql', { sql });
```

**Result**: Race conditions eliminated, 6-job limit enforced atomically

## Best Practices

### 1. Keep Migrations in Version Control

```
supabase/migrations/
├── 037_scheduling_core_tables.sql
├── 038_fix_scheduling_rls_app_metadata.sql
├── 039_enforce_6_job_limit_trigger.sql
└── 040_next_migration.sql
```

### 2. Use Descriptive Script Names

```
scripts/
├── fix-rls-policies.ts          # What it does
├── apply-job-limit-trigger.ts   # Clear purpose
└── apply-042-migration.ts       # Migration number
```

### 3. Always Check Actual Schema First

Before writing migrations, verify what actually exists:

```typescript
// Check if table exists
const { data } = await client
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public');

console.log('Existing tables:', data?.map(t => t.table_name));
```

### 4. Execute Statements Individually

Don't rely on multi-statement execution:

```typescript
// ✅ GOOD - Execute each statement separately
for (const stmt of statements) {
  await client.rpc('exec_sql', { sql: stmt });
}

// ❌ BAD - Multi-statement block can fail partially
await client.rpc('exec_sql', {
  sql: 'DROP TABLE x; CREATE TABLE y; ALTER TABLE z;'
});
```

### 5. Use IF NOT EXISTS for Idempotency

```sql
CREATE TABLE IF NOT EXISTS my_table (...);
DROP POLICY IF EXISTS my_policy ON my_table;
CREATE INDEX IF NOT EXISTS idx_name ON my_table(column);
```

### 6. Test RLS Policies Immediately

After creating/updating RLS policies:

```typescript
// Create test user with company_id
const { data: user } = await adminClient.auth.admin.createUser({
  email: 'test@example.com',
  password: 'Test123!',
  app_metadata: { company_id: 'test-company-id' }
});

// Sign in as that user
const userClient = createClient(url, anonKey);
await userClient.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'Test123!'
});

// Try to access data - should only see own company's data
const { data } = await userClient.from('my_table').select('*');
console.log('User can see:', data);
```

## Common Pitfalls

### Pitfall 1: Forgetting app_metadata in RLS

```sql
-- ❌ WRONG - This path doesn't exist
CREATE POLICY tenant_access ON my_table
  USING (company_id = auth.jwt() ->> 'company_id');

-- ✅ CORRECT - Use app_metadata path
CREATE POLICY tenant_access ON my_table
  USING (company_id::text = (
    current_setting('request.jwt.claims', true)::json
    -> 'app_metadata' ->> 'company_id'
  ));
```

### Pitfall 2: Assuming Migration Files Reflect Reality

```typescript
// ❌ WRONG - Assuming table exists based on migration file
await client.from('my_table').insert({ ... });

// ✅ CORRECT - Check first
const { data } = await client
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_name', 'my_table');

if (!data || data.length === 0) {
  console.log('Table does not exist, applying migration...');
  await applyMigration();
}
```

### Pitfall 3: Not Setting User app_metadata

```typescript
// ❌ WRONG - User won't pass RLS checks
await auth.admin.createUser({
  email: 'user@example.com',
  password: 'Test123!'
});

// ✅ CORRECT - Set company_id in app_metadata
await auth.admin.createUser({
  email: 'user@example.com',
  password: 'Test123!',
  app_metadata: {
    company_id: 'company-uuid-here'
  }
});
```

## Troubleshooting

### Issue: "exec_sql function not found"

**Solution**: The function exists but might need the right syntax:

```typescript
// Try with .select()
const { error } = await client.rpc('exec_sql', { sql }).select();
```

### Issue: Statements failing silently

**Solution**: Check for errors and log them:

```typescript
const { data, error } = await client.rpc('exec_sql', { sql: stmt });

if (error) {
  console.error('❌ Error:', error);
  console.error('   Code:', error.code);
  console.error('   Details:', error.details);
  console.error('   Hint:', error.hint);
  process.exit(1);
}
```

### Issue: RLS blocking admin operations

**Solution**: Use service role key, not anon key:

```typescript
// ✅ Service role bypasses RLS
const adminClient = createClient(url, serviceRoleKey);

// ❌ Anon key respects RLS
const userClient = createClient(url, anonKey);
```

## Summary

**Remember**: When you need to modify the Supabase database:

1. Write SQL in `supabase/migrations/XXX_description.sql`
2. Create TypeScript script in `scripts/apply-XXX-migration.ts`
3. Use `client.rpc('exec_sql', { sql })` to execute
4. Verify changes by querying database
5. Update TypeScript types with `npm run generate:types`

This is the **ONLY** reliable method that works consistently across all environments.