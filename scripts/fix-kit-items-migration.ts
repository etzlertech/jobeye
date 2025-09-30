#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fixKitItems() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Fixing kit_items table migration...\n');

  // Check current state
  console.log('📋 Checking current state...');
  try {
    const { data: withCompanyId } = await client
      .from('kit_items')
      .select('id, company_id')
      .limit(1);

    if (withCompanyId) {
      console.log('  ✅ kit_items has company_id column\n');
    }
  } catch (e) {
    console.log('  ℹ️  company_id column does not exist\n');
  }

  try {
    const { data: withTenantId } = await client
      .from('kit_items')
      .select('id, tenant_id')
      .limit(1);

    if (withTenantId) {
      console.log('  ⚠️  kit_items already has tenant_id column');
      console.log('  ℹ️  Migration may have already been done\n');
      return;
    }
  } catch (e) {
    console.log('  ✅ tenant_id column does not exist (needs migration)\n');
  }

  // Execute migration
  console.log('🚀 Executing migration...');
  const { error } = await client.rpc('exec_sql', {
    sql: 'ALTER TABLE kit_items RENAME COLUMN company_id TO tenant_id;'
  });

  if (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Migration successful!\n');

  // Verify
  console.log('🔍 Verifying...');
  try {
    const { data, error: verifyError } = await client
      .from('kit_items')
      .select('id, tenant_id')
      .limit(2);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      process.exit(1);
    }

    console.log(`✅ Verified: kit_items.tenant_id accessible (${data?.length || 0} rows checked)`);
    if (data && data.length > 0) {
      console.log(`   Sample tenant_id: ${data[0].tenant_id}`);
    }
  } catch (e: any) {
    console.error('❌ Verification error:', e.message);
    process.exit(1);
  }

  console.log('\n🎉 kit_items migration complete!\n');
}

fixKitItems().catch(console.error);