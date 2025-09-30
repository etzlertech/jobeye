#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function analyzeTenancy() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Analyzing Tenancy Model Across Database...\n');

  // Query information_schema for all columns named tenant_id or company_id
  const { data: tenantColumns, error: tenantError } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE column_name IN ('tenant_id', 'company_id')
        AND table_schema = 'public'
      ORDER BY
        column_name,
        table_name;
    `
  });

  if (tenantError) {
    console.error('Error:', tenantError);
    return;
  }

  console.log('📊 Tenancy Columns Found:\n');

  const tenantIdTables: string[] = [];
  const companyIdTables: string[] = [];

  for (const row of tenantColumns) {
    const tableName = row.table_name;
    const columnName = row.column_name;
    const dataType = row.data_type;
    const nullable = row.is_nullable;

    if (columnName === 'tenant_id') {
      tenantIdTables.push(tableName);
    } else if (columnName === 'company_id') {
      companyIdTables.push(tableName);
    }

    console.log(`  ${tableName}.${columnName}`);
    console.log(`    Type: ${dataType}, Nullable: ${nullable}\n`);
  }

  console.log('\n📋 Summary:\n');
  console.log(`Tables using tenant_id (${tenantIdTables.length}):`);
  tenantIdTables.forEach(t => console.log(`  - ${t}`));

  console.log(`\nTables using company_id (${companyIdTables.length}):`);
  companyIdTables.forEach(t => console.log(`  - ${t}`));

  // Check for foreign key relationships
  const { data: fkData, error: fkError } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name IN ('tenant_id', 'company_id')
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `
  });

  if (!fkError && fkData.length > 0) {
    console.log('\n🔗 Foreign Key Relationships:\n');
    for (const fk of fkData) {
      console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }
  }

  // Check RLS policies referencing these columns
  const { data: rlsData, error: rlsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (qual LIKE '%tenant_id%' OR qual LIKE '%company_id%')
      ORDER BY tablename, policyname;
    `
  });

  if (!rlsError && rlsData.length > 0) {
    console.log('\n🔒 RLS Policies Using Tenancy:\n');
    for (const policy of rlsData) {
      console.log(`  ${policy.tablename}: ${policy.policyname}`);
      console.log(`    Command: ${policy.cmd}`);
      console.log(`    Expression: ${policy.qual}\n`);
    }
  }

  console.log('\n✅ Analysis complete!');
}

analyzeTenancy().catch(console.error);