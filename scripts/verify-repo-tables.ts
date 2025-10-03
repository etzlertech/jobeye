#!/usr/bin/env npx tsx
/**
 * Verify that all tables required by class-based repositories exist
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing environment variables'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const requiredTables = [
  // Vision domain
  'vision_verifications',
  'vision_detected_items',
  'vision_cost_records',
  // Inventory domain
  'purchase_receipts',
  'training_data_records',
  // Shared domain (from W2)
  'items',
  'item_transactions'
];

async function checkTable(tableName: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(chalk.red(`  ❌ ${tableName}: ${error.message}`));
      return false;
    }

    console.log(chalk.green(`  ✅ ${tableName}: Found (${count || 0} rows)`));
    return true;
  } catch (error: any) {
    console.log(chalk.red(`  ❌ ${tableName}: ${error.message}`));
    return false;
  }
}

async function main() {
  console.log(chalk.bold('🔍 Verifying Repository Tables\n'));

  let allExist = true;

  for (const table of requiredTables) {
    const exists = await checkTable(table);
    if (!exists) allExist = false;
  }

  console.log('\n' + chalk.bold('📊 Summary:'));
  
  if (allExist) {
    console.log(chalk.green('  ✅ All required tables exist'));
  } else {
    console.log(chalk.red('  ❌ Some tables are missing'));
    console.log(chalk.yellow('\n  Run database migrations to create missing tables'));
  }
}

main().catch(console.error);