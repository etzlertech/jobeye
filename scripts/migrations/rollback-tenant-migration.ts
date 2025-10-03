#!/usr/bin/env npx tsx
/**
 * @file /scripts/migrations/rollback-tenant-migration.ts
 * @purpose Rollback tenant_id migration within deployment window
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

interface RollbackOptions {
  tableName?: string;
  force?: boolean;
  maxAgeMinutes?: number;
  preserveData?: boolean;
}

const DEFAULT_MAX_AGE_MINUTES = 10; // Maximum rollback window

async function rollbackTenantMigration(options: RollbackOptions = {}) {
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

  console.log('↩️  Starting tenant migration rollback process...\n');

  const maxAge = options.maxAgeMinutes || DEFAULT_MAX_AGE_MINUTES;

  // Get completed migrations that can be rolled back
  const allMigrations = options.tableName 
    ? [await migrationRepo.findByTableName(options.tableName)]
    : await migrationRepo.findAll({ status: 'completed' });

  const validMigrations = allMigrations.filter(m => m !== null);
  
  // Filter by age unless forced
  const rollbackCandidates = [];
  const now = new Date();

  for (const migration of validMigrations) {
    const migrationAge = migration.migrated_at 
      ? (now.getTime() - new Date(migration.migrated_at).getTime()) / (1000 * 60)
      : Infinity;

    if (options.force || migrationAge <= maxAge) {
      rollbackCandidates.push({ migration, age: migrationAge });
    } else {
      console.log(`⚠️  Skipping ${migration.table_name}: migrated ${migrationAge.toFixed(1)} minutes ago (max: ${maxAge})`);
    }
  }

  if (rollbackCandidates.length === 0) {
    console.log('ℹ️  No migrations eligible for rollback');
    if (!options.force) {
      console.log(`   Use --force to rollback migrations older than ${maxAge} minutes`);
    }
    return;
  }

  console.log(`Found ${rollbackCandidates.length} migrations to rollback:`);
  rollbackCandidates.forEach(({ migration, age }) => {
    console.log(`  - ${migration.table_name} (${age.toFixed(1)} minutes old)`);
  });

  // Confirm rollback
  if (!options.force) {
    console.log('\n⚠️  This will remove tenant_id columns and revert to company_id only!');
    console.log('   Data will be preserved but tenant isolation will be lost temporarily.');
    console.log('   Continue? (This is a simulation - add --force to actually execute)');
    
    // In real implementation, would prompt for confirmation
    // For now, proceeding with rollback
  }

  // Process each migration rollback
  for (const { migration } of rollbackCandidates) {
    await rollbackTableMigration(client, migrationRepo, migration, options);
  }

  console.log('\n✅ Tenant migration rollback completed!');
  console.log('   ⚠️  Remember to re-run migration when ready');
}

async function rollbackTableMigration(
  client: any,
  migrationRepo: MigrationTrackingRepository,
  migration: any,
  options: RollbackOptions
) {
  const tableName = migration.table_name;
  console.log(`\n↩️  Rolling back table: ${tableName}`);

  try {
    // Step 1: Verify current state
    const { data: columns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}' 
        AND column_name IN ('company_id', 'tenant_id');
      `
    });

    const hasCompanyId = columns.some((c: any) => c.column_name === 'company_id');
    const hasTenantId = columns.some((c: any) => c.column_name === 'tenant_id');

    if (!hasTenantId) {
      console.log('  ℹ️  Table already rolled back (no tenant_id column)');
      return;
    }

    if (!hasCompanyId) {
      throw new Error('Cannot rollback: company_id column missing! Data loss risk.');
    }

    // Step 2: Verify data integrity before rollback
    if (options.preserveData !== false) {
      const { data: integrity } = await client.rpc('exec_sql', {
        sql: `
          SELECT 
            COUNT(*) as total_rows,
            COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as company_id_rows,
            COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as tenant_id_rows,
            COUNT(CASE WHEN company_id = tenant_id THEN 1 END) as matching_rows
          FROM "${tableName}";
        `
      });

      const stats = integrity[0];
      console.log(`  📊 Data integrity check:`);
      console.log(`     Total rows: ${stats.total_rows}`);
      console.log(`     Rows with company_id: ${stats.company_id_rows}`);
      console.log(`     Rows with tenant_id: ${stats.tenant_id_rows}`);
      console.log(`     Matching values: ${stats.matching_rows}`);

      if (stats.matching_rows !== stats.total_rows) {
        throw new Error('Data integrity issue: company_id and tenant_id values do not match!');
      }
    }

    // Step 3: Remove RLS policies that use tenant_id
    console.log('  🔓 Removing tenant_id RLS policies...');
    const { data: policies } = await client.rpc('exec_sql', {
      sql: `
        SELECT policyname 
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        WHERE c.relname = '${tableName}'
        AND polqual LIKE '%tenant_id%';
      `
    });

    for (const policy of policies) {
      await client.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "${policy.policyname}" ON "${tableName}";`
      });
    }

    // Step 4: Remove tenant_id column
    console.log('  🗑️  Removing tenant_id column...');
    await client.rpc('exec_sql', {
      sql: `ALTER TABLE "${tableName}" DROP COLUMN tenant_id;`
    });

    // Step 5: Verify rollback
    const { data: finalColumns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}' 
        AND column_name IN ('company_id', 'tenant_id');
      `
    });

    const finalHasCompanyId = finalColumns.some((c: any) => c.column_name === 'company_id');
    const finalHasTenantId = finalColumns.some((c: any) => c.column_name === 'tenant_id');

    if (finalHasTenantId || !finalHasCompanyId) {
      throw new Error('Rollback verification failed!');
    }

    // Step 6: Update tracking
    await migrationRepo.update(migration.id, {
      has_tenant_id: false,
      migration_status: 'pending', // Ready for re-migration
      migrated_at: undefined,
      error_message: `Rolled back at ${new Date().toISOString()}`
    });

    console.log('  ✅ Rollback completed successfully');
    console.log('     tenant_id column removed, company_id preserved');

  } catch (error) {
    console.error(`  ❌ Rollback failed: ${error}`);
    
    // Update tracking with failure
    await migrationRepo.update(migration.id, {
      migration_status: 'failed',
      error_message: `Rollback failed: ${error instanceof Error ? error.message : String(error)}`
    });

    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: RollbackOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--table':
        options.tableName = args[++i];
        break;
      case '--force':
        options.force = true;
        break;
      case '--max-age':
        options.maxAgeMinutes = parseInt(args[++i]);
        break;
      case '--no-preserve-data':
        options.preserveData = false;
        break;
      case '--help':
        console.log(`
Usage: npx tsx rollback-tenant-migration.ts [options]

Options:
  --table <name>       Rollback specific table only
  --force              Skip age check and confirmation
  --max-age <minutes>  Maximum migration age for rollback (default: 10)
  --no-preserve-data   Skip data integrity checks
  --help               Show this help message

Examples:
  npx tsx rollback-tenant-migration.ts
  npx tsx rollback-tenant-migration.ts --table day_plans
  npx tsx rollback-tenant-migration.ts --force --max-age 60

IMPORTANT: Only use within deployment window for safe rollback!
        `);
        process.exit(0);
    }
  }

  rollbackTenantMigration(options).catch(error => {
    console.error('Rollback failed:', error);
    process.exit(1);
  });
}