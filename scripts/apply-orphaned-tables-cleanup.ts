#!/usr/bin/env npx tsx
/**
 * Apply the orphaned tables cleanup migration using exec_sql RPC
 * Ensures each statement in the migration runs sequentially
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '060_remove_orphaned_tables.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('Migration file 060_remove_orphaned_tables.sql not found');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

type Statement = {
  index: number;
  sql: string;
};

function parseStatements(sql: string): Statement[] {
  const statements: Statement[] = [];
  let buffer = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let counter = 0;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();

    const dollarMatch = trimmed.match(/\$(\w*)\$/);
    if (dollarMatch) {
      if (!inDollarQuote) {
        inDollarQuote = true;
        dollarTag = dollarMatch[0];
      } else if (trimmed.includes(dollarTag)) {
        inDollarQuote = false;
        dollarTag = '';
      }
    }

    buffer += line + '\n';

    if (!inDollarQuote && trimmed.endsWith(';')) {
      const statement = buffer.trim();
      if (statement.length > 0 && !statement.startsWith('--')) {
        statements.push({ index: ++counter, sql: statement });
      }
      buffer = '';
    }
  }

  if (buffer.trim().length > 0) {
    statements.push({ index: ++counter, sql: buffer.trim() });
  }

  return statements;
}

async function applyStatements(items: Statement[]): Promise<void> {
  let success = 0;
  let failure = 0;

  for (const item of items) {
    const preview = item.sql.replace(/\s+/g, ' ').slice(0, 60);
    console.log(chalk.blue(`[${item.index}/${items.length}] ${preview}...`));

    const { error } = await client.rpc('exec_sql', { sql: item.sql });
    if (error) {
      failure += 1;
      console.log(chalk.red(`   Failed: ${error.message}`));
    } else {
      success += 1;
      console.log(chalk.green('   Applied'));
    }
  }

  console.log('\nSummary');
  console.log(`  Successful statements: ${success}`);
  console.log(`  Failed statements: ${failure}`);

  if (failure > 0) {
    console.log(chalk.yellow('\nSome statements failed. Review Supabase logs or run manually.'));
    process.exit(1);
  }
}

async function verifyRemoval(): Promise<void> {
  const tables = [
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

  console.log('\nVerification');
  for (const table of tables) {
    const { error } = await client
      .from(table)
      .select('id')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      console.log(chalk.green(`  ${table}: removed`));
    } else if (error) {
      console.log(chalk.yellow(`  ${table}: verification error - ${error.message}`));
    } else {
      console.log(chalk.red(`  ${table}: still present`));
    }
  }
}

async function main(): Promise<void> {
  console.log(chalk.bold('Applying orphaned tables cleanup migration\n'));
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const statements = parseStatements(sql);

  if (statements.length === 0) {
    console.log('No statements found in migration file.');
    return;
  }

  console.log(`Found ${statements.length} statements`);
  await applyStatements(statements);
  await verifyRemoval();

  console.log('\nNext steps:');
  console.log('  npm run generate:types');
  console.log('  npx tsx scripts/get-all-tables-direct.ts');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});