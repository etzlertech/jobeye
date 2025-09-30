#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function forceDropCustomersCompanyId() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧹 Force dropping customers.company_id column...\n');

  console.log('⚠️  Using CASCADE to drop dependencies\n');

  // Execute drop with CASCADE
  const { error } = await client.rpc('exec_sql', {
    sql: 'ALTER TABLE customers DROP COLUMN IF EXISTS company_id CASCADE;'
  });

  if (error) {
    console.error('❌ Drop failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Column and dependencies dropped successfully!\n');

  // Verify
  console.log('🔍 Verifying...');
  try {
    const { error: verifyError } = await client
      .from('customers')
      .select('company_id')
      .limit(0);

    if (verifyError && verifyError.message.includes('company_id')) {
      console.log('✅ Verified: company_id column successfully removed\n');
    } else {
      console.log('⚠️  company_id still exists or verification issue\n');
    }
  } catch (e) {
    console.log('✅ Verified: company_id column successfully removed (error as expected)\n');
  }

  console.log('🎉 customers table cleanup complete!\n');
}

forceDropCustomersCompanyId().catch(console.error);