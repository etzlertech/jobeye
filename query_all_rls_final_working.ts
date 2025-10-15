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

  // Step 1: Get all tables
  const { data: tables, error: tablesError } = await supabase.rpc('get_table_info');

  if (tablesError) {
    console.error('❌ Error querying tables:', tablesError);
    return;
  }

  console.log(`✅ Found ${tables?.length || 0} tables\n`);

  // Step 2: Query RLS policies for each table
  const allPolicies: any[] = [];
  const suspiciousPolicies: any[] = [];
  const existsPolicies: any[] = [];

  console.log('='  .repeat(150));

  for (const table of tables || []) {
    const { data: policies, error: policiesError } = await supabase.rpc('get_rls_policies', {
      p_table_name: table.table_name
    });

    if (policiesError) {
      console.error(`❌ Error querying policies for ${table.table_name}:`, policiesError);
      continue;
    }

    if (policies && policies.length > 0) {
      for (const policy of policies) {
        const policyWithTable = {
          tablename: table.table_name,
          policyname: policy.policy_name,
          cmd: policy.cmd,
          qual: policy.qual,
          with_check: policy.with_check,
          roles: policy.roles,
          permissive: policy.permissive
        };

        allPolicies.push(policyWithTable);

        // Print policy
        console.log(`\nTable: ${table.table_name}`);
        console.log(`Policy Name: ${policy.policy_name}`);
        console.log(`Command: ${policy.cmd}`);
        console.log(`Permissive: ${policy.permissive}`);
        console.log(`Roles: ${policy.roles?.join(', ') || 'N/A'}`);
        console.log(`USING (qual): ${policy.qual || 'N/A'}`);
        console.log(`WITH CHECK: ${policy.with_check || 'N/A'}`);
        console.log('-'.repeat(150));

        // Check for users_extended references
        const qualStr = String(policy.qual || '').toLowerCase();
        const withCheckStr = String(policy.with_check || '').toLowerCase();

        if (qualStr.includes('users_extended') || withCheckStr.includes('users_extended')) {
          suspiciousPolicies.push(policyWithTable);
        }

        if (qualStr.includes('exists') || withCheckStr.includes('exists')) {
          existsPolicies.push(policyWithTable);
        }
      }
    }
  }

  console.log(`\n\n${'='.repeat(150)}`);
  console.log(`📊 SUMMARY: Found ${allPolicies.length} RLS Policies across ${tables?.length || 0} tables`);
  console.log('='.repeat(150));

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
  console.log(`🔍 POLICIES WITH EXISTS SUBQUERIES (potential recursion risk): ${existsPolicies.length} found`);
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
}

queryAllRLSPolicies().catch(console.error);
