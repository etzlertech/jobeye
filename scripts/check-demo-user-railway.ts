#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkDemoUser() {
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔍 Checking demo supervisor user in Railway Supabase...\n');

  // Check if demo supervisor exists in auth
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Failed to list users:', listError);
    return;
  }

  const demoSupervisor = users?.find(u => u.email === 'demo.supervisor@jobeye.app');
  
  if (!demoSupervisor) {
    console.log('❌ Demo supervisor user not found in Railway Supabase!');
    console.log('\n📝 Creating demo users...');
    
    // Create demo supervisor
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: 'demo.supervisor@jobeye.app',
      password: 'demo123',
      email_confirm: true,
      app_metadata: {
        role: 'supervisor',
        company_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
        tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'
      },
      user_metadata: {
        name: 'Mrs Supervisor',
        role: 'supervisor'
      }
    });

    if (createError) {
      console.error('❌ Failed to create demo user:', createError);
    } else {
      console.log('✅ Created demo supervisor user');
      console.log('   ID:', newUser.user?.id);
    }
  } else {
    console.log('✅ Demo supervisor exists');
    console.log('   ID:', demoSupervisor.id);
    console.log('   Email:', demoSupervisor.email);
    console.log('   App Metadata:', demoSupervisor.app_metadata);
    console.log('   User Metadata:', demoSupervisor.user_metadata);
  }

  // Check tenant assignment
  if (demoSupervisor) {
    const { data: assignment, error: assignError } = await supabase
      .from('tenant_assignments')
      .select('*')
      .eq('user_id', demoSupervisor.id)
      .single();

    if (assignError) {
      console.log('\n⚠️  No tenant assignment found');
      
      // Create tenant assignment
      const { error: createAssignError } = await supabase
        .from('tenant_assignments')
        .insert({
          user_id: demoSupervisor.id,
          tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
          role: 'supervisor',
          is_primary: true,
          is_active: true
        });

      if (createAssignError) {
        console.error('❌ Failed to create tenant assignment:', createAssignError);
      } else {
        console.log('✅ Created tenant assignment');
      }
    } else {
      console.log('\n✅ Tenant assignment exists:', assignment);
    }
  }
}

checkDemoUser().catch(console.error);