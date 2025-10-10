#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function useExistingTenant() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Finding existing tenant ID from customers table...\n');

  // Get an existing customer to see what tenant_id format is used
  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('tenant_id')
    .limit(5);

  if (existingCustomers && existingCustomers.length > 0) {
    const existingTenantId = existingCustomers[0].tenant_id;
    console.log(`✅ Found existing tenant ID: ${existingTenantId}`);
    
    // Update demo users to use the existing tenant ID
    const demoUsers = [
      { email: 'super@tophand.tech', role: 'supervisor' },
      { email: 'crew@tophand.tech', role: 'crew' },
      { email: 'admin@tophand.tech', role: 'admin' }
    ];

    for (const { email, role } of demoUsers) {
      console.log(`Updating ${email} with existing tenant ID...`);
      
      // Get user by email
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users.users.find(u => u.email === email);
      
      if (user) {
        // Update user with existing tenant_id
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            tenant_id: existingTenantId,
            company_id: existingTenantId,
            role: user.user_metadata?.role || role
          }
        });

        if (error) {
          console.error(`  ❌ Failed to update ${email}:`, error.message);
        } else {
          console.log(`  ✅ Updated ${email} with tenant_id: ${existingTenantId}`);
        }
      }
    }

    // Test customer creation with existing tenant ID
    console.log('\n🧪 Testing customer creation with existing tenant ID...');
    
    const testCustomer = {
      tenant_id: existingTenantId,
      customer_number: `CUST-${Date.now()}`,
      name: 'Demo Live CRUD Test Customer',
      email: 'demo.live.crud@example.com',
      phone: '(555) 999-LIVE',
      billing_address: {
        street: '456 Live CRUD Test Ave',
        city: 'Demo City',
        state: 'Demo State',
        zip: '12345'
      }
    };

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(testCustomer)
      .select()
      .single();

    if (customerError) {
      console.error(`❌ Customer creation failed:`, customerError.message);
    } else {
      console.log(`✅ Customer created successfully!`);
      console.log(`   Customer ID: ${customer.id}`);
      console.log(`   Customer Number: ${customer.customer_number}`);
      console.log(`   Tenant ID: ${customer.tenant_id}`);
      console.log(`   Name: ${customer.name}`);
      
      // Keep this customer as a demo record (don't clean up)
      console.log(`📌 Demo customer saved for testing`);
    }

    console.log('\n🎯 Demo users updated with existing tenant!');
    console.log(`Demo Tenant ID: ${existingTenantId}`);
    console.log('✅ Demo users can now perform live CRUD operations!');
    
  } else {
    console.log('❌ No existing customers found to get tenant ID from');
  }
}

useExistingTenant().catch(console.error);
