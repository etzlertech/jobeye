#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createDatabaseInfoFunctions() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Creating database introspection functions...\n');

  try {
    // Function to get table information
    const { error: error1 } = await client.rpc('exec_sql', {
      sql: `
CREATE OR REPLACE FUNCTION get_table_info()
RETURNS TABLE (
  table_name text,
  table_schema text,
  row_count bigint,
  table_size text,
  indexes_size text,
  total_size text,
  has_rls boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    t.schemaname::text,
    COALESCE(pgc.reltuples::bigint, 0) as row_count,
    pg_size_pretty(pg_relation_size(pgc.oid)) as table_size,
    pg_size_pretty(pg_indexes_size(pgc.oid)) as indexes_size,
    pg_size_pretty(pg_total_relation_size(pgc.oid)) as total_size,
    pgc.relrowsecurity as has_rls
  FROM pg_tables t
  LEFT JOIN pg_class pgc ON pgc.relname = t.tablename 
    AND pgc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
  WHERE t.schemaname = 'public'
  ORDER BY pgc.reltuples DESC NULLS LAST;
END;
$$;
`
    });

    if (error1) {
      console.error('❌ Error creating get_table_info function:', error1);
    } else {
      console.log('✅ Created get_table_info function');
    }

    // Function to get column information
    const { error: error2 } = await client.rpc('exec_sql', {
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
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
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

    if (error2) {
      console.error('❌ Error creating get_column_info function:', error2);
    } else {
      console.log('✅ Created get_column_info function');
    }

    // Function to get foreign keys
    const { error: error3 } = await client.rpc('exec_sql', {
      sql: `
CREATE OR REPLACE FUNCTION get_foreign_keys(p_table_name text)
RETURNS TABLE (
  constraint_name text,
  column_name text,
  foreign_table_name text,
  foreign_column_name text,
  on_update text,
  on_delete text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.constraint_name::text,
    kcu.column_name::text,
    ccu.table_name::text AS foreign_table_name,
    ccu.column_name::text AS foreign_column_name,
    rc.update_rule::text AS on_update,
    rc.delete_rule::text AS on_delete
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = p_table_name;
END;
$$;
`
    });

    if (error3) {
      console.error('❌ Error creating get_foreign_keys function:', error3);
    } else {
      console.log('✅ Created get_foreign_keys function');
    }

    // Function to get indexes
    const { error: error4 } = await client.rpc('exec_sql', {
      sql: `
CREATE OR REPLACE FUNCTION get_indexes(p_table_name text)
RETURNS TABLE (
  index_name text,
  index_type text,
  is_unique boolean,
  is_primary boolean,
  columns text,
  index_size text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.indexname::text,
    am.amname::text as index_type,
    ix.indisunique,
    ix.indisprimary,
    string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum))::text as columns,
    pg_size_pretty(pg_relation_size(i.indexname::regclass))::text as index_size
  FROM pg_indexes i
  JOIN pg_class c ON c.relname = i.indexname
  JOIN pg_index ix ON ix.indexrelid = c.oid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  JOIN pg_am am ON am.oid = c.relam
  WHERE i.schemaname = 'public'
    AND i.tablename = p_table_name
  GROUP BY i.indexname, am.amname, ix.indisunique, ix.indisprimary, c.oid;
END;
$$;
`
    });

    if (error4) {
      console.error('❌ Error creating get_indexes function:', error4);
    } else {
      console.log('✅ Created get_indexes function');
    }

    // Function to get RLS policies
    const { error: error5 } = await client.rpc('exec_sql', {
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
      SELECT r.rolname
      FROM pg_roles r
      WHERE r.oid = ANY(p.polroles)
    ) as roles,
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

    if (error5) {
      console.error('❌ Error creating get_rls_policies function:', error5);
    } else {
      console.log('✅ Created get_rls_policies function');
    }

    console.log('\n✅ All database introspection functions created successfully!');
    console.log('\n💡 You can now use these functions to get detailed database information:');
    console.log('   - get_table_info() - List all tables with sizes and row counts');
    console.log('   - get_column_info(table_name) - Get column details for a table');
    console.log('   - get_foreign_keys(table_name) - Get foreign key relationships');
    console.log('   - get_indexes(table_name) - Get index information');
    console.log('   - get_rls_policies(table_name) - Get RLS policies');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createDatabaseInfoFunctions().catch(console.error);