#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function inspectSchema() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 INSPECTING LIVE DATABASE SCHEMA\n');

  // Query information_schema to see actual tables
  const { data: tables, error } = await client
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .like('table_name', '%vision%')
    .order('table_name');

  if (error) {
    console.error('Error querying schema:', error);
  } else {
    console.log('VISION-RELATED TABLES IN PUBLIC SCHEMA:');
    console.log('='.repeat(50));
    if (tables && tables.length > 0) {
      tables.forEach((t: any) => console.log(`  ✓ ${t.table_name}`));
    } else {
      console.log('  (none found)');
    }
  }

  // Also try to get row counts
  console.log('\nTABLE ROW COUNTS:');
  console.log('='.repeat(50));
  
  const testTables = ['vision_verifications', 'vision_detected_items', 'vision_cost_records'];
  
  for (const table of testTables) {
    const { count, error } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: ${count ?? 0} rows`);
    }
  }

  // Check columns for vision_verifications
  console.log('\nVISION_VERIFICATIONS COLUMNS:');
  console.log('='.repeat(50));
  const { data: columns } = await client
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'vision_verifications')
    .order('ordinal_position');

  if (columns && columns.length > 0) {
    columns.forEach((c: any) => console.log(`  ${c.column_name} (${c.data_type})`));
  } else {
    console.log('  (table not found in information_schema)');
  }
}

inspectSchema();
