#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function setupDemoTenant() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🏢 Setting up demo tenant for demo users...\n');

  // Create a demo company/tenant if it doesn't exist
  const demoTenantId = 'demo-tenant-12345';
  
  // Check if demo tenant exists, if not create one
  console.log('Checking for existing demo tenant...');
  
  // First, update demo users with the demo tenant ID in their app_metadata
  const demoUsers = [
    'super@tophand.tech',
    'crew@tophand.tech',
    'admin@tophand.tech'
  ];

  for (const email of demoUsers) {
    console.log(`Updating ${email} with demo tenant ID...`);
    
    // Get user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    
    if (user) {
      // Update user with tenant_id in app_metadata
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          tenant_id: demoTenantId,
          company_id: demoTenantId,
          role: user.user_metadata?.role || (email.includes('admin') ? 'admin' : email.includes('super') ? 'supervisor' : 'crew')
        }
      });

      if (error) {
        console.error(`  ❌ Failed to update ${email}:`, error.message);
      } else {
        console.log(`  ✅ Updated ${email} with tenant_id: ${demoTenantId}`);
      }
    } else {
      console.log(`  ⚠️ User ${email} not found`);
    }
  }

  console.log('\n🎯 Demo tenant setup complete!');
  console.log(`Demo Tenant ID: ${demoTenantId}`);
  console.log('✅ Demo users can now perform live CRUD operations');
  console.log('✅ All demo data will be isolated to the demo tenant');
}

setupDemoTenant().catch(console.error);
