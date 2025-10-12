#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testPropertiesAPI() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Testing properties table access...\n');

  try {
    // Test 1: Check if properties table exists
    console.log('1. Checking if properties table exists...');
    const { data: tables, error: tableError } = await client.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'properties'
      `
    });
    
    if (tableError) {
      console.error('❌ Error checking table:', tableError);
      return;
    }
    
    console.log('✅ Properties table exists:', tables);

    // Test 2: Check table structure
    console.log('\n2. Checking properties table structure...');
    const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'properties'
        ORDER BY ordinal_position
      `
    });
    
    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
      return;
    }
    
    console.log('✅ Properties table columns:');
    columns.forEach((col: any) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Test 3: Try a simple query with tenant_id
    console.log('\n3. Testing query with tenant_id...');
    const { data: properties, error: queryError } = await client
      .from('properties')
      .select('*')
      .eq('tenant_id', 'demo-company')
      .limit(5);
    
    if (queryError) {
      console.error('❌ Error querying properties:', queryError);
      return;
    }
    
    console.log(`✅ Found ${properties?.length || 0} properties for demo-company`);

    // Test 4: Try the join query from the API
    console.log('\n4. Testing join query...');
    const { data: propertiesWithCustomer, error: joinError } = await client
      .from('properties')
      .select(`
        *,
        customer:customers(
          id,
          name,
          email
        )
      `)
      .eq('tenant_id', 'demo-company')
      .limit(5);
    
    if (joinError) {
      console.error('❌ Error with join query:', joinError);
      console.error('   This might be the cause of the 500 error!');
      
      // Check if customers table exists
      const { data: customerTable } = await client.rpc('exec_sql', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'customers'
        `
      });
      
      if (!customerTable?.length) {
        console.error('   ⚠️  customers table does not exist!');
      } else {
        console.error('   ⚠️  customers table exists, might be a foreign key issue');
      }
      return;
    }
    
    console.log(`✅ Join query successful, found ${propertiesWithCustomer?.length || 0} properties`);
    if (propertiesWithCustomer?.length > 0) {
      console.log('   Sample:', JSON.stringify(propertiesWithCustomer[0], null, 2));
    }

    // Test 5: Check RLS policies
    console.log('\n5. Checking RLS policies...');
    const { data: policies, error: policyError } = await client.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
        FROM pg_policies
        WHERE tablename = 'properties'
      `
    });
    
    if (policyError) {
      console.error('❌ Error checking policies:', policyError);
      return;
    }
    
    console.log('✅ RLS policies:');
    policies?.forEach((policy: any) => {
      console.log(`   - ${policy.policyname} (${policy.cmd})`);
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testPropertiesAPI().catch(console.error);