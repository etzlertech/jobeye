#!/usr/bin/env tsx
/**
 * Script to test and verify authentication configuration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testAuthConfig() {
  console.log('🔍 Testing Authentication Configuration\n');

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Test 1: Check test users
  console.log('1️⃣ Checking test user metadata...');
  const testEmails = ['admin@tophand.tech', 'super@tophand.tech', 'crew@tophand.tech'];
  
  for (const email of testEmails) {
    const { data: { users }, error } = await client.auth.admin.listUsers({
      filter: `email.eq.${email}`
    });
    
    if (error) {
      console.error(`   ❌ Error fetching ${email}:`, error.message);
      continue;
    }
    
    const user = users?.[0];
    if (!user) {
      console.log(`   ❓ User ${email} not found`);
      continue;
    }
    
    const appMetadata = user.app_metadata || {};
    const hastenantId = !!appMetadata.tenant_id;
    const hasRoles = Array.isArray(appMetadata.roles) && appMetadata.roles.length > 0;
    
    console.log(`   ${email}:`);
    console.log(`     - Tenant ID: ${hastenantId ? '✅' : '❌'} ${appMetadata.tenant_id || 'missing'}`);
    console.log(`     - Roles: ${hasRoles ? '✅' : '❌'} ${appMetadata.roles?.join(', ') || 'missing'}`);
  }

  // Test 2: Check tenant exists
  console.log('\n2️⃣ Checking tenant records...');
  const { data: tenants, error: tenantError } = await client.rpc('exec_sql', {
    sql: "SELECT id, name, status FROM tenants WHERE status = 'active' LIMIT 5"
  });
  
  if (tenantError) {
    console.error('   ❌ Error fetching tenants:', tenantError.message);
  } else if (!tenants || tenants.length === 0) {
    console.log('   ❌ No active tenants found');
  } else {
    console.log('   ✅ Active tenants:');
    tenants.forEach((t: any) => {
      console.log(`      - ${t.name} (${t.id})`);
    });
  }

  // Test 3: Environment variables
  console.log('\n3️⃣ Checking environment configuration...');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  console.log(`   - NEXT_PUBLIC_SITE_URL: ${siteUrl ? '✅' : '❌'} ${siteUrl || 'not set'}`);
  console.log(`   - NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅' : '❌'} ${supabaseUrl}`);
  
  if (siteUrl !== 'https://jobeye-production.up.railway.app') {
    console.log('\n   ⚠️  NEXT_PUBLIC_SITE_URL should be set to https://jobeye-production.up.railway.app');
  }

  console.log('\n📋 Summary:');
  console.log('   1. Update Supabase Dashboard → Authentication → URL Configuration');
  console.log('      - Site URL: https://jobeye-production.up.railway.app');
  console.log('      - Redirect URLs: https://jobeye-production.up.railway.app/**');
  console.log('   2. Set Railway environment variable:');
  console.log('      - NEXT_PUBLIC_SITE_URL=https://jobeye-production.up.railway.app');
  console.log('   3. Redeploy on Railway');
}

testAuthConfig().catch(console.error);