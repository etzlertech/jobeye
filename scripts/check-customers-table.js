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

async function checkCustomersTable() {
  console.log('🔍 Checking customers table structure and RLS policies...\n');

  // Check columns
  console.log('📊 Columns in customers table:');
  const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customers'
      ORDER BY ordinal_position;
    `
  });

  if (columnsError) {
    console.error('❌ Error fetching columns:', columnsError);
  } else {
    columns?.forEach((col) => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
  }

  // Check RLS policies
  console.log('\n🔒 RLS policies on customers table:');
  const { data: policies, error: policiesError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'customers';
    `
  });

  if (policiesError) {
    console.error('❌ Error fetching policies:', policiesError);
  } else {
    policies?.forEach((policy) => {
      console.log(`\n  Policy: ${policy.policyname}`);
      console.log(`  - Permissive: ${policy.permissive}`);
      console.log(`  - Roles: ${policy.roles}`);
      console.log(`  - Command: ${policy.cmd}`);
      console.log(`  - USING: ${policy.qual || 'none'}`);
      console.log(`  - WITH CHECK: ${policy.with_check || 'none'}`);
    });
  }

  // Test query to check what JWT path is expected
  console.log('\n🔍 Checking JWT claims paths:');
  const { data: jwtTest, error: jwtError } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        current_setting('request.jwt.claims', true)::json as jwt_claims,
        current_setting('request.jwt.claims', true)::json->'app_metadata' as app_metadata,
        current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tenant_id' as tenant_id_from_app_metadata,
        current_setting('request.jwt.claims', true)::json->>'tenant_id' as tenant_id_direct,
        current_setting('request.jwt.claims', true)::json->>'company_id' as company_id_direct,
        current_setting('request.jwt.claims', true)::json->'app_metadata'->>'company_id' as company_id_from_app_metadata
    `
  });

  if (jwtError) {
    console.error('❌ Error checking JWT:', jwtError);
  } else if (jwtTest && jwtTest.length > 0) {
    const jwt = jwtTest[0];
    console.log('  - JWT claims:', jwt.jwt_claims ? 'Available' : 'Not available');
    console.log('  - app_metadata:', jwt.app_metadata ? 'Available' : 'Not available');
    console.log('  - tenant_id from app_metadata:', jwt.tenant_id_from_app_metadata || 'null');
    console.log('  - tenant_id direct:', jwt.tenant_id_direct || 'null');
    console.log('  - company_id direct:', jwt.company_id_direct || 'null');
    console.log('  - company_id from app_metadata:', jwt.company_id_from_app_metadata || 'null');
  }

  console.log('\n✨ Check complete!');
}

checkCustomersTable().catch(console.error);