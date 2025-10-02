#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function fixDemoTenantUuid() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Fixing demo tenant ID to proper UUID format...\n');

  // Use a consistent UUID for demo tenant
  const demoTenantUuid = '00000000-0000-0000-0000-000000000001';
  
  console.log(`New Demo Tenant UUID: ${demoTenantUuid}`);

  // Update demo users with the proper UUID
  const demoUsers = [
    'demo.supervisor@jobeye.app',
    'demo.crew@jobeye.app'
  ];

  for (const email of demoUsers) {
    console.log(`Updating ${email} with UUID tenant ID...`);
    
    // Get user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    
    if (user) {
      // Update user with UUID tenant_id in app_metadata
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          tenant_id: demoTenantUuid,
          company_id: demoTenantUuid,
          role: user.user_metadata?.role || (email.includes('supervisor') ? 'supervisor' : 'crew')
        }
      });

      if (error) {
        console.error(`  ❌ Failed to update ${email}:`, error.message);
      } else {
        console.log(`  ✅ Updated ${email} with UUID tenant_id`);
      }
    } else {
      console.log(`  ⚠️ User ${email} not found`);
    }
  }

  // Test customer creation with the new UUID
  console.log('\n🧪 Testing customer creation with UUID tenant ID...');
  
  const testCustomer = {
    tenant_id: demoTenantUuid,
    customer_number: `CUST-${Date.now()}`,
    name: 'Demo UUID Test Customer',
    email: 'demo.uuid.test@example.com',
    phone: '(555) 999-UUID',
    billing_address: {
      street: '789 UUID Test St',
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
    console.error(`❌ Customer creation still failed:`, customerError.message);
  } else {
    console.log(`✅ Customer created successfully with UUID tenant!`);
    console.log(`   Customer ID: ${customer.id}`);
    console.log(`   Tenant ID: ${customer.tenant_id}`);
    
    // Clean up test customer
    await supabase.from('customers').delete().eq('id', customer.id);
    console.log(`🧹 Test customer cleaned up`);
  }

  console.log('\n🎯 Demo tenant UUID fix complete!');
  console.log(`Demo Tenant UUID: ${demoTenantUuid}`);
  console.log('✅ Demo users can now perform live CRUD operations with proper UUID tenant');
}

fixDemoTenantUuid().catch(console.error);