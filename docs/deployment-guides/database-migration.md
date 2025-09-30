# Database Migration Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: Database administrators and DevOps engineers

## Migration Overview

JobEye uses Supabase (PostgreSQL) with migration files in `supabase/migrations/`.

## Running Migrations

### Using Supabase Client (Recommended)
```typescript
// scripts/apply-migration.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyMigration(sqlFile: string) {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const { error } = await client.rpc('exec_sql', { sql });
  if (error) throw error;
  console.log(`✅ Applied: ${sqlFile}`);
}

// Run: npx tsx scripts/apply-migration.ts
```

### Migration File Naming
Format: `YYYYMMDD_HHMM_description.sql`
Example: `20250930_1200_add_field_intelligence_tables.sql`

## Feature 005 Migrations

Required migrations (in order):
1. `040_field_intelligence_core.sql` - Base tables
2. `041_routing_tables.sql` - GPS, geofencing
3. `042_safety_tables.sql` - Checklists, incidents
4. `043_intake_tables.sql` - Requests, OCR
5. `044_workflows_tables.sql` - Tasks, completion
6. `045_time_tracking_tables.sql` - Time entries, approvals

## Verifying Migrations

```typescript
// Check if tables exist
const { data, error } = await client
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public');

console.log('Tables:', data.map(t => t.table_name));
```

## Rollback Strategy

1. Create backup before migration
2. Test in staging environment first
3. Keep migration SQL reversible when possible
4. Contact support for emergency rollback

---
**Document Version**: 1.0
