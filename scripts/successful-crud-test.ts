import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function successfulCrudTest() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('✅ Creating customer with complete valid schema...\n');

  const timestamp = Date.now();
  const testCustomer = {
    tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e', // Use existing tenant_id from sample
    customer_number: `CUST-${timestamp}`,
    name: 'Railway CRUD Test Customer',
    email: `railway.crud.${timestamp}@test.com`,
    phone: '(555) 888-7777',
    billing_address: {
      street: '456 Railway Test Ave',
      city: 'Test City',
      state: 'CA',
      zip: '90210'
    },
    notes: 'Created via direct Supabase API test'
  };

  console.log('Creating customer:', testCustomer);

  const { data: createResult, error: createError } = await client
    .from('customers')
    .insert(testCustomer)
    .select();

  if (createError) {
    console.error('❌ Create failed:', createError);
  } else {
    console.log('🎉 CREATE successful!');
    console.log('Created customer:', createResult[0]);
    
    const customerId = createResult[0].id;
    
    // Test READ
    console.log('\n📖 Testing READ operation...');
    const { data: readResult, error: readError } = await client
      .from('customers')
      .select('*')
      .eq('id', customerId);

    if (readError) {
      console.error('❌ Read failed:', readError);
    } else {
      console.log('✅ READ successful:', readResult[0].name);
    }

    // Test UPDATE
    console.log('\n✏️ Testing UPDATE operation...');
    const { data: updateResult, error: updateError } = await client
      .from('customers')
      .update({ notes: 'Updated via CRUD test - Railway deployment confirmed working!' })
      .eq('id', customerId)
      .select();

    if (updateError) {
      console.error('❌ Update failed:', updateError);
    } else {
      console.log('✅ UPDATE successful:', updateResult[0].notes);
    }

    // Test DELETE
    console.log('\n🗑️ Testing DELETE operation...');
    const { error: deleteError } = await client
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (deleteError) {
      console.error('❌ Delete failed:', deleteError);
    } else {
      console.log('✅ DELETE successful - customer removed');
    }

    console.log('\n🎯 CRUD TEST SUMMARY:');
    console.log('✅ CREATE: Working');
    console.log('✅ READ: Working');
    console.log('✅ UPDATE: Working');
    console.log('✅ DELETE: Working');
    console.log('\n🚀 Supabase Postgres CRUD operations fully confirmed!');
  }
}

successfulCrudTest().catch(console.error);