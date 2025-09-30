#!/usr/bin/env npx tsx
/**
 * Minimal E2E Test Data Seeder
 * Works around schema cache and constraint issues by only seeding essential data
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000099';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function seedMinimalData() {
  console.log('🌱 Minimal E2E Test Data Seeder\n');

  // Just seed 3 jobs - that's what the E2E tests need most
  const today = new Date();

  // Note: Using minimal required fields only
  // customer_id is required, so we need to create a customer first or use existing one
  const jobs = [
    {
      id: '00000000-0000-0000-0000-000000000030',
      tenant_id: TEST_TENANT_ID,
      job_number: 'E2E-JOB-001',
      title: 'E2E Test Job #1',
      customer_id: TEST_USER_ID, // Using user ID as placeholder (might fail if constraint exists)
      status: 'scheduled',
      scheduled_start: today.toISOString(),
      scheduled_end: new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      description: 'E2E Test Job for automated testing',
      assigned_to: TEST_USER_ID
    },
    {
      id: '00000000-0000-0000-0000-000000000031',
      tenant_id: TEST_TENANT_ID,
      job_number: 'E2E-JOB-002',
      title: 'E2E Test Job #2',
      customer_id: TEST_USER_ID,
      status: 'scheduled',
      scheduled_start: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      scheduled_end: new Date(today.getTime() + 28 * 60 * 60 * 1000).toISOString(),
      description: 'E2E Test Job for automated testing',
      assigned_to: TEST_USER_ID
    },
    {
      id: '00000000-0000-0000-0000-000000000032',
      tenant_id: TEST_TENANT_ID,
      job_number: 'E2E-JOB-003',
      title: 'E2E Test Job #3',
      customer_id: TEST_USER_ID,
      status: 'in_progress',
      scheduled_start: new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      scheduled_end: new Date(today.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      description: 'E2E Test Job for automated testing',
      assigned_to: TEST_USER_ID
    }
  ];

  console.log('💼 Seeding Jobs...\n');

  let created = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      const { error } = await client
        .from('jobs')
        .upsert(job, { onConflict: 'id' });

      if (error) {
        if (error.message.includes('duplicate key')) {
          skipped++;
          console.log(`⏭️  ${job.job_number}: Already exists`);
        } else {
          console.log(`❌ ${job.job_number}: ${error.message}`);
        }
      } else {
        created++;
        console.log(`✅ ${job.job_number}: Created`);
      }
    } catch (e: any) {
      console.log(`❌ ${job.job_number}: ${e.message}`);
    }
  }

  console.log(`\n📊 SUMMARY\n`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${created + skipped}/${jobs.length}\n`);

  if (created + skipped === jobs.length) {
    console.log('✅ All jobs available for E2E tests!\n');
    console.log('Run tests with:');
    console.log('  npm run test -- --testPathPattern="e2e.test.ts"\n');
  } else {
    console.log('⚠️  Some jobs failed to create\n');
    process.exit(1);
  }
}

seedMinimalData().catch(console.error);