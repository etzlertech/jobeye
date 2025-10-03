#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fixDatabaseInfoFunctions() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Fixing database introspection functions...\n');

  try {
    // Fix get_column_info function - cast cardinal_number to integer
    const { error: error1 } = await client.rpc('exec_sql', {
      sql: `
CREATE OR REPLACE FUNCTION get_column_info(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer,
  is_identity text,
  identity_generation text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.character_maximum_length::integer,
    c.numeric_precision::integer,
    c.numeric_scale::integer,
    c.is_identity::text,
    c.identity_generation::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' 
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
END;
$$;
`
    });

    if (error1) {
      console.error('❌ Error fixing get_column_info function:', error1);
    } else {
      console.log('✅ Fixed get_column_info function');
    }

    // Fix get_rls_policies function - cast name[] to text[]
    const { error: error2 } = await client.rpc('exec_sql', {
      sql: `
CREATE OR REPLACE FUNCTION get_rls_policies(p_table_name text)
RETURNS TABLE (
  policy_name text,
  cmd text,
  permissive text,
  roles text[],
  qual text,
  with_check text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.polname::text as policy_name,
    CASE p.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE 'ALL'
    END::text as cmd,
    CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END::text as permissive,
    ARRAY(
      SELECT r.rolname::text
      FROM pg_roles r
      WHERE r.oid = ANY(p.polroles)
    )::text[] as roles,
    pg_get_expr(p.polqual, p.polrelid)::text as qual,
    pg_get_expr(p.polwithcheck, p.polrelid)::text as with_check
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relname = p_table_name
    AND c.relnamespace = 'public'::regnamespace;
END;
$$;
`
    });

    if (error2) {
      console.error('❌ Error fixing get_rls_policies function:', error2);
    } else {
      console.log('✅ Fixed get_rls_policies function');
    }

    console.log('\n✅ Database introspection functions fixed!');
    
    // Test the fixed functions
    console.log('\n🧪 Testing fixed functions...');
    
    const { data: columns } = await client.rpc('get_column_info', {
      p_table_name: 'jobs'
    });
    console.log(`   get_column_info returned ${columns?.length || 0} columns`);
    
    const { data: policies } = await client.rpc('get_rls_policies', {
      p_table_name: 'jobs'
    });
    console.log(`   get_rls_policies returned ${policies?.length || 0} policies`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDatabaseInfoFunctions().catch(console.error);