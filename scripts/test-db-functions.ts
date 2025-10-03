#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testDatabaseFunctions() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧪 Testing database introspection functions...\n');

  try {
    // Test get_table_info
    console.log('1️⃣ Testing get_table_info()...');
    const { data: tables, error: error1 } = await client.rpc('get_table_info');
    if (error1) {
      console.error('❌ Error:', error1);
    } else {
      console.log(`✅ Found ${tables?.length || 0} tables`);
      if (tables && tables.length > 0) {
        console.log('   Sample table:', tables[0]);
      }
    }

    // Test get_column_info
    console.log('\n2️⃣ Testing get_column_info("jobs")...');
    const { data: columns, error: error2 } = await client.rpc('get_column_info', {
      p_table_name: 'jobs'
    });
    if (error2) {
      console.error('❌ Error:', error2);
    } else {
      console.log(`✅ Found ${columns?.length || 0} columns`);
      if (columns && columns.length > 0) {
        console.log('   Sample columns:');
        columns.slice(0, 3).forEach((col: any) => {
          console.log(`   - ${col.column_name}: ${col.data_type}`);
        });
      }
    }

    // Test get_foreign_keys
    console.log('\n3️⃣ Testing get_foreign_keys("jobs")...');
    const { data: fkeys, error: error3 } = await client.rpc('get_foreign_keys', {
      p_table_name: 'jobs'
    });
    if (error3) {
      console.error('❌ Error:', error3);
    } else {
      console.log(`✅ Found ${fkeys?.length || 0} foreign keys`);
      if (fkeys && fkeys.length > 0) {
        console.log('   Sample FK:', fkeys[0]);
      }
    }

    // Test get_indexes
    console.log('\n4️⃣ Testing get_indexes("jobs")...');
    const { data: indexes, error: error4 } = await client.rpc('get_indexes', {
      p_table_name: 'jobs'
    });
    if (error4) {
      console.error('❌ Error:', error4);
    } else {
      console.log(`✅ Found ${indexes?.length || 0} indexes`);
      if (indexes && indexes.length > 0) {
        console.log('   Sample index:', indexes[0]);
      }
    }

    // Test get_rls_policies
    console.log('\n5️⃣ Testing get_rls_policies("jobs")...');
    const { data: policies, error: error5 } = await client.rpc('get_rls_policies', {
      p_table_name: 'jobs'
    });
    if (error5) {
      console.error('❌ Error:', error5);
    } else {
      console.log(`✅ Found ${policies?.length || 0} RLS policies`);
      if (policies && policies.length > 0) {
        console.log('   Sample policy:', policies[0]);
      }
    }

    // Test with a simple query
    console.log('\n6️⃣ Testing direct SQL query for columns...');
    const { data: directResult, error: directError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs' 
        LIMIT 5
      `
    });
    if (directError) {
      console.error('❌ Direct query error:', directError);
    } else {
      console.log('✅ Direct query result:', directResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDatabaseFunctions().catch(console.error);