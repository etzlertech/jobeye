#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRoleEnum() {
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔍 Checking valid role enum values...\n');

  // Query to get enum values
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = 'user_role'::regtype
      ORDER BY enumsortorder;
    `
  });

  if (error) {
    console.log('❌ Failed to query enum:', error);
    
    // Try alternative approach - check existing tenant_assignments
    console.log('\n📊 Checking existing tenant assignments for role examples...');
    const { data: assignments, error: assignError } = await supabase
      .from('tenant_assignments')
      .select('role')
      .limit(5);

    if (!assignError && assignments) {
      console.log('Existing roles:', [...new Set(assignments.map(a => a.role))]);
    }
  } else {
    console.log('Valid user_role enum values:', data);
  }

  // Also check the tenants table
  console.log('\n📊 Checking demo tenant...');
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e')
    .single();

  if (tenantError) {
    console.log('❌ Demo tenant not found:', tenantError.message);
    
    // Create demo tenant
    console.log('\n📝 Creating demo tenant...');
    const { error: createError } = await supabase
      .from('tenants')
      .insert({
        id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
        name: 'Demo Company',
        config: {
          max_users: 50,
          max_jobs_per_day: 6,
          features: ['vision_verification', 'voice_commands']
        },
        is_active: true
      });

    if (createError) {
      console.log('❌ Failed to create tenant:', createError);
    } else {
      console.log('✅ Created demo tenant');
    }
  } else {
    console.log('✅ Demo tenant exists:', tenant.name);
  }
}

checkRoleEnum().catch(console.error);