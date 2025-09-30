#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeSchema() {
  console.log('=== DATABASE SCHEMA ANALYSIS ===\n');

  // Check for company_id vs tenant_id columns
  console.log('1. Checking for company_id/tenant_id columns...');
  const { data: columns, error: colError } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND (column_name LIKE '%company%' OR column_name LIKE '%tenant%')
      ORDER BY table_name, column_name;
    `
  });
  if (colError) console.error('Column error:', colError);
  console.log('Columns:', JSON.stringify(columns, null, 2));

  // Check foreign key constraints
  console.log('\n2. Checking foreign key constraints...');
  const { data: fks, error: fkError } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `
  });
  if (fkError) console.error('FK error:', fkError);
  console.log('Foreign Keys:', JSON.stringify(fks, null, 2));

  // Check enum types
  console.log('\n3. Checking enum types...');
  const { data: enums, error: enumError } = await client.rpc('exec_sql', {
    sql: `
      SELECT t.typname as enum_name, e.enumlabel as enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `
  });
  if (enumError) console.error('Enum error:', enumError);
  console.log('Enums:', JSON.stringify(enums, null, 2));

  // Check check constraints
  console.log('\n4. Checking check constraints...');
  const { data: checks, error: checkError } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `
  });
  if (checkError) console.error('Check error:', checkError);
  console.log('Check Constraints:', JSON.stringify(checks, null, 2));

  // List all tables
  console.log('\n5. Listing all tables...');
  const { data: tables, error: tableError } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  });
  if (tableError) console.error('Table error:', tableError);
  console.log('Tables:', JSON.stringify(tables, null, 2));
}

analyzeSchema().catch(console.error);
