#!/usr/bin/env npx tsx
/**
 * Migration Script: company_id → tenant_id Standardization
 *
 * Purpose: Rename company_id columns to tenant_id for consistency
 * Affected Tables: containers, media_assets, inventory_items, vision_cost_records, kits, kit_overrides
 *
 * IMPORTANT: This is a DESTRUCTIVE operation. Backup database before running.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TABLES_TO_MIGRATE = [
  'containers',
  'media_assets',
  'inventory_items',
  'vision_cost_records',
  'kits',
  'kit_overrides',
];

async function executeSql(client: any, sql: string, description: string): Promise<boolean> {
  console.log(`  ⏳ ${description}...`);
  const { error } = await client.rpc('exec_sql', { sql });

  if (error) {
    console.error(`  ❌ FAILED: ${error.message}`);
    return false;
  }

  console.log(`  ✅ SUCCESS`);
  return true;
}

async function migrateTable(client: any, tableName: string): Promise<boolean> {
  console.log(`\n📋 Migrating ${tableName}...`);

  // Step 1: Check if column exists by trying to select from it
  let hasCompanyId = false;
  let hasTenantId = false;

  try {
    await client.from(tableName).select('company_id').limit(0);
    hasCompanyId = true;
  } catch (e) {
    // Column doesn't exist
  }

  try {
    await client.from(tableName).select('tenant_id').limit(0);
    hasTenantId = true;
  } catch (e) {
    // Column doesn't exist
  }

  if (!hasCompanyId && hasTenantId) {
    console.log(`  ✅ Already migrated (has tenant_id, no company_id)`);
    return true;
  }

  if (!hasCompanyId) {
    console.log(`  ⚠️  No company_id column found - skipping`);
    return true;
  }

  if (hasTenantId) {
    console.log(`  ⚠️  Has BOTH company_id and tenant_id - manual intervention required`);
    return false;
  }

  // Step 2: Rename column
  const renameSql = `ALTER TABLE ${tableName} RENAME COLUMN company_id TO tenant_id;`;
  const renameSuccess = await executeSql(client, renameSql, `Renaming company_id → tenant_id`);

  if (!renameSuccess) return false;

  // Step 3: Note about RLS policies
  console.log(`  ℹ️  RLS policies will need manual update (see TENANCY.md for patterns)`);

  return true;
}

async function verifyMigration(client: any): Promise<void> {
  console.log(`\n\n🔍 Verifying Migration...\n`);

  for (const table of TABLES_TO_MIGRATE) {
    let hasCompanyId = false;
    let hasTenantId = false;

    try {
      await client.from(table).select('company_id').limit(0);
      hasCompanyId = true;
    } catch (e) {
      // Column doesn't exist
    }

    try {
      await client.from(table).select('tenant_id').limit(0);
      hasTenantId = true;
    } catch (e) {
      // Column doesn't exist
    }

    if (hasTenantId && !hasCompanyId) {
      console.log(`  ✅ ${table}: tenant_id present, company_id removed`);
    } else if (hasCompanyId && !hasTenantId) {
      console.log(`  ❌ ${table}: Still has company_id (migration failed)`);
    } else if (hasTenantId && hasCompanyId) {
      console.log(`  ⚠️  ${table}: Has BOTH columns (unexpected)`);
    } else {
      console.log(`  ⚠️  ${table}: Has NEITHER column (unexpected)`);
    }
  }
}

async function main() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Starting company_id → tenant_id Migration\n');
  console.log('⚠️  WARNING: This is a DESTRUCTIVE operation!');
  console.log('⚠️  Ensure you have a database backup before proceeding.\n');
  console.log(`📊 Tables to migrate: ${TABLES_TO_MIGRATE.length}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const table of TABLES_TO_MIGRATE) {
    const success = await migrateTable(client, table);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  await verifyMigration(client);

  console.log(`\n\n📊 Migration Summary:`);
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);

  if (failCount === 0) {
    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`\n📝 Next Steps:`);
    console.log(`  1. Run: npm run generate:types`);
    console.log(`  2. Update repository code to use tenant_id`);
    console.log(`  3. Run: npm test`);
    console.log(`  4. Deploy to staging for QA`);
  } else {
    console.log(`\n⚠️  Migration completed with errors. Review failed tables.`);
    process.exit(1);
  }
}

main().catch(console.error);