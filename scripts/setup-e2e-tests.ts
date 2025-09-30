#!/usr/bin/env npx tsx
/**
 * @file setup-e2e-tests.ts
 * @purpose Setup test environment for E2E workflow tests
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupE2ETests() {
  console.log('🔧 Setting up E2E test environment...\n');

  // 1. Create test company
  console.log('1. Creating test company...');
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .upsert({
      id: 'company-e2e-test',
      name: 'E2E Test Company',
      status: 'active'
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (companyError && companyError.code !== '23505') {
    console.error('❌ Failed to create company:', companyError);
  } else {
    console.log('✅ Test company ready:', company?.id || 'company-e2e-test');
  }

  // 2. Create test users
  console.log('\n2. Creating test users...');
  const testUsers = [
    {
      email: 'tech-e2e@example.com',
      password: 'Test123!@#',
      role: 'TECHNICIAN',
      fullName: 'Test Technician'
    },
    {
      email: 'manager-e2e@example.com',
      password: 'Test123!@#',
      role: 'MANAGER',
      fullName: 'Test Manager'
    },
    {
      email: 'admin-e2e@example.com',
      password: 'Test123!@#',
      role: 'ADMIN',
      fullName: 'Test Admin'
    }
  ];

  for (const user of testUsers) {
    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  User ${user.email} already exists - skipping`);

        // Get existing user ID
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const existing = existingUser?.users.find(u => u.email === user.email);

        if (existing) {
          // Update user assignment
          await supabase
            .from('user_assignments')
            .upsert({
              user_id: existing.id,
              tenant_id: 'company-e2e-test',
              role: user.role,
              is_active: true
            }, {
              onConflict: 'user_id,tenant_id'
            });
        }
        continue;
      }

      console.error(`❌ Failed to create ${user.email}:`, authError.message);
      continue;
    }

    console.log(`✅ Created auth user: ${user.email}`);

    // Create user_assignments record
    const { error: assignmentError } = await supabase
      .from('user_assignments')
      .upsert({
        user_id: authUser.user!.id,
        tenant_id: 'company-e2e-test',
        role: user.role,
        is_active: true
      }, {
        onConflict: 'user_id,tenant_id'
      });

    if (assignmentError) {
      console.error(`❌ Failed to create assignment for ${user.email}:`, assignmentError.message);
    } else {
      console.log(`✅ Created assignment: ${user.role}`);
    }
  }

  // 3. Create missing tables (if they don't exist)
  console.log('\n3. Checking required tables...');

  const tablesToCheck = [
    'equipment_incidents',
    'notifications',
    'daily_reports',
    'quality_audits',
    'training_sessions',
    'training_certificates',
    'equipment_maintenance',
    'maintenance_schedule',
    'user_activity_logs'
  ];

  for (const table of tablesToCheck) {
    const { error } = await supabase.from(table).select('id').limit(1);

    if (error) {
      console.log(`⚠️  Table '${table}' does not exist or is not accessible`);
    } else {
      console.log(`✅ Table '${table}' exists`);
    }
  }

  console.log('\n4. Test environment summary:');
  console.log('   Company ID: company-e2e-test');
  console.log('   Test Users:');
  console.log('     - tech-e2e@example.com (password: Test123!@#)');
  console.log('     - manager-e2e@example.com (password: Test123!@#)');
  console.log('     - admin-e2e@example.com (password: Test123!@#)');

  console.log('\n✅ E2E test environment setup complete!\n');
  console.log('You can now run:');
  console.log('  npm test src/__tests__/e2e/complete-workflows.e2e.test.ts\n');
}

setupE2ETests().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});