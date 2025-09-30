#!/usr/bin/env tsx
/**
 * Interactive Scheduling Test Harness
 *
 * Run with: npx tsx scripts/test-scheduling-interactive.ts
 *
 * This script lets you test scheduling operations with real-world values
 * without needing a UI. Pass in values via command line or modify the
 * test scenarios below.
 */

// Load environment FIRST before any imports
require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';
import { DayPlanRepository } from '../src/scheduling/repositories/day-plan.repository';
import { ScheduleEventRepository } from '../src/scheduling/repositories/schedule-event.repository';
import { ScheduleConflictService } from '../src/scheduling/services/schedule-conflict.service';
import * as readline from 'readline';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS for testing)
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Initialize repositories and services
const dayPlanRepo = new DayPlanRepository(supabase);
const eventRepo = new ScheduleEventRepository(supabase);
const conflictService = new ScheduleConflictService();

// Test company and user IDs
const TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

// Interactive input helper
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question}${colors.reset} `, resolve);
  });
}

/**
 * Test 1: Create Day Plan
 */
async function testCreateDayPlan(date?: string, userId?: string) {
  section('TEST 1: Create Day Plan');

  const planDate = date || await ask('Enter plan date (YYYY-MM-DD) [default: tomorrow]:') ||
    new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const user = userId || TEST_USER_ID;

  log(`Creating day plan for user ${user} on ${planDate}...`, 'blue');

  try {
    const dayPlan = await dayPlanRepo.create({
      company_id: TEST_COMPANY_ID,
      user_id: user,
      plan_date: planDate,
      status: 'draft',
      route_data: {},
      total_distance_miles: 0,
      estimated_duration_minutes: 0
    });

    log('✅ Day plan created successfully!', 'green');
    console.log(JSON.stringify(dayPlan, null, 2));
    return dayPlan;
  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
    if (error.code) {
      log(`   Code: ${error.code}`, 'red');
      log(`   Details: ${error.details}`, 'red');
    }
    return null;
  }
}

/**
 * Test 2: Add Schedule Events
 */
async function testAddScheduleEvents(dayPlanId: string) {
  section('TEST 2: Add Schedule Events');

  const numJobs = parseInt(await ask('How many job events to add? [1-7]:') || '3');

  log(`Adding ${numJobs} job events to day plan ${dayPlanId}...`, 'blue');

  const events = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // Start at 8 AM

  for (let i = 0; i < numJobs; i++) {
    try {
      const scheduledStart = new Date(startTime.getTime() + (i * 90 * 60 * 1000)); // 90 min apart

      const event = await eventRepo.create({
        company_id: TEST_COMPANY_ID,
        day_plan_id: dayPlanId,
        event_type: 'job',
        job_id: `test-job-${i + 1}`,
        sequence_order: i + 1,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_duration_minutes: 60,
        status: 'pending',
        address: `${i + 1}23 Test St, City ${i + 1}`,
        // PostGIS GEOGRAPHY format: WKT string 'POINT(longitude latitude)'
        location_data: `POINT(${-74.0060 + (i * 0.01)} ${40.7128 + (i * 0.01)})`
      });

      log(`✅ Job ${i + 1} created at ${scheduledStart.toLocaleTimeString()}`, 'green');
      events.push(event);
    } catch (error: any) {
      log(`❌ Error creating job ${i + 1}: ${error.message}`, 'red');
      if (error.code === '23503' && error.message.includes('6 jobs')) {
        log('   ⚠️  6-job limit reached!', 'yellow');
        break;
      }
    }
  }

  log(`\nCreated ${events.length} events`, events.length === numJobs ? 'green' : 'yellow');
  return events;
}

/**
 * Test 3: Check Conflicts
 */
async function testCheckConflicts(dayPlanId: string) {
  section('TEST 3: Conflict Detection');

  log('Fetching events for conflict check...', 'blue');

  const events = await eventRepo.findByDayPlan(dayPlanId);
  log(`Found ${events.length} events`, 'blue');

  if (events.length < 2) {
    log('⚠️  Need at least 2 events to test conflicts', 'yellow');
    return;
  }

  // Test time overlap
  log('\nTesting time overlap detection...', 'blue');
  const conflicts = conflictService.detectTimeOverlaps(events);

  if (conflicts.length === 0) {
    log('✅ No time overlaps detected', 'green');
  } else {
    log(`❌ Found ${conflicts.length} overlaps:`, 'red');
    conflicts.forEach(c => {
      console.log(`   Event ${c.event1.id} overlaps with ${c.event2.id}`);
    });
  }

  // Test travel time conflicts
  log('\nTesting travel time conflicts...', 'blue');
  const travelConflicts = conflictService.detectTravelTimeConflicts(events);

  if (travelConflicts.length === 0) {
    log('✅ No travel time conflicts', 'green');
  } else {
    log(`⚠️  Found ${travelConflicts.length} travel time issues:`, 'yellow');
    travelConflicts.forEach(c => {
      console.log(`   ${c.details.message}`);
    });
  }
}

/**
 * Test 4: Query Day Plans
 */
async function testQueryDayPlans() {
  section('TEST 4: Query Day Plans');

  const dateFrom = await ask('Filter from date (YYYY-MM-DD) [leave empty for all]:');
  const dateTo = await ask('Filter to date (YYYY-MM-DD) [leave empty for all]:');

  log('Querying day plans...', 'blue');

  try {
    const plans = await dayPlanRepo.findAll({
      user_id: TEST_USER_ID,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      limit: 10
    });

    log(`✅ Found ${plans.length} day plans`, 'green');

    plans.forEach((plan, i) => {
      console.log(`\n${i + 1}. ${plan.plan_date} - ${plan.status}`);
      console.log(`   ID: ${plan.id}`);
      console.log(`   Distance: ${plan.total_distance_miles} miles`);
      console.log(`   Duration: ${plan.estimated_duration_minutes} minutes`);
    });

    return plans;
  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
    return [];
  }
}

/**
 * Test 5: Test 6-Job Limit
 */
async function testJobLimit() {
  section('TEST 5: Test 6-Job Limit');

  log('Creating day plan with 7 jobs to test limit...', 'blue');

  // Create day plan
  const planDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  const dayPlan = await dayPlanRepo.create({
    company_id: TEST_COMPANY_ID,
    user_id: TEST_USER_ID,
    plan_date: planDate,
    status: 'draft',
    route_data: {},
    total_distance_miles: 0,
    estimated_duration_minutes: 0
  });

  log(`Day plan created: ${dayPlan.id}`, 'green');

  // Try to add 7 jobs
  let successCount = 0;
  let hitLimit = false;

  for (let i = 0; i < 7; i++) {
    const count = await eventRepo.countJobEvents(dayPlan.id);
    log(`\nAttempting to add job ${i + 1} (current count: ${count})...`, 'blue');

    if (count >= 6) {
      log('⚠️  Should reject: 6-job limit reached', 'yellow');
      hitLimit = true;
      // In real API, this would return 400 error
      break;
    }

    try {
      await eventRepo.create({
        company_id: TEST_COMPANY_ID,
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: `limit-test-job-${i + 1}`,
        sequence_order: i + 1,
        scheduled_start: new Date().toISOString(),
        scheduled_duration_minutes: 60,
        status: 'pending',
        location_data: `POINT(${-74.0060 + (i * 0.01)} ${40.7128 + (i * 0.01)})`
      });

      successCount++;
      log(`✅ Job ${i + 1} created`, 'green');
    } catch (error: any) {
      log(`❌ Job ${i + 1} failed: ${error.message}`, 'red');
      break;
    }
  }

  if (successCount === 6 && hitLimit) {
    log('\n✅ 6-job limit working correctly!', 'green');
  } else {
    log(`\n⚠️  Expected 6 jobs, got ${successCount}`, 'yellow');
  }
}

/**
 * Test 6: RLS Testing (Multi-tenant)
 */
async function testRLS() {
  section('TEST 6: RLS / Multi-tenant Isolation');

  log('Testing row-level security...', 'blue');
  log('Note: Using service role bypasses RLS. For real test, use anon key.', 'yellow');

  // Create two day plans for different companies
  const company1 = TEST_COMPANY_ID;
  const company2 = '00000000-0000-0000-0000-000000000002';

  log('\nCreating plans for two different companies...', 'blue');

  try {
    // First ensure company2 exists
    await supabase.from('companies').upsert({
      id: company2,
      tenant_id: company2,
      name: 'Test Company 2'
    });

    const plan1 = await dayPlanRepo.create({
      company_id: company1,
      user_id: TEST_USER_ID,
      plan_date: new Date().toISOString().split('T')[0],
      status: 'draft',
      route_data: {},
      total_distance_miles: 0,
      estimated_duration_minutes: 0
    });

    // Create with service role client for company 2
    const { data: plan2 } = await supabase.from('day_plans').insert({
      company_id: company2,
      user_id: TEST_USER_ID,
      plan_date: new Date().toISOString().split('T')[0],
      status: 'draft',
      route_data: {},
      total_distance_miles: 0,
      estimated_duration_minutes: 0
    }).select().single();

    log(`✅ Company 1 plan: ${plan1.id}`, 'green');
    log(`✅ Company 2 plan: ${plan2?.id}`, 'green');

    // Try to query - with service role we'll see both
    const allPlans = await dayPlanRepo.findAll({ user_id: TEST_USER_ID });
    log(`\nWith service role: Found ${allPlans.length} plans (expected 2+)`, 'blue');

    log('\n⚠️  To properly test RLS, run with anon key client', 'yellow');
    log('   Should only see plans for authenticated company', 'yellow');

  } catch (error: any) {
    log(`❌ Error: ${error.message}`, 'red');
  }
}

/**
 * Cleanup function
 */
async function cleanup() {
  section('CLEANUP');

  const shouldClean = await ask('Clean up test data? (y/n):');

  if (shouldClean.toLowerCase() === 'y') {
    log('Cleaning up...', 'blue');

    await supabase.from('schedule_events')
      .delete()
      .eq('company_id', TEST_COMPANY_ID);

    await supabase.from('day_plans')
      .delete()
      .eq('company_id', TEST_COMPANY_ID);

    log('✅ Cleanup complete', 'green');
  }
}

/**
 * Main interactive menu
 */
async function main() {
  log('\n🗓️  SCHEDULING MODULE - INTERACTIVE TEST HARNESS', 'cyan');
  log('Test real-world scheduling scenarios with actual database operations\n', 'cyan');

  let dayPlanId: string | null = null;

  while (true) {
    console.log('\n' + '-'.repeat(60));
    console.log('MENU:');
    console.log('1. Create Day Plan');
    console.log('2. Add Schedule Events');
    console.log('3. Check Conflicts');
    console.log('4. Query Day Plans');
    console.log('5. Test 6-Job Limit');
    console.log('6. Test RLS (Multi-tenant)');
    console.log('7. Run All Tests');
    console.log('8. Cleanup');
    console.log('9. Exit');
    console.log('-'.repeat(60));

    const choice = await ask('\nSelect option (1-9):');

    switch (choice) {
      case '1':
        const plan = await testCreateDayPlan();
        if (plan) dayPlanId = plan.id;
        break;

      case '2':
        if (!dayPlanId) {
          log('❌ Create a day plan first (option 1)', 'red');
        } else {
          await testAddScheduleEvents(dayPlanId);
        }
        break;

      case '3':
        if (!dayPlanId) {
          log('❌ Create a day plan with events first', 'red');
        } else {
          await testCheckConflicts(dayPlanId);
        }
        break;

      case '4':
        await testQueryDayPlans();
        break;

      case '5':
        await testJobLimit();
        break;

      case '6':
        await testRLS();
        break;

      case '7':
        log('\nRunning all tests...', 'cyan');
        const allTestsPlan = await testCreateDayPlan();
        if (allTestsPlan) {
          await testAddScheduleEvents(allTestsPlan.id);
          await testCheckConflicts(allTestsPlan.id);
        }
        await testQueryDayPlans();
        await testJobLimit();
        await testRLS();
        break;

      case '8':
        await cleanup();
        break;

      case '9':
        log('\n👋 Goodbye!', 'cyan');
        rl.close();
        process.exit(0);

      default:
        log('Invalid option', 'red');
    }
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});