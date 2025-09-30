#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createTestFixtures() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔧 Creating test fixtures...\n');

  // Get test user IDs
  const { data: users } = await supabase.auth.admin.listUsers();
  const techUser = users?.users.find(u => u.email === 'tech-e2e@example.com');
  const managerUser = users?.users.find(u => u.email === 'manager-e2e@example.com');

  if (!techUser || !managerUser) {
    console.error('❌ Test users not found. Run setup-e2e-tests.ts first.');
    process.exit(1);
  }

  console.log(`✅ Found test users: ${techUser.id}, ${managerUser.id}`);

  // 1. Create test customer
  console.log('\n1. Creating test customer...');
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001',
      tenant_id: 'company-e2e-test',
      company_id: 'company-e2e-test',
      name: 'Test Customer',
      email: 'customer@test.com',
      phone: '555-0100',
      billing_address: '100 Test St, Atlanta, GA 30301',
      service_address: '100 Test St, Atlanta, GA 30301',
      is_active: true
    }, { onConflict: 'id' })
    .select()
    .single();

  if (custError && custError.code !== '23505') {
    console.error('❌ Customer error:', custError);
  } else {
    console.log('✅ Test customer created');
  }

  // 2. Create test property
  console.log('\n2. Creating test property...');
  const { data: property, error: propError } = await supabase
    .from('properties')
    .upsert({
      id: '00000000-0000-0000-0000-000000000002',
      tenant_id: 'company-e2e-test',
      customer_id: customer?.id || '00000000-0000-0000-0000-000000000001',
      name: 'Test Property',
      address: '100 Test St, Atlanta, GA 30301',
      property_type: 'residential',
      is_active: true
    }, { onConflict: 'id' })
    .select()
    .single();

  if (propError && propError.code !== '23505') {
    console.error('❌ Property error:', propError);
  } else {
    console.log('✅ Test property created');
  }

  // 3. Create sample jobs for technician
  console.log('\n3. Creating sample jobs...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const jobs = [
    {
      id: '00000000-0000-0000-0000-000000000010',
      job_number: 'JOB-E2E-001',
      title: 'Morning Lawn Maintenance',
      description: 'Regular lawn care service',
      customer_id: customer?.id || '00000000-0000-0000-0000-000000000001',
      property_id: property?.id || '00000000-0000-0000-0000-000000000002',
      status: 'scheduled',
      assigned_to: techUser.id,
      scheduled_start: tomorrow.toISOString(),
      estimated_duration: 90
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      job_number: 'JOB-E2E-002',
      title: 'Afternoon Trimming',
      description: 'Tree and shrub trimming',
      customer_id: customer?.id || '00000000-0000-0000-0000-000000000001',
      property_id: property?.id || '00000000-0000-0000-0000-000000000002',
      status: 'in_progress',
      assigned_to: techUser.id,
      scheduled_start: new Date().toISOString(),
      actual_start: new Date().toISOString(),
      estimated_duration: 60
    }
  ];

  for (const job of jobs) {
    const { error } = await supabase
      .from('jobs')
      .upsert(job, { onConflict: 'id' });

    if (error && error.code !== '23505') {
      console.error(`❌ Job ${job.job_number} error:`, error.message);
    } else {
      console.log(`✅ Job ${job.job_number} created`);
    }
  }

  console.log('\n✅ All test fixtures created successfully!');
  console.log('\n📋 Test Data Summary:');
  console.log(`   Customer: ${customer?.name} (${customer?.id})`);
  console.log(`   Property: ${property?.name} (${property?.id})`);
  console.log(`   Jobs: ${jobs.length} created for technician`);
  console.log('\n🚀 Ready to run E2E tests!');
}

createTestFixtures().catch((error) => {
  console.error('❌ Failed to create fixtures:', error);
  process.exit(1);
});
