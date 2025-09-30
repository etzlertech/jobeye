#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkDatabaseSchema() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Querying live database schema...\n');

  // Get all tables using SQL
  const { data: tablesResult, error: tablesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  });

  if (tablesError) {
    console.error('❌ Error fetching tables:', tablesError);
    return;
  }

  console.log('✅ Tables query executed\n');

  // Get column counts
  const { data: columnCounts } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        table_name,
        COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name
      ORDER BY table_name;
    `
  });

  console.log('✅ Column counts query executed\n');

  // Get RLS status
  const { data: rlsStatus } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `
  });

  console.log('✅ RLS status query executed\n');

  // Get foreign key relationships
  const { data: foreignKeys } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.column_name as to_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `
  });

  console.log('✅ Foreign keys query executed\n');

  // Get indexes
  const { data: indexes } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `
  });

  console.log('✅ Indexes query executed\n');

  // Get functions
  const { data: functions } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        routine_name,
        routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      ORDER BY routine_name;
    `
  });

  console.log('✅ Functions query executed\n');

  // Get triggers
  const { data: triggers } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        trigger_name,
        event_object_table as table_name,
        action_timing,
        event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name;
    `
  });

  console.log('✅ Triggers query executed\n');

  console.log('📊 DATABASE SCHEMA SUMMARY\n');
  console.log('='.repeat(80));
  console.log(JSON.stringify({ 
    tables: tablesResult,
    columnCounts: columnCounts,
    rlsStatus: rlsStatus,
    foreignKeys: foreignKeys,
    indexes: indexes,
    functions: functions,
    triggers: triggers
  }, null, 2));
}

checkDatabaseSchema().catch(console.error);
