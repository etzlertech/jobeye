#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function checkCustomersTable() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

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
    columns?.forEach((col: any) => {
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
    policies?.forEach((policy: any) => {
      console.log(`\n  Policy: ${policy.policyname}`);
      console.log(`  - Permissive: ${policy.permissive}`);
      console.log(`  - Roles: ${policy.roles}`);
      console.log(`  - Command: ${policy.cmd}`);
      console.log(`  - USING: ${policy.qual || 'none'}`);
      console.log(`  - WITH CHECK: ${policy.with_check || 'none'}`);
    });
  }

  // Test insert with both tenant_id and company_id
  console.log('\n🧪 Testing data insertion:');
  
  const testCustomer = {
    tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
    company_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
    customer_number: `TEST-${Date.now()}`,
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '555-1234',
    billing_address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zip: '12345'
    }
  };

  const { data: inserted, error: insertError } = await client
    .from('customers')
    .insert(testCustomer)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Insert failed:', insertError.message);
  } else {
    console.log('✅ Insert successful!');
    console.log('  - ID:', inserted.id);
    console.log('  - Name:', inserted.name);
    
    // Clean up
    const { error: deleteError } = await client
      .from('customers')
      .delete()
      .eq('id', inserted.id);
    
    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError.message);
    } else {
      console.log('✅ Test data cleaned up');
    }
  }

  console.log('\n✨ Check complete!');
}

checkCustomersTable().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});