#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function queryAllRLSPolicies() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🔍 Creating query function and querying RLS policies...\n');

  // Step 1: Create a function that returns JSON
  const createFunctionSql = `
    CREATE OR REPLACE FUNCTION public.query_rls_policies()
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result json;
    BEGIN
      SELECT json_agg(row_to_json(t))
      INTO result
      FROM (
        SELECT
          schemaname,
          tablename,
          policyname,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      ) t;

      RETURN result;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.query_rls_policies() TO service_role;
  `;

  console.log('Creating query function...');
  const { error: createError } = await supabase.rpc('exec_sql', { sql: createFunctionSql });

  if (createError) {
    console.error('❌ Error creating function:', createError);
    return;
  }

  console.log('✅ Function created\n');

  // Step 2: Call the function to get policies
  console.log('Querying RLS policies...');
  const { data, error } = await supabase.rpc('query_rls_policies');

  if (error) {
    console.error('❌ Error querying policies:', error);
    return;
  }

  console.log(`\n📋 Found ${data?.length || 0} RLS Policies\n`);
  console.log('='  .repeat(150));

  // Track suspicious policies
  const suspiciousPolicies: any[] = [];
  const existsPolicies: any[] = [];

  data?.forEach((policy: any) => {
    console.log(`\nTable: ${policy.tablename}`);
    console.log(`Policy Name: ${policy.policyname}`);
    console.log(`Command: ${policy.cmd}`);
    console.log(`USING (qual): ${policy.qual || 'N/A'}`);
    console.log(`WITH CHECK: ${policy.with_check || 'N/A'}`);
    console.log('-'.repeat(150));

    // Check for users_extended references
    const qualStr = String(policy.qual || '').toLowerCase();
    const withCheckStr = String(policy.with_check || '').toLowerCase();

    if (qualStr.includes('users_extended') || withCheckStr.includes('users_extended')) {
      suspiciousPolicies.push(policy);
    }

    if (qualStr.includes('exists') || withCheckStr.includes('exists')) {
      existsPolicies.push(policy);
    }
  });

  // Print suspicious policies
  if (suspiciousPolicies.length > 0) {
    console.log('\n\n' + '='.repeat(150));
    console.log(`🚨 SUSPICIOUS POLICIES REFERENCING users_extended (${suspiciousPolicies.length} found):`);
    console.log('='.repeat(150) + '\n');

    suspiciousPolicies.forEach(pol => {
      console.log(`\n🔴 Table: ${pol.tablename}`);
      console.log(`   Policy: ${pol.policyname}`);
      console.log(`   Command: ${pol.cmd}`);
      console.log(`   USING: ${pol.qual || 'N/A'}`);
      console.log(`   WITH CHECK: ${pol.with_check || 'N/A'}`);
      console.log(`   ${'-'.repeat(140)}`);
    });
  } else {
    console.log('\n\n✅ No policies found that reference users_extended table');
  }

  // Also look for any EXISTS subqueries that might cause recursion
  console.log('\n\n' + '='.repeat(150));
  console.log('🔍 POLICIES WITH EXISTS SUBQUERIES (potential recursion risk):');
  console.log('='.repeat(150) + '\n');

  if (existsPolicies.length > 0) {
    existsPolicies.forEach(pol => {
      console.log(`\n⚠️  Table: ${pol.tablename}`);
      console.log(`   Policy: ${pol.policyname}`);
      console.log(`   Command: ${pol.cmd}`);
      console.log(`   USING: ${pol.qual || 'N/A'}`);
      console.log(`   WITH CHECK: ${pol.with_check || 'N/A'}`);
      console.log(`   ${'-'.repeat(140)}`);
    });
  } else {
    console.log('No policies with EXISTS subqueries found.');
  }

  // Clean up: drop the function
  console.log('\n\n🧹 Cleaning up...');
  await supabase.rpc('exec_sql', { sql: 'DROP FUNCTION IF EXISTS public.query_rls_policies();' });
  console.log('✅ Function removed');
}

queryAllRLSPolicies().catch(console.error);
