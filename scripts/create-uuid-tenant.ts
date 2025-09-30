#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const TEST_TENANT_UUID = '00000000-0000-0000-0000-000000000099';

async function createUUIDTenant() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔧 Creating UUID tenant for E2E tests...\n');

  // Check if tenants table exists and what its schema is
  const { data: existingTenant, error: checkError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', TEST_TENANT_UUID)
    .single();

  if (!checkError || checkError.code === 'PGRST116') {
    console.log('ℹ️  Tenants table exists');
  }

  if (existingTenant) {
    console.log('✅ Test tenant already exists:', TEST_TENANT_UUID);
    return;
  }

  // Try to create tenant with minimal fields
  const { error: insertError } = await supabase
    .from('tenants')
    .insert({
      id: TEST_TENANT_UUID,
      name: 'E2E Test Tenant',
      slug: 'e2e-test-tenant'
    });

  if (insertError) {
    console.error('❌ Error creating tenant:', insertError);
    console.log('\n💡 Trying alternative: Update companies table to use UUID');
    
    // Alternative: Update the test company to have a UUID
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Update companies table to allow UUID or create mapping
        INSERT INTO companies (id, name, is_active)
        VALUES ('${TEST_TENANT_UUID}', 'E2E Test Company (UUID)', true)
        ON CONFLICT (id) DO UPDATE SET name = 'E2E Test Company (UUID)';
      `
    });

    if (updateError) {
      console.error('❌ Alternative also failed:', updateError);
      process.exit(1);
    }
    
    console.log('✅ Created company with UUID:', TEST_TENANT_UUID);
  } else {
    console.log('✅ Tenant created successfully:', TEST_TENANT_UUID);
  }

  console.log('\n📝 Use this constant in E2E tests:');
  console.log(`   const TEST_TENANT_UUID = '${TEST_TENANT_UUID}';`);
}

createUUIDTenant().catch(console.error);
