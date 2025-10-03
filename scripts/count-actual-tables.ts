#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function countActualTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  console.log('🔍 Checking ACTUAL table count in live database...\n');

  try {
    // Try to use exec_sql if available
    const { data: tableData, error } = await client.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          COUNT(*) as table_count
        FROM pg_tables 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY schemaname
        ORDER BY schemaname;
      `
    });

    if (!error && tableData) {
      console.log('✅ Schema table counts:');
      let totalTables = 0;
      for (const row of tableData) {
        console.log(`   ${row.schemaname}: ${row.table_count} tables`);
        if (row.schemaname === 'public') {
          totalTables = row.table_count;
        }
      }
      console.log(`\n📊 Total tables in public schema: ${totalTables}`);

      // Get the actual table names
      const { data: tableNames } = await client.rpc('exec_sql', {
        sql: `
          SELECT tablename 
          FROM pg_tables 
          WHERE schemaname = 'public'
          ORDER BY tablename;
        `
      });

      if (tableNames) {
        console.log('\n📋 Tables in public schema:');
        for (const table of tableNames) {
          console.log(`   - ${table.tablename}`);
        }
      }
    } else {
      // Fallback: Try to fetch from REST API
      console.log('⚠️  exec_sql not available, trying REST API approach...\n');
      
      const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseServiceKey}`);
      const openApiSpec = await response.json();
      
      if (openApiSpec.definitions) {
        const tableNames = Object.keys(openApiSpec.definitions).filter(
          name => !name.includes('.')
        );
        
        console.log(`✅ Found ${tableNames.length} tables via REST API`);
        console.log('\n📋 Table names:');
        for (const table of tableNames.sort()) {
          console.log(`   - ${table}`);
        }
      }
    }

    // Also try to count using a different approach - query a known system table
    console.log('\n🔄 Verifying with direct queries...');
    
    // Test a few known tables to see if they exist
    const testTables = ['tenants', 'customers', 'jobs', 'properties', 'users'];
    let foundCount = 0;
    
    for (const tableName of testTables) {
      const { count, error } = await client.from(tableName).select('*', { count: 'exact', head: true });
      if (!error) {
        foundCount++;
        console.log(`   ✓ ${tableName}: ${count} rows`);
      } else {
        console.log(`   ✗ ${tableName}: not found`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

countActualTables().catch(console.error);