#!/usr/bin/env npx tsx
/**
 * Direct Migration: company_id → tenant_id
 * Simple, direct SQL execution via exec_sql RPC
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Executing tenant_id Migration\n');

  const migrations = [
    {
      table: 'containers',
      sql: 'ALTER TABLE containers RENAME COLUMN company_id TO tenant_id;'
    },
    {
      table: 'inventory_items',
      sql: 'ALTER TABLE inventory_items RENAME COLUMN company_id TO tenant_id;'
    },
    {
      table: 'vision_cost_records',
      sql: 'ALTER TABLE vision_cost_records RENAME COLUMN company_id TO tenant_id;'
    },
    {
      table: 'kits',
      sql: 'ALTER TABLE kits RENAME COLUMN company_id TO tenant_id;'
    },
  ];

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    console.log(`\n📋 ${migration.table}:`);

    const { error } = await client.rpc('exec_sql', { sql: migration.sql });

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log(`  ⏭️  Table or column doesn't exist - skipping`);
        skipCount++;
      } else if (error.message.includes('already exists')) {
        console.log(`  ✅ Already migrated (tenant_id exists)`);
        skipCount++;
      } else {
        console.log(`  ❌ FAILED: ${error.message}`);
        failCount++;
      }
    } else {
      console.log(`  ✅ SUCCESS: company_id → tenant_id`);
      successCount++;
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  ✅ Migrated: ${successCount}`);
  console.log(`  ⏭️  Skipped: ${skipCount}`);
  console.log(`  ❌ Failed: ${failCount}`);

  if (successCount > 0) {
    console.log(`\n🎉 Migration successful!`);
    console.log(`\n📝 Next Steps:`);
    console.log(`  1. Update repository code to use tenant_id`);
    console.log(`  2. Update RLS policies`);
    console.log(`  3. Run tests`);
  }
}

main().catch(console.error);