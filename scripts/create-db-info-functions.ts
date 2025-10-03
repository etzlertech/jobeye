#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function createDatabaseInfoFunctions() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Creating database information functions...\n');

  // Create function to get table information
  const { error: tableInfoError } = await client.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION public.get_table_info()
      RETURNS TABLE (
        table_name text,
        row_count bigint,
        total_size text,
        has_indexes boolean,
        has_primary_key boolean,
        has_foreign_keys boolean,
        has_policies boolean,
        has_triggers boolean,
        rls_enabled boolean
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          c.relname::text AS table_name,
          c.reltuples::bigint AS row_count,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
          EXISTS (SELECT 1 FROM pg_index WHERE indrelid = c.oid) AS has_indexes,
          EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = c.oid AND contype = 'p') AS has_primary_key,
          EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = c.oid AND contype = 'f') AS has_foreign_keys,
          EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = c.oid) AS has_policies,
          EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = c.oid AND NOT tgisinternal) AS has_triggers,
          c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY c.relname;
      END
      $$;

      GRANT EXECUTE ON FUNCTION public.get_table_info() TO service_role, authenticated;
    `
  });

  if (tableInfoError) {
    console.error('❌ Error creating get_table_info function:', tableInfoError);
  } else {
    console.log('✅ Created get_table_info function');
  }

  // Create function to get column details
  const { error: columnInfoError } = await client.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION public.get_column_info(p_table_name text)
      RETURNS TABLE (
        column_name text,
        data_type text,
        is_nullable boolean,
        column_default text,
        character_maximum_length integer,
        is_primary_key boolean,
        foreign_table text,
        foreign_column text
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          a.attname::text AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          NOT a.attnotnull AS is_nullable,
          pg_get_expr(d.adbin, d.adrelid)::text AS column_default,
          CASE 
            WHEN t.typname = 'varchar' THEN a.atttypmod - 4
            ELSE NULL
          END AS character_maximum_length,
          EXISTS (
            SELECT 1 FROM pg_constraint pk
            WHERE pk.conrelid = c.oid 
              AND pk.contype = 'p'
              AND a.attnum = ANY(pk.conkey)
          ) AS is_primary_key,
          fk.foreign_table::text,
          fk.foreign_column::text
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        LEFT JOIN LATERAL (
          SELECT 
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
          FROM pg_constraint con
          JOIN information_schema.key_column_usage kcu
            ON con.conname = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = con.conname
          WHERE con.conrelid = c.oid
            AND con.contype = 'f'
            AND kcu.column_name = a.attname::text
          LIMIT 1
        ) fk ON true
        WHERE n.nspname = 'public'
          AND c.relname = p_table_name
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum;
      END
      $$;

      GRANT EXECUTE ON FUNCTION public.get_column_info(text) TO service_role, authenticated;
    `
  });

  if (columnInfoError) {
    console.error('❌ Error creating get_column_info function:', columnInfoError);
  } else {
    console.log('✅ Created get_column_info function');
  }

  // Create function to get index information
  const { error: indexInfoError } = await client.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION public.get_index_info(p_table_name text)
      RETURNS TABLE (
        index_name text,
        is_unique boolean,
        is_primary boolean,
        columns text[],
        index_size text
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          i.relname::text AS index_name,
          ix.indisunique AS is_unique,
          ix.indisprimary AS is_primary,
          ARRAY(
            SELECT a.attname::text
            FROM pg_attribute a
            WHERE a.attrelid = ix.indrelid
              AND a.attnum = ANY(ix.indkey)
            ORDER BY array_position(ix.indkey, a.attnum)
          ) AS columns,
          pg_size_pretty(pg_relation_size(i.oid)) AS index_size
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = p_table_name
        ORDER BY i.relname;
      END
      $$;

      GRANT EXECUTE ON FUNCTION public.get_index_info(text) TO service_role, authenticated;
    `
  });

  if (indexInfoError) {
    console.error('❌ Error creating get_index_info function:', indexInfoError);
  } else {
    console.log('✅ Created get_index_info function');
  }

  // Create function to get RLS policies
  const { error: policyInfoError } = await client.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION public.get_policy_info(p_table_name text)
      RETURNS TABLE (
        policy_name text,
        command text,
        permissive boolean,
        roles text[],
        using_expression text,
        check_expression text
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          pol.polname::text AS policy_name,
          CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
          END AS command,
          pol.polpermissive AS permissive,
          ARRAY(
            SELECT r.rolname::text
            FROM pg_roles r
            WHERE r.oid = ANY(pol.polroles)
          ) AS roles,
          pg_get_expr(pol.polqual, pol.polrelid)::text AS using_expression,
          pg_get_expr(pol.polwithcheck, pol.polrelid)::text AS check_expression
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = p_table_name
        ORDER BY pol.polname;
      END
      $$;

      GRANT EXECUTE ON FUNCTION public.get_policy_info(text) TO service_role, authenticated;
    `
  });

  if (policyInfoError) {
    console.error('❌ Error creating get_policy_info function:', policyInfoError);
  } else {
    console.log('✅ Created get_policy_info function');
  }

  console.log('\n✨ Database information functions created successfully!');
  console.log('\nYou can now run the improved analyzer that uses these functions.');
}

createDatabaseInfoFunctions().catch(console.error);