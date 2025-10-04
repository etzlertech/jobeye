#!/usr/bin/env npx tsx
/**
 * Direct table cleanup using exec_sql for any tables that remain
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

const TARGET_TABLES = [
  'table_inventory',
  'migration_tracking',
  'background_filter_preferences',
  'offline_sync_queue',
  'service_history',
  'time_entries',
  'load_verifications',
  'route_stops',
  'routes'
];

async function dropTable(table: string): Promise<boolean> {
  const { error } = await client.rpc('exec_sql', {
    sql: `DROP TABLE IF EXISTS ${table} CASCADE;`
  });

  if (error) {
    console.log(chalk.red(`  ${table}: ${error.message}`));
    return false;
  }

  console.log(chalk.green(`  ${table}: removed`));
  return true;
}

async function verify(table: string): Promise<boolean> {
  const { error } = await client.from(table).select('id').limit(1);

  if (error && error.message.includes('does not exist')) {
    return true;
  }

  if (error) {
    console.log(chalk.yellow(`  ${table}: verification error - ${error.message}`));
    return false;
  }

  console.log(chalk.red(`  ${table}: still present`));
  return false;
}

async function main(): Promise<void> {
  console.log(chalk.bold('Direct table cleanup\n'));

  let removed = 0;
  for (const table of TARGET_TABLES) {
    const success = await dropTable(table);
    if (success) {
      removed += 1;
    }
  }

  console.log('\nVerification pass');
  let remaining = 0;
  for (const table of TARGET_TABLES) {
    const gone = await verify(table);
    if (!gone) {
      remaining += 1;
    }
  }

  console.log('\nSummary');
  console.log(`  Removed tables: ${removed}`);
  console.log(`  Remaining tables: ${remaining}`);

  if (remaining === 0) {
    console.log(chalk.green('\nAll orphaned tables removed.'));
  } else {
    console.log(chalk.yellow('\nManual inspection required for remaining tables.'));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});