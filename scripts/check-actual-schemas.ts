#!/usr/bin/env npx tsx
/**
 * Check actual database schemas for E2E test tables
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSchema(tableName: string) {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`\n📋 ${tableName}:`);

  // Try to select with limit 1 to get actual columns
  const { data, error } = await client
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log(`  ✅ Columns (${columns.length}):`, columns.join(', '));
    return columns;
  } else {
    // Empty table, try insert to get column info from error
    console.log(`  ℹ️  Table empty, checking via minimal insert...`);
    const { error: insertError } = await client
      .from(tableName)
      .insert({})
      .select();

    if (insertError) {
      console.log(`  ℹ️  Insert error: ${insertError.message}`);
    }
    return [];
  }
}

async function main() {
  console.log('🔍 Checking Actual Database Schemas\n');

  const tables = [
    'properties',
    'customers',
    'jobs',
    'kits',
    'kit_items',
    'equipment'
  ];

  for (const table of tables) {
    await checkSchema(table);
  }

  console.log('\n✅ Schema check complete\n');
}

main().catch(console.error);