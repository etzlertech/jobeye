#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createTestTenant() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Creating test tenant with UUID...\n');

  // First, check if tenants table exists
  const { error: testError } = await supabase.from('tenants').select('id').limit(1);
  
  if (testError) {
    console.log('⚠️  Tenants table does not exist.');
    console.log('💡 Creating tenants table...');
    
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS tenants (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (createError) {
      console.error('❌ Failed to create tenants table:', createError);
      process.exit(1);
    }
    console.log('✅ Tenants table created');
  }

  // Create test tenant with specific UUID
  const testTenantId = '00000000-0000-0000-0000-000000000099';
  
  const { error: insertError } = await supabase
    .from('tenants')
    .upsert({
      id: testTenantId,
      name: 'E2E Test Tenant'
    }, { onConflict: 'id' });

  if (insertError && insertError.code !== '23505') {
    console.error('❌ Error creating tenant:', insertError);
    process.exit(1);
  }

  console.log(`✅ Test tenant created: ${testTenantId}`);
  console.log('\n📝 Use this tenant_id in test fixtures and E2E tests');
  console.log(`   export const TEST_TENANT_ID = '${testTenantId}';`);
}

createTestTenant().catch(console.error);
