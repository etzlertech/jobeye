#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

// Load from environment
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RAILWAY_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const RAILWAY_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Railway's demo tenant ID
const RAILWAY_DEMO_TENANT_ID = '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e';

interface DemoUser {
  email: string;
  password: string;
  role: 'supervisor' | 'crew' | 'admin';
  name: string;
}

async function createDemoUsersInRailway() {
  const client = createClient(RAILWAY_SUPABASE_URL, RAILWAY_SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const demoUsers = [
    {
      email: 'super@tophand.tech',
      password: 'demo123',
      role: 'supervisor',
      name: 'Supervisor Demo'
    },
    {
      email: 'crew@tophand.tech',
      password: 'demo123',
      role: 'crew',
      name: 'Crew Demo'
    },
    {
      email: 'admin@tophand.tech',
      password: 'demo123',
      role: 'admin',
      name: 'Admin Demo'
    }
  ] satisfies DemoUser[];

  console.log('🚂 Creating demo users in Railway\'s Supabase...\n');

  // First, check if the tenant exists
  console.log('🔍 Checking if demo tenant exists...');
  const { data: tenant, error: tenantError } = await client
    .from('tenants')
    .select('*')
    .eq('tenant_id', RAILWAY_DEMO_TENANT_ID)
    .single();

  if (tenantError || !tenant) {
    console.log('📝 Creating demo tenant...');
    const { error: createError } = await client
      .from('tenants')
      .insert({
        tenant_id: RAILWAY_DEMO_TENANT_ID,
        tenant_name: 'Demo Company',
        config: {
          max_users: 50,
          max_jobs_per_day: 6,
          features: ['vision_verification', 'voice_commands']
        },
        is_active: true,
        created_by: 'system'
      });

    if (createError) {
      console.error('❌ Failed to create tenant:', createError);
      return;
    }
    console.log('✅ Demo tenant created');
  } else {
    console.log('✅ Demo tenant already exists');
  }

  // Create demo users
  for (const demoUser of demoUsers) {
    console.log(`\n👤 Processing ${demoUser.name} (${demoUser.email})...`);

    // Check if user already exists
    const { data: existingUser } = await client.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === demoUser.email);

    if (userExists) {
      console.log(`✅ User already exists: ${demoUser.email}`);
      
      // Update the existing user's metadata
      const existingUserId = existingUser?.users?.find(u => u.email === demoUser.email)?.id;
      if (existingUserId) {
        const { error: updateError } = await client.auth.admin.updateUserById(
          existingUserId,
          {
            app_metadata: {
              role: demoUser.role,
              company_id: RAILWAY_DEMO_TENANT_ID,
              tenant_id: RAILWAY_DEMO_TENANT_ID
            },
            user_metadata: {
              name: demoUser.name,
              role: demoUser.role
            }
          }
        );

        if (updateError) {
          console.error(`❌ Failed to update user metadata:`, updateError);
        } else {
          console.log(`✅ Updated user metadata for ${demoUser.email}`);
        }
      }
      continue;
    }

    // Create new user
    const { data: newUser, error: createUserError } = await client.auth.admin.createUser({
      email: demoUser.email,
      password: demoUser.password,
      email_confirm: true,
      app_metadata: {
        role: demoUser.role,
        company_id: RAILWAY_DEMO_TENANT_ID,
        tenant_id: RAILWAY_DEMO_TENANT_ID
      },
      user_metadata: {
        name: demoUser.name,
        role: demoUser.role
      }
    });

    if (createUserError) {
      console.error(`❌ Failed to create user:`, createUserError);
      continue;
    }

    console.log(`✅ Created user: ${demoUser.email}`);

    // Create tenant assignment
    if (newUser?.id) {
      const { error: assignError } = await client
        .from('tenant_assignments')
        .insert({
          user_id: newUser.id,
          tenant_id: RAILWAY_DEMO_TENANT_ID,
          role: demoUser.role,
          is_primary: true,
          is_active: true,
          created_by: 'system'
        });

      if (assignError) {
        console.error(`❌ Failed to create tenant assignment:`, assignError);
      } else {
        console.log(`✅ Created tenant assignment for ${demoUser.email}`);
      }
    }
  }

  console.log('\n🎉 Demo users setup complete!\n');
  console.log('📝 Demo Credentials:');
  console.log('   Supervisor: super@tophand.tech / demo123');
  console.log('   Crew: crew@tophand.tech / demo123');
  console.log('   Admin: admin@tophand.tech / demo123');
  console.log('\n🌐 Railway URL: https://jobeye-production.up.railway.app');
  console.log('🔐 Sign in at: https://jobeye-production.up.railway.app/sign-in');
}

createDemoUsersInRailway().catch(console.error);
