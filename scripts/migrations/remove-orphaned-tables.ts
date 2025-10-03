#!/usr/bin/env npx tsx
/**
 * @file /scripts/migrations/remove-orphaned-tables.ts
 * @purpose Remove orphaned tables after approval
 * @constitution MUST verify migration plan approval and use idempotent statements
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { TableInventoryRepository } from '@/domains/cleanup-tracking/repositories/table-inventory.repository';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

interface RemovalOptions {
  approvalFile?: string;
  dryRun?: boolean;
  force?: boolean;
}

async function removeOrphanedTables(options: RemovalOptions = {}) {
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
    process.exit(1);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const tableRepo = new TableInventoryRepository(client);

  console.log('🗑️  Starting orphaned table removal process...\n');

  // Get tables marked for removal
  const tablesToRemove = await tableRepo.findTablesForRemoval();
  
  if (tablesToRemove.length === 0) {
    console.log('✅ No tables marked for removal');
    return;
  }

  console.log(`Found ${tablesToRemove.length} tables marked for removal:`);
  tablesToRemove.forEach(table => {
    console.log(`  - ${table.table_name}: ${table.decision_reason}`);
  });

  // Verify migration plan approval (Constitution requirement)
  if (!options.force) {
    const approvalPath = options.approvalFile || 'migration-plan-approval.txt';
    try {
      const approvalContent = await fs.readFile(approvalPath, 'utf-8');
      console.log('✅ Migration plan approval found');
      
      // Verify each table is explicitly approved
      for (const table of tablesToRemove) {
        if (!approvalContent.includes(table.table_name)) {
          throw new Error(`Table ${table.table_name} not found in approval file`);
        }
      }
    } catch (error) {
      console.error('❌ Migration plan approval required but not found');
      console.error('   Create migration-plan-approval.txt with approved table names');
      console.error('   Or use --force to skip approval check');
      process.exit(1);
    }
  }

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - Would execute:');
    tablesToRemove.forEach(table => {
      console.log(`   DROP TABLE IF EXISTS "${table.table_name}";`);
    });
    return;
  }

  // Remove tables using idempotent single statements
  console.log('\n🗑️  Removing orphaned tables...');
  
  for (const table of tablesToRemove) {
    console.log(`  Dropping ${table.table_name}...`);
    
    try {
      // Use idempotent single-statement DROP as required by constitution
      const { error } = await client.rpc('exec_sql', {
        sql: `DROP TABLE IF EXISTS "${table.table_name}";`
      });

      if (error) {
        throw new Error(error.message);
      }

      // Remove from inventory
      await tableRepo.delete(table.id);
      
      console.log(`    ✅ Dropped successfully`);
      
    } catch (error) {
      console.error(`    ❌ Failed to drop: ${error}`);
    }
  }

  console.log('\n✅ Orphaned table removal completed!');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: RemovalOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--approval-file':
        options.approvalFile = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
        console.log(`
Usage: npx tsx remove-orphaned-tables.ts [options]

Options:
  --approval-file <path>  Path to migration plan approval file
  --dry-run              Preview changes without executing
  --force                Skip migration plan approval check
  --help                 Show this help message

Examples:
  npx tsx remove-orphaned-tables.ts --dry-run
  npx tsx remove-orphaned-tables.ts --approval-file approved-removals.txt

IMPORTANT: Migration plan approval required per Constitution Rule 1!
        `);
        process.exit(0);
    }
  }

  removeOrphanedTables(options).catch(error => {
    console.error('Table removal failed:', error);
    process.exit(1);
  });
}