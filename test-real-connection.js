/**
 * Simple Node.js script to test real Supabase connection
 * Run with: node test-real-connection.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Has Anon Key:', !!supabaseAnonKey);
console.log('Has Service Key:', !!supabaseServiceKey);

async function testConnection() {
  try {
    // Test 1: Connect with service role key
    console.log('\n1. Testing connection with service role key...');
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: tables, error: tablesError } = await serviceClient
      .from('tenants')
      .select('count')
      .limit(1);
    
    if (tablesError) {
      console.error('Error:', tablesError);
    } else {
      console.log('✅ Successfully connected to Supabase!');
    }

    // Test 2: Fetch some actual data
    console.log('\n2. Fetching role_permissions data...');
    const { data: permissions, error: permError } = await serviceClient
      .from('role_permissions')
      .select('*')
      .limit(5);
    
    if (permError) {
      console.error('Error:', permError);
    } else {
      console.log(`✅ Found ${permissions.length} role permissions`);
      console.log('Sample:', permissions[0]);
    }

    // Test 3: Test RLS with anon key
    console.log('\n3. Testing RLS with anonymous key...');
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: custData, error: custError } = await anonClient
      .from('customers')
      .select('*')
      .limit(5);
    
    if (custError) {
      console.log('✅ RLS is working - anonymous access blocked:', custError.code);
    } else {
      console.log(`⚠️  Anonymous client got ${custData?.length || 0} customers`);
    }

    // Test 4: Create and delete test data
    console.log('\n4. Testing write operations...');
    const testName = `Test-${Date.now()}`;
    
    const { data: newTenant, error: createError } = await serviceClient
      .from('tenants')
      .insert({
        name: testName,
        slug: testName.toLowerCase()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Create error:', createError);
    } else {
      console.log('✅ Created test tenant:', newTenant.id);
      
      // Clean up
      const { error: deleteError } = await serviceClient
        .from('tenants')
        .delete()
        .eq('id', newTenant.id);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
      } else {
        console.log('✅ Cleaned up test tenant');
      }
    }

    // Test 5: Check table counts
    console.log('\n5. Checking table row counts...');
    const tablesToCheck = ['customers', 'jobs', 'properties', 'equipment', 'materials'];
    
    for (const table of tablesToCheck) {
      const { count, error } = await serviceClient
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error(`Error counting ${table}:`, error.message);
      } else {
        console.log(`   ${table}: ${count} rows`);
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testConnection();