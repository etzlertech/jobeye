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

  console.log('🔍 Querying ALL RLS Policies in public schema...\n');

  // Query policies via raw SQL query
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('schemaname', 'public')
    .order('tablename')
    .order('policyname');

  if (error) {
    console.error('❌ Error querying pg_policies view:', error);
    console.log('\nℹ️ Trying direct SQL query method...\n');

    // Try using a raw query approach
    const { data: rawData, error: rawError } = await supabase.rpc('exec', {
      sql: `
        SELECT
          schemaname,
          tablename,
          policyname,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `
    });

    if (rawError) {
      console.error('❌ Error with raw query:', rawError);
      return;
    }

    console.log('✅ Raw query succeeded\n');
    console.log(JSON.stringify(rawData, null, 2));
    return;
  }

  console.log(`📋 Found ${data?.length || 0} RLS Policies\n`);
  console.log('='  .repeat(150));

  // Track suspicious policies
  const suspiciousPolicies: any[] = [];

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

  const existsPolicies = data?.filter((policy: any) => {
    const qualStr = String(policy.qual || '').toLowerCase();
    const withCheckStr = String(policy.with_check || '').toLowerCase();
    return qualStr.includes('exists') || withCheckStr.includes('exists');
  });

  if (existsPolicies && existsPolicies.length > 0) {
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
}

queryAllRLSPolicies().catch(console.error);
