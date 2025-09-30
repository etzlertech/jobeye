#!/usr/bin/env npx tsx
/**
 * Deep Database Analysis Script
 * Queries live Supabase database for comprehensive schema analysis
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface AnalysisResults {
  tables: any[];
  columns: any[];
  foreignKeys: any[];
  indexes: any[];
  rlsPolicies: any[];
  functions: any[];
}

async function analyzeDatabase(): Promise<AnalysisResults> {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Starting Deep Database Analysis...\n');

  // 1. Get all tables
  console.log('📋 Querying tables...');
  const { data: tables } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name;
    `
  });

  // 2. Get all columns with details
  console.log('📊 Querying columns...');
  const { data: columns } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name, ordinal_position;
    `
  });

  // 3. Get foreign keys
  console.log('🔗 Querying foreign keys...');
  const { data: foreignKeys } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `
  });

  // 4. Get indexes
  console.log('📇 Querying indexes...');
  const { data: indexes } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        a.attname AS column_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relkind = 'r'
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND t.relname NOT LIKE 'pg_%'
      ORDER BY t.relname, i.relname;
    `
  });

  // 5. Get RLS policies
  console.log('🔒 Querying RLS policies...');
  const { data: rlsPolicies } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `
  });

  // 6. Get functions
  console.log('⚙️  Querying functions...');
  const { data: functions } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        routine_name,
        routine_type,
        data_type AS return_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name NOT LIKE 'pg_%'
      ORDER BY routine_name;
    `
  });

  return {
    tables: tables || [],
    columns: columns || [],
    foreignKeys: foreignKeys || [],
    indexes: indexes || [],
    rlsPolicies: rlsPolicies || [],
    functions: functions || []
  };
}

async function main() {
  try {
    const results = await analyzeDatabase();

    console.log('\n\n📊 ANALYSIS RESULTS\n');
    console.log(`Tables: ${results.tables.length}`);
    console.log(`Columns: ${results.columns.length}`);
    console.log(`Foreign Keys: ${results.foreignKeys.length}`);
    console.log(`Indexes: ${results.indexes.length}`);
    console.log(`RLS Policies: ${results.rlsPolicies.length}`);
    console.log(`Functions: ${results.functions.length}`);

    // Write detailed results to file
    const fs = require('fs');
    fs.writeFileSync(
      'database-analysis-raw.json',
      JSON.stringify(results, null, 2)
    );

    console.log('\n✅ Raw analysis saved to database-analysis-raw.json');
    console.log('📝 Run analysis script to generate findings...\n');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();