#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, supabaseServiceKey);

async function testInformationSchema() {
  console.log('🔍 Testing information_schema queries...\n');

  try {
    // Method 1: Try using pg_catalog
    console.log('Method 1: Querying pg_catalog.pg_tables...');
    const { data: pgTables, error: pgError } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          tableowner,
          hasindexes,
          hasrules,
          hastriggers
        FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename;
      `
    });

    if (pgError) {
      console.error('Error with pg_catalog:', pgError);
    } else if (pgTables === null) {
      console.log('pg_catalog query returned null (exec_sql might not be available)');
    } else {
      console.log(`Found ${pgTables.length} tables via pg_catalog`);
      console.log('Schemas found:', [...new Set(pgTables.map((t: any) => t.schemaname))]);
    }

    // Method 2: Try information_schema.tables
    console.log('\nMethod 2: Querying information_schema.tables...');
    const { data: infoTables, error: infoError } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          table_schema,
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name;
      `
    });

    if (infoError) {
      console.error('Error with information_schema:', infoError);
    } else if (infoTables === null) {
      console.log('information_schema query returned null');
    } else {
      console.log(`Found ${infoTables.length} tables via information_schema`);
    }

    // Method 3: Try a more direct approach - query a known Supabase internal table
    console.log('\nMethod 3: Testing direct table query...');
    const { data: authUsers, error: authError } = await client
      .from('auth.users')
      .select('id')
      .limit(1);

    if (authError) {
      console.log('Cannot access auth.users directly:', authError.message);
    } else {
      console.log('Can access auth.users table');
    }

    // Method 4: List all schemas we can see
    console.log('\nMethod 4: Listing all schemas...');
    const { data: schemas, error: schemaError } = await client.rpc('exec_sql', {
      sql: `
        SELECT schema_name 
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name;
      `
    });

    if (!schemaError && schemas !== null) {
      console.log('Available schemas:', schemas.map((s: any) => s.schema_name).join(', '));
    }

    // Method 5: Try to get table count per schema
    console.log('\nMethod 5: Counting tables per schema...');
    const { data: tableCounts, error: countError } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          table_schema,
          COUNT(*) as table_count
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
        GROUP BY table_schema
        ORDER BY table_schema;
      `
    });

    if (!countError && tableCounts !== null) {
      console.log('\nTable counts by schema:');
      tableCounts.forEach((tc: any) => {
        console.log(`  ${tc.table_schema}: ${tc.table_count} tables`);
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testInformationSchema().catch(console.error);