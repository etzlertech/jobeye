#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testConnection() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Testing SQL connection...\n');

  // Try a simple query
  const { data, error } = await client
    .from('tenants')
    .select('id')
    .limit(1);

  if (error) {
    console.error('❌ Error connecting:', error);
    
    // Try to check if exec_sql function exists
    const { error: funcError } = await client.rpc('exec_sql', {
      sql: 'SELECT 1 as test;'
    });
    
    if (funcError) {
      console.error('\n❌ exec_sql function not available:', funcError);
      console.log('\n⚠️  The exec_sql function needs to be created in Supabase first.');
      console.log('Please create this function in the Supabase SQL editor:\n');
      console.log(`CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE sql INTO result;
  RETURN result;
END;
$$;`);
    }
  } else {
    console.log('✅ Basic connection successful');
    console.log('Data:', data);
  }
}

testConnection().catch(console.error);