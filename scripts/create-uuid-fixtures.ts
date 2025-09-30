#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_TENANT_UUID = '00000000-0000-0000-0000-000000000099';

async function createUUIDFixtures() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔧 Creating test fixtures with UUID tenant...\n');

  // Get test user IDs
  const { data: users } = await supabase.auth.admin.listUsers();
  const techUser = users?.users.find(u => u.email === 'tech-e2e@example.com');
  const managerUser = users?.users.find(u => u.email === 'manager-e2e@example.com');

  if (!techUser || !managerUser) {
    console.error('❌ Test users not found. Run setup-e2e-tests.ts first.');
    process.exit(1);
  }

  console.log(`✅ Found users: tech=${techUser.id}, manager=${managerUser.id}\n`);

  // 1. Create test customer with UUID tenant
  console.log('1. Creating test customer...');
  const customerId = '00000000-0000-0000-0000-000000000001';
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .upsert({
      id: customerId,
      tenant_id: TEST_TENANT_UUID,
      company_id: 'company-e2e-test',
      customer_number: 'CUST-E2E-001',
      name: 'E2E Test Customer',
      email: 'customer@e2etest.com',
      phone: '555-0100',
      billing_address: '100 Test Lane, Atlanta, GA 30301',
      service_address: '100 Test Lane, Atlanta, GA 30301',
      is_active: true
    }, { onConflict: 'id' })
    .select()
    .single();

  if (custError && custError.code !== '23505') {
    console.error('❌ Customer error:', custError.message);
  } else {
    console.log(`✅ Customer created: ${customer?.id || customerId}`);
  }

  // 2. Create test property
  console.log('\n2. Creating test property...');
  const propertyId = '00000000-0000-0000-0000-000000000002';
  const { data: property, error: propError } = await supabase
    .from('properties')
    .upsert({
      id: propertyId,
      tenant_id: TEST_TENANT_UUID,
      customer_id: customerId,
      property_number: 'PROP-E2E-001',
      name: 'E2E Test Property',
      address: '100 Test Lane, Atlanta, GA 30301',
      property_type: 'residential',
      is_active: true
    }, { onConflict: 'id' })
    .select()
    .single();

  if (propError && propError.code !== '23505') {
    console.error('❌ Property error:', propError.message);
  } else {
    console.log(`✅ Property created: ${property?.id || propertyId}`);
  }

  // 3. Create sample jobs
  console.log('\n3. Creating sample jobs...');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const today = new Date();
  today.setHours(10, 0, 0, 0);

  // Schedule jobs at different times to avoid double-booking constraint
  const tomorrowMorning = new Date(tomorrow);
  tomorrowMorning.setHours(9, 0, 0, 0);

  const tomorrowAfternoon = new Date(tomorrow);
  tomorrowAfternoon.setHours(14, 0, 0, 0);

  const jobs = [
    {
      id: '00000000-0000-0000-0000-000000000010',
      tenant_id: TEST_TENANT_UUID,
      job_number: 'JOB-E2E-001',
      title: 'Morning Lawn Maintenance',
      description: 'Regular lawn care - scheduled for tomorrow morning',
      customer_id: customerId,
      property_id: propertyId,
      status: 'scheduled',
      assigned_to: techUser.id,
      scheduled_start: tomorrowMorning.toISOString(),
      estimated_duration: 90
    },
    {
      id: '00000000-0000-0000-0000-000000000011',
      tenant_id: TEST_TENANT_UUID,
      job_number: 'JOB-E2E-002',
      title: 'Active Job - In Progress',
      description: 'Currently being worked on',
      customer_id: customerId,
      property_id: propertyId,
      status: 'in_progress',
      assigned_to: techUser.id,
      scheduled_start: today.toISOString(),
      actual_start: today.toISOString(),
      estimated_duration: 60
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      tenant_id: TEST_TENANT_UUID,
      job_number: 'JOB-E2E-003',
      title: 'Afternoon Scheduled Job',
      description: 'Additional scheduled job for routing - afternoon',
      customer_id: customerId,
      property_id: propertyId,
      status: 'scheduled',
      assigned_to: techUser.id,
      scheduled_start: tomorrowAfternoon.toISOString(),
      estimated_duration: 45
    }
  ];

  let successCount = 0;
  for (const job of jobs) {
    const { error } = await supabase
      .from('jobs')
      .upsert(job, { onConflict: 'id' });

    if (error && error.code !== '23505') {
      console.error(`❌ Job ${job.job_number}:`, error.message);
    } else {
      console.log(`✅ Job ${job.job_number} created`);
      successCount++;
    }
  }

  console.log('\n✅ Fixtures created successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Tenant UUID: ${TEST_TENANT_UUID}`);
  console.log(`   Customer: ${customerId}`);
  console.log(`   Property: ${propertyId}`);
  console.log(`   Jobs: ${successCount}/${jobs.length} created`);
  console.log(`   Assigned to: ${techUser.id} (tech-e2e@example.com)`);
  console.log('\n🚀 Ready to run E2E tests!');
}

createUUIDFixtures().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
