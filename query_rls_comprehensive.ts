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

  // First, get all tables to verify database connection
  const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
      LIMIT 10;
    `
  });

  if (tablesError) {
    console.error('❌ Error querying tables:', tablesError);
    return;
  }

  console.log('✅ Database connection successful');
  console.log(`First 10 tables: ${JSON.stringify(tables, null, 2)}\n`);

  // Now query pg_policies
  const { data, error } = await supabase.rpc('exec_sql', {
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

  if (error) {
    console.error('❌ Error querying policies:', error);
    return;
  }

  console.log(`\n📋 Raw data response: ${JSON.stringify(data, null, 2)}\n`);

  if (!data || data.length === 0) {
    console.log('⚠️  No RLS policies found or data returned in unexpected format');
    return;
  }

  console.log(`Found ${data.length} RLS Policies\n`);
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
}

queryAllRLSPolicies().catch(console.error);
