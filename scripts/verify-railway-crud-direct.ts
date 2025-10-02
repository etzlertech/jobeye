#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const RAILWAY_URL = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const LOCAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyRailwayCRUD() {
  console.log('🚂 Verifying Railway CRUD Operations...\n');
  
  const supabase = createClient(RAILWAY_URL, LOCAL_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // 1. READ - List existing customers
  console.log('📖 READ: Listing existing customers...');
  const { data: customers, error: readError } = await supabase
    .from('customers')
    .select('id, name, email, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (readError) {
    console.error('❌ Read failed:', readError);
    return;
  }

  console.log(`✅ Found ${customers?.length || 0} customers:`);
  customers?.forEach(c => {
    console.log(`  - ${c.name} (${c.email}) - Created: ${new Date(c.created_at).toLocaleDateString()}`);
  });

  // 2. CREATE - Add new customer
  console.log('\n✏️ CREATE: Adding new customer...');
  const timestamp = Date.now();
  const newCustomer = {
    tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
    name: `Test Customer ${timestamp}`,
    customer_number: `TEST-${timestamp}`,
    email: `test${timestamp}@jobeye.com`,
    phone: '555-1234',
    billing_address: {
      street: '456 Test Ave',
      city: 'Test City',
      state: 'TS',
      zip: '54321'
    },
    is_active: true
  };

  const { data: created, error: createError } = await supabase
    .from('customers')
    .insert(newCustomer)
    .select()
    .single();

  if (createError) {
    console.error('❌ Create failed:', createError);
    return;
  }

  console.log('✅ Created customer:', created.name);
  console.log('  ID:', created.id);
  console.log('  Email:', created.email);

  // 3. UPDATE - Modify the customer
  console.log('\n🔄 UPDATE: Modifying customer...');
  const { data: updated, error: updateError } = await supabase
    .from('customers')
    .update({ 
      notes: 'Updated via CRUD verification script',
      tags: ['verified', 'test-customer'] 
    })
    .eq('id', created.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Update failed:', updateError);
    return;
  }

  console.log('✅ Updated customer with notes and tags');
  console.log('  Notes:', updated.notes);
  console.log('  Tags:', updated.tags);

  // 4. DELETE - Remove the test customer
  console.log('\n🗑️ DELETE: Removing test customer...');
  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .eq('id', created.id);

  if (deleteError) {
    console.error('❌ Delete failed:', deleteError);
    return;
  }

  console.log('✅ Deleted test customer');

  // 5. Verify deletion
  console.log('\n✅ VERIFICATION: Checking deletion...');
  const { data: verifyDelete, error: verifyError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', created.id)
    .single();

  if (verifyError && verifyError.code === 'PGRST116') {
    console.log('✅ Confirmed: Customer successfully deleted');
  } else if (verifyDelete) {
    console.log('❌ Customer still exists after deletion!');
  }

  console.log('\n🎉 CRUD operations completed successfully!');
  console.log('📊 Summary:');
  console.log('  - READ: Listed existing customers ✅');
  console.log('  - CREATE: Added new customer ✅');
  console.log('  - UPDATE: Modified customer data ✅');
  console.log('  - DELETE: Removed test customer ✅');
}

verifyRailwayCRUD().catch(console.error);