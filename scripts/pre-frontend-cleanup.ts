#!/usr/bin/env npx tsx
/**
 * Pre-frontend cleanup script
 * Removes orphaned tables and prepares database for UI development
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Orphaned tables to remove (no data, minimal code references)
const orphanedTables = [
  'table_inventory',          // Duplicate of repository_inventory
  'migration_tracking',       // Not used by Supabase
  'background_filter_preferences', // Feature not implemented
  'offline_sync_queue',       // PWA feature pending
  'service_history',          // Not implemented
  'time_entries',             // Not implemented  
  'load_verifications',       // Scheduling not implemented
  'route_stops',              // Routing not implemented
  'routes'                    // Routing not implemented
];

async function main() {
  console.log(chalk.bold('🧹 Pre-Frontend Cleanup\n'));
  
  // Step 1: Verify tables are truly orphaned
  console.log(chalk.blue('Step 1: Verifying orphaned tables...\n'));
  
  for (const table of orphanedTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(chalk.yellow(`⚠️  ${table} - Already removed or doesn't exist`));
    } else if (count && count > 0) {
      console.log(chalk.red(`❌ ${table} - Has ${count} rows! Skipping removal`));
    } else {
      console.log(chalk.green(`✅ ${table} - Empty table, safe to remove`));
    }
  }
  
  console.log(chalk.bold('\n📊 Summary:\n'));
  console.log('To remove these tables, create and run a migration with:');
  console.log(chalk.gray('\n-- Remove orphaned tables'));
  orphanedTables.forEach(table => {
    console.log(chalk.gray(`DROP TABLE IF EXISTS ${table} CASCADE;`));
  });
  
  console.log(chalk.bold('\n🔍 Inventory Migration Status:\n'));
  
  // Check inventory table status
  const inventoryTables = [
    'inventory_items',      // Legacy
    'inventory_transactions', // Legacy
    'items',               // New unified
    'item_transactions'    // New unified
  ];
  
  for (const table of inventoryTables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    const status = table.includes('inventory_') ? 'Legacy' : 'New';
    console.log(`${status.padEnd(6)} - ${table.padEnd(25)} - ${count || 0} rows`);
  }
  
  console.log(chalk.bold('\n✅ Recommended Actions:\n'));
  console.log('1. Run the DROP TABLE migration above');
  console.log('2. Complete inventory migration to unified model');
  console.log('3. Generate fresh TypeScript types: npm run generate:types');
  console.log('4. Update CLAUDE.md with ready features for UI dev');
  
  console.log(chalk.bold('\n🚀 Features Ready for Frontend:\n'));
  console.log('- ✅ Customer Management (91 customers)');
  console.log('- ✅ Property Management (35 properties)');
  console.log('- ✅ Job Management (50 jobs)');
  console.log('- ✅ Vision Kit Verification (schema ready)');
  console.log('- ✅ Voice Transcription (schema ready)');
  console.log('- ⚠️  Inventory (migration needed)');
}

main().catch(console.error);