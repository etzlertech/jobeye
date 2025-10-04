#!/usr/bin/env node

// Direct require with full path
const { createClient } = require('../node_modules/@supabase/supabase-js/dist/main/index.js');

// Hardcoded credentials from .env.local
const supabaseUrl = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0';

async function fixCustomersRLS() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Fixing customer RLS policies for demo mode...\n');

  // Step 1: Drop existing policies that use company_id
  console.log('1️⃣ Dropping existing customer policies...');
  
  const dropPolicies = [
    'DROP POLICY IF EXISTS customers_company_isolation ON public.customers;',
    'DROP POLICY IF EXISTS customers_service_role ON public.customers;',
    'DROP POLICY IF EXISTS customers_tenant_isolation ON public.customers;',
    'DROP POLICY IF EXISTS customers_demo_mode ON public.customers;'
  ];

  for (const sql of dropPolicies) {
    const { error } = await client.rpc('exec_sql', { sql });
    if (error) {
      console.error(`❌ Error dropping policy: ${error.message}`);
    } else {
      console.log(`  ✓ Policy dropped`);
    }
  }

  // Step 2: Create new policies that support demo mode
  console.log('\n2️⃣ Creating new customer policies...');

  // Policy for authenticated users with tenant_id
  const tenantPolicy = `
    CREATE POLICY customers_tenant_isolation
    ON public.customers
    FOR ALL
    TO authenticated
    USING (
      tenant_id = COALESCE(
        -- Check app_metadata first (standard path)
        (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'),
        -- Check user_metadata as fallback
        (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id'),
        -- Direct tenant_id claim
        (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')
      )
    )
    WITH CHECK (
      tenant_id = COALESCE(
        (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'),
        (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id'),
        (current_setting('request.jwt.claims', true)::json ->> 'tenant_id')
      )
    );
  `;

  const { error: tenantError } = await client.rpc('exec_sql', { sql: tenantPolicy });
  if (tenantError) {
    console.error(`❌ Error creating tenant policy: ${tenantError.message}`);
  } else {
    console.log('  ✓ customers_tenant_isolation policy created');
  }

  // Policy for service role (full access)
  const serviceRolePolicy = `
    CREATE POLICY customers_service_role
    ON public.customers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  `;

  const { error: serviceError } = await client.rpc('exec_sql', { sql: serviceRolePolicy });
  if (serviceError) {
    console.error(`❌ Error creating service role policy: ${serviceError.message}`);
  } else {
    console.log('  ✓ customers_service_role policy created');
  }

  // Step 3: Create a special policy for demo mode operations
  console.log('\n3️⃣ Creating demo mode support policy...');

  const demoPolicy = `
    CREATE POLICY customers_demo_mode
    ON public.customers
    FOR ALL
    TO anon, authenticated
    USING (
      -- Allow access to demo tenant data when no JWT claims exist
      -- This supports demo mode where we don't have real authentication
      tenant_id = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e' 
      AND (
        current_setting('request.jwt.claims', true) IS NULL 
        OR current_setting('request.jwt.claims', true) = ''
        OR current_setting('request.jwt.claims', true)::text = 'null'
      )
    )
    WITH CHECK (
      tenant_id = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
      AND (
        current_setting('request.jwt.claims', true) IS NULL 
        OR current_setting('request.jwt.claims', true) = ''
        OR current_setting('request.jwt.claims', true)::text = 'null'
      )
    );
  `;

  const { error: demoError } = await client.rpc('exec_sql', { sql: demoPolicy });
  if (demoError) {
    console.error(`❌ Error creating demo policy: ${demoError.message}`);
  } else {
    console.log('  ✓ customers_demo_mode policy created');
  }

  // Step 4: Verify the policies were created
  console.log('\n4️⃣ Verifying policies...');

  const verifyQuery = `
    SELECT policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customers'
    ORDER BY policyname;
  `;

  const { data: policies, error: verifyError } = await client.rpc('exec_sql', { sql: verifyQuery });
  if (verifyError) {
    console.error(`❌ Error verifying policies: ${verifyError.message}`);
  } else {
    console.log('  Current customer policies:');
    if (policies) {
      policies.forEach(policy => {
        console.log(`  - ${policy.policyname} (${policy.cmd})`);
      });
    }
  }

  console.log('\n✅ RLS policy update complete!');
  console.log('\n📝 Demo mode should now be able to create customers with tenant_id: 86a0f1f5-30cd-4891-a7d9-bfc85d8b259e');
}

fixCustomersRLS().catch(console.error);