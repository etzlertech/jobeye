#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createDemoCustomer() {
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🏢 Creating Acme Landscaping Company customer...\n');

  const timestamp = Date.now();
  const customerData = {
    tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
    name: 'Acme Landscaping Company',
    customer_number: `CUST-${timestamp}`,
    email: 'contact@acmelandscaping.com',
    phone: '555-0100',
    billing_address: {
      street: '123 Main Street, Suite 100',
      city: 'Anytown',
      state: 'CA',
      zip: '90210'
    },
    notes: 'Premium commercial customer - Weekly lawn maintenance and landscaping services',
    is_active: true,
    metadata: {
      created_via: 'UI Demo',
      demo_user: 'demo.supervisor@jobeye.app'
    }
  };

  const { data: customer, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to create customer:', error);
  } else {
    console.log('✅ Successfully created customer!');
    console.log('\n📋 Customer Details:');
    console.log('   ID:', customer.id);
    console.log('   Name:', customer.name);
    console.log('   Email:', customer.email);
    console.log('   Phone:', customer.phone);
    console.log('   Address:', `${customer.billing_address.street}, ${customer.billing_address.city}, ${customer.billing_address.state} ${customer.billing_address.zip}`);
    console.log('   Notes:', customer.notes);
    console.log('   Created:', new Date(customer.created_at).toLocaleString());
    
    // Count total customers
    const { count } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e');
    
    console.log(`\n📊 Total customers in demo tenant: ${count}`);
  }
}

createDemoCustomer().catch(console.error);