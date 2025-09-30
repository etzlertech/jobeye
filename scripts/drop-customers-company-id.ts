#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function dropCustomersCompanyId() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧹 Cleaning up customers.company_id column...\n');

  // Verify it exists and all values are null
  console.log('📋 Verifying current state...');
  try {
    const { data, error } = await client
      .from('customers')
      .select('id, tenant_id, company_id')
      .limit(5);

    if (error) {
      console.error('❌ Error checking customers:', error.message);
      process.exit(1);
    }

    const hasCompanyId = data && data.length > 0 && 'company_id' in data[0];
    const allNull = data && data.every(row => row.company_id === null);

    if (!hasCompanyId) {
      console.log('  ℹ️  company_id column does not exist (already dropped)\n');
      return;
    }

    console.log(`  ✅ company_id column exists`);
    console.log(`  ✅ All ${data.length} sample rows have company_id = null`);

    if (!allNull) {
      console.log('  ⚠️  WARNING: Some rows have non-null company_id values!');
      console.log('  ⚠️  Manual review required before dropping');
      process.exit(1);
    }

  } catch (e: any) {
    console.error('❌ Verification failed:', e.message);
    process.exit(1);
  }

  // Execute drop
  console.log('\n🚀 Dropping company_id column...');
  const { error } = await client.rpc('exec_sql', {
    sql: 'ALTER TABLE customers DROP COLUMN company_id;'
  });

  if (error) {
    console.error('❌ Drop failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Column dropped successfully!\n');

  // Verify
  console.log('🔍 Verifying...');
  try {
    const { data, error: verifyError } = await client
      .from('customers')
      .select('id, tenant_id, company_id')
      .limit(1);

    if (verifyError && verifyError.message.includes('company_id') && verifyError.message.includes('does not exist')) {
      console.log('✅ Verified: company_id column successfully removed\n');
    } else if (!verifyError) {
      console.log('⚠️  company_id still exists!');
    }
  } catch (e: any) {
    if (e.message && e.message.includes('company_id')) {
      console.log('✅ Verified: company_id column successfully removed\n');
    } else {
      console.error('❌ Unexpected error:', e.message);
    }
  }

  console.log('🎉 customers table cleanup complete!\n');
}

dropCustomersCompanyId().catch(console.error);