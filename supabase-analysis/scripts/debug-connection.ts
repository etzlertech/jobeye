#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

console.log('🔍 Debug: Supabase Connection Test\n');

// Check environment variables
console.log('Environment Variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
console.log('');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables!');
  console.log('\nPlease ensure .env.local contains:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testConnection() {
  console.log('📡 Creating Supabase client...\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Test 1: Basic query to check connection
    console.log('Test 1: Basic connection test');
    const { data: test, error: testError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
    
    if (testError) {
      console.log('❌ Basic connection failed:', testError.message);
      console.log('Full error:', testError);
    } else {
      console.log('✓ Basic connection successful');
    }
    console.log('');

    // Test 2: Try using RPC for raw SQL
    console.log('Test 2: RPC exec_sql test');
    const { data: rpcTest, error: rpcError } = await supabase.rpc('exec_sql', {
      sql: "SELECT current_database() as db, current_schema() as schema"
    });
    
    if (rpcError) {
      console.log('❌ RPC exec_sql failed:', rpcError.message);
      console.log('Note: exec_sql function may not exist. This is normal.');
    } else {
      console.log('✓ RPC exec_sql successful:', rpcTest);
    }
    console.log('');

    // Test 3: Try direct table query
    console.log('Test 3: Query tables using standard Supabase approach');
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .limit(5);
    
    if (tablesError) {
      console.log('❌ Direct table query failed:', tablesError.message);
    } else {
      console.log('✓ Found tables:', tables?.map(t => t.tablename).join(', ') || 'none');
    }
    console.log('');

    // Test 4: Try a simple query to any public table
    console.log('Test 4: Query a known table (companies)');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(1);
    
    if (companiesError) {
      console.log('❌ Companies query failed:', companiesError.message);
      console.log('This might be due to RLS policies or missing table');
    } else {
      console.log('✓ Companies query successful');
      console.log('Result:', companies?.length ? `Found ${companies.length} company` : 'No companies found');
    }
    console.log('');

    // Test 5: Check if we can see system catalog
    console.log('Test 5: Query pg_catalog tables');
    const catalogQuery = `
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name 
      LIMIT 10
    `;
    
    // Try different approaches to execute raw SQL
    console.log('Attempting raw SQL query...');
    
    // Approach 1: Direct query (might not work)
    const { data: rawData, error: rawError } = await supabase
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .eq('table_schema', 'public')
      .limit(10);
    
    if (rawError) {
      console.log('❌ Information schema query failed:', rawError.message);
    } else {
      console.log('✓ Information schema query successful');
      if (rawData && rawData.length > 0) {
        console.log('Found public tables:');
        rawData.forEach(t => console.log(`  - ${t.table_name}`));
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testConnection().catch(console.error);