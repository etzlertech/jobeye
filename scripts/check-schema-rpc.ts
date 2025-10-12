#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSchema() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking database schema via RPC...\n');

  try {
    // List all tables
    const { data: tables, error: tablesError } = await client.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `
    });

    if (tablesError) {
      console.error('❌ Error listing tables:', tablesError);
      return;
    }

    console.log(`✅ Found ${tables.length} tables in public schema:`);
    tables.forEach((table: any) => {
      console.log(`  - ${table.table_name}`);
    });

    // Check if jobs table exists
    const hasJobs = tables.some((t: any) => t.table_name === 'jobs');
    console.log(`\n${hasJobs ? '✅' : '❌'} Jobs table ${hasJobs ? 'exists' : 'does NOT exist'}!`);

    if (hasJobs) {
      // Get jobs table structure
      const { data: columns, error: colError } = await client.rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'jobs'
          ORDER BY ordinal_position
        `
      });

      if (!colError && columns) {
        console.log('\n📊 Jobs table structure:');
        columns.forEach((col: any) => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
      }

      // Check tenant_id specifically
      const tenantColumn = columns?.find((c: any) => c.column_name === 'tenant_id');
      if (tenantColumn) {
        console.log(`\n✅ tenant_id column type: ${tenantColumn.data_type}`);
        if (tenantColumn.data_type !== 'uuid') {
          console.log('⚠️  WARNING: tenant_id is not UUID type!');
        }
      }

      // Test query with UUID tenant_id
      console.log('\n🧪 Testing query with UUID tenant_id...');
      const { data: testQuery, error: testError } = await client.rpc('exec_sql', {
        sql: `
          SELECT count(*) as count 
          FROM jobs 
          WHERE tenant_id = '00000000-0000-0000-0000-000000000000'::uuid
        `
      });

      if (testError) {
        console.log('❌ Test query failed:', testError);
      } else {
        console.log('✅ Test query succeeded! Count:', testQuery[0]?.count || 0);
      }
    }

    // Also check customers and properties tables
    console.log('\n📋 Checking related tables...');
    for (const tableName of ['customers', 'properties']) {
      const hasTable = tables.some((t: any) => t.table_name === tableName);
      console.log(`${hasTable ? '✅' : '❌'} ${tableName} table ${hasTable ? 'exists' : 'does NOT exist'}`);
      
      if (hasTable) {
        const { data: cols } = await client.rpc('exec_sql', {
          sql: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '${tableName}' 
            AND column_name = 'tenant_id'
          `
        });
        if (cols?.[0]) {
          console.log(`  - tenant_id type: ${cols[0].data_type}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSchema().catch(console.error);