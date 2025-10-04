#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

async function fixCustomersRLS() {
  console.log('🔧 Fixing RLS policies for customers table...\n');

  const statements = [
    // Drop existing policies
    'DROP POLICY IF EXISTS customers_company_isolation ON public.customers',
    'DROP POLICY IF EXISTS customers_service_role ON public.customers',
    
    // Create new policy that uses tenant_id from app_metadata
    `CREATE POLICY customers_tenant_isolation ON public.customers
      FOR ALL
      TO authenticated
      USING (tenant_id = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')::uuid)`,
    
    // Service role can access all
    `CREATE POLICY customers_service_role ON public.customers
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)`,
  ];

  for (const stmt of statements) {
    console.log(`Executing: ${stmt.substring(0, 60)}...`);
    
    const { error } = await client.rpc('exec_sql', { sql: stmt });
    
    if (error) {
      console.error('  ❌ Error:', error.message);
    } else {
      console.log('  ✅ Success');
    }
  }

  // Verify the policies
  console.log('\n📊 Verifying new policies:');
  const { data: policies, error: verifyError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        policyname,
        roles,
        cmd,
        qual
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'customers'
      ORDER BY policyname;
    `
  });

  if (verifyError) {
    console.error('❌ Error verifying policies:', verifyError);
  } else {
    console.log('\nCurrent policies:');
    policies?.forEach((policy) => {
      console.log(`\n  ${policy.policyname}:`);
      console.log(`  - Roles: ${policy.roles}`);
      console.log(`  - Command: ${policy.cmd}`);
      console.log(`  - USING: ${policy.qual}`);
    });
  }

  console.log('\n✅ RLS policies fixed!');
  console.log('\nNOTE: The policies now expect tenant_id in app_metadata of JWT claims');
}

fixCustomersRLS().catch(console.error);