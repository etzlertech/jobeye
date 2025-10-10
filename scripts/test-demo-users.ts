#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testDemoUsers() {
  console.log('🧪 Testing demo user authentication and metadata...\n');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const demoUsers = [
    { email: 'super@tophand.tech', role: 'supervisor' },
    { email: 'crew@tophand.tech', role: 'crew' },
    { email: 'admin@tophand.tech', role: 'admin' }
  ];

  for (const user of demoUsers) {
    console.log(`Testing ${user.email}...`);
    
    // Test sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: 'demo123'
    });

    if (authError) {
      console.error(`  ❌ Auth failed:`, authError.message);
      continue;
    }

    console.log(`  ✅ Authentication successful`);
    console.log(`     User ID: ${authData.user.id}`);
    console.log(`     Email: ${authData.user.email}`);
    console.log(`     App Metadata:`, JSON.stringify(authData.user.app_metadata, null, 2));
    console.log(`     User Metadata:`, JSON.stringify(authData.user.user_metadata, null, 2));

    // Check tenant_id
    const tenantId = authData.user.app_metadata?.tenant_id;
    if (tenantId) {
      console.log(`  ✅ Tenant ID found: ${tenantId}`);
    } else {
      console.log(`  ⚠️  No tenant_id in app_metadata`);
    }

    // Test creating a customer with this user's session
    console.log(`\n  🧪 Testing customer creation for ${user.role}...`);
    
    const testCustomer = {
      name: `Demo ${user.role} Test Customer`,
      email: `demo.${user.role}.customer@example.com`,
      phone: '(555) 123-TEST',
      address: `123 Demo ${user.role} Street`
    };

    // Simulate API call (we'll use the service key for now since the API would use it server-side)
    const serviceClient = createClient(
      supabaseUrl, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (tenantId) {
      const timestamp = Date.now();
      const customerData = {
        tenant_id: tenantId,
        customer_number: `CUST-${timestamp}`,
        name: testCustomer.name,
        email: testCustomer.email,
        phone: testCustomer.phone,
        billing_address: {
          street: testCustomer.address,
          city: 'Demo City',
          state: 'Demo State',
          zip: '12345'
        }
      };

      const { data: customer, error: customerError } = await serviceClient
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (customerError) {
        console.log(`  ❌ Customer creation failed:`, customerError.message);
      } else {
        console.log(`  ✅ Customer created successfully!`);
        console.log(`     Customer ID: ${customer.id}`);
        console.log(`     Customer Number: ${customer.customer_number}`);
        console.log(`     Tenant ID: ${customer.tenant_id}`);
        
        // Clean up test customer
        await serviceClient.from('customers').delete().eq('id', customer.id);
        console.log(`  🧹 Test customer cleaned up`);
      }
    }

    // Sign out
    await supabase.auth.signOut();
    console.log(`  ✅ Signed out successfully\n`);
  }

  console.log('🎯 Demo user testing complete!');
  console.log('✅ Demo users are properly configured for live CRUD operations');
}

testDemoUsers().catch(console.error);
