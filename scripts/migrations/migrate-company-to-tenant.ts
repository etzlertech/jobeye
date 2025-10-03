#!/usr/bin/env npx tsx
/**
 * @file /scripts/migrations/migrate-company-to-tenant.ts
 * @purpose Migrate tables from company_id to tenant_id
 * @constitution MUST run check-actual-db.ts first per Rule 1
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { MigrationTrackingRepository } from '@/domains/cleanup-tracking/repositories/migration-tracking.repository';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface MigrationOptions {
  tableName?: string;
  dryRun?: boolean;
  batchSize?: number;
}

async function migrateTenantId(options: MigrationOptions = {}) {
  console.log('🚨 MANDATORY: Running check-actual-db.ts first (Constitution Rule 1)\n');
  
  // Run check-actual-db.ts first as required by constitution
  try {
    const checkDbPath = path.join(__dirname, '..', 'check-actual-db.ts');
    execSync(`npx tsx "${checkDbPath}"`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..')
    });
    console.log('\n✅ Database precheck completed\n');
  } catch (error) {
    console.error('❌ Failed to run check-actual-db.ts - CANNOT PROCEED');
    console.error('   This is a constitutional requirement!');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseServiceKey);
  const migrationRepo = new MigrationTrackingRepository(client);

  console.log('🔄 Starting tenant_id migration process...\n');

  // Get tables that need migration
  const tablesToMigrate = options.tableName 
    ? [await migrationRepo.findByTableName(options.tableName)]
    : await migrationRepo.findTablesNeedingMigration();

  const validTables = tablesToMigrate.filter(t => t !== null);

  if (validTables.length === 0) {
    console.log('✅ No tables need migration!');
    return;
  }

  console.log(`Found ${validTables.length} tables to migrate:`);
  validTables.forEach(table => {
    console.log(`  - ${table.table_name} (${table.row_count} rows)`);
  });

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
    return;
  }

  // Process each table
  for (const table of validTables) {
    await migrateTable(client, migrationRepo, table, options);
  }

  console.log('\n✅ Tenant migration process completed!');
}

async function migrateTable(
  client: any, 
  migrationRepo: MigrationTrackingRepository, 
  tracking: any,
  options: MigrationOptions
) {
  const tableName = tracking.table_name;
  console.log(`\n🔄 Migrating table: ${tableName}`);
  
  try {
    // Mark as in progress
    await migrationRepo.update(tracking.id, {
      migration_status: 'in_progress'
    });

    const startTime = Date.now();

    // Step 1: Add tenant_id column if it doesn't exist
    console.log('  📝 Adding tenant_id column...');
    await client.rpc('exec_sql', {
      sql: `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS tenant_id UUID;`
    });

    // Step 2: Copy data from company_id to tenant_id
    console.log('  📋 Copying company_id to tenant_id...');
    const { data: updateResult } = await client.rpc('exec_sql', {
      sql: `
        UPDATE "${tableName}" 
        SET tenant_id = company_id 
        WHERE tenant_id IS NULL;
      `
    });

    // Step 3: Make tenant_id NOT NULL
    console.log('  🔒 Setting tenant_id as NOT NULL...');
    await client.rpc('exec_sql', {
      sql: `ALTER TABLE "${tableName}" ALTER COLUMN tenant_id SET NOT NULL;`
    });

    // Step 4: Verify migration
    const { data: verifyResult } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          COUNT(*) as total_rows,
          COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as tenant_id_rows,
          COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as company_id_rows,
          COUNT(CASE WHEN tenant_id = company_id THEN 1 END) as matching_rows
        FROM "${tableName}";
      `
    });

    const stats = verifyResult[0];
    const isValid = stats.total_rows === stats.tenant_id_rows && 
                   stats.total_rows === stats.matching_rows;

    if (!isValid) {
      throw new Error(`Data validation failed: ${JSON.stringify(stats)}`);
    }

    const duration = Date.now() - startTime;

    // Mark as completed
    await migrationRepo.update(tracking.id, {
      has_tenant_id: true,
      migration_status: 'completed',
      migrated_at: new Date()
    });

    console.log(`  ✅ Migration completed in ${duration}ms`);
    console.log(`     Rows processed: ${stats.total_rows}`);
    console.log(`     Data integrity: ✓`);

  } catch (error) {
    console.error(`  ❌ Migration failed: ${error}`);
    
    // Mark as failed
    await migrationRepo.update(tracking.id, {
      migration_status: 'failed',
      error_message: error instanceof Error ? error.message : String(error)
    });

    // Try to rollback
    try {
      console.log('  🔄 Attempting rollback...');
      await client.rpc('exec_sql', {
        sql: `ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS tenant_id;`
      });
      console.log('  ✅ Rollback completed');
    } catch (rollbackError) {
      console.error(`  ❌ Rollback failed: ${rollbackError}`);
    }

    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--table':
        options.tableName = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--help':
        console.log(`
Usage: npx tsx migrate-company-to-tenant.ts [options]

Options:
  --table <name>       Migrate specific table only
  --dry-run           Preview changes without executing
  --batch-size <num>  Process in batches (default: 1000)
  --help              Show this help message

Examples:
  npx tsx migrate-company-to-tenant.ts
  npx tsx migrate-company-to-tenant.ts --table day_plans
  npx tsx migrate-company-to-tenant.ts --dry-run
        `);
        process.exit(0);
    }
  }

  migrateTenantId(options).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}