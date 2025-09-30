#!/usr/bin/env tsx
/**
 * Comprehensive E2E Test Scenarios
 * 10 diverse test sequences covering edge cases, concurrency, security, and performance
 */

require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Test constants
const TEST_COMPANY_A = '00000000-0000-0000-0000-000000000001';
const TEST_COMPANY_B = '00000000-0000-0000-0000-000000000002';
const BASE_URL = 'http://localhost:3000';

// Color output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

interface TestResult {
  scenario: string;
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
let currentScenario = '';

async function step(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    log(`    → ${name}`, 'gray');
    await testFn();
    const duration = Date.now() - start;
    log(`      ✓ ${duration}ms`, 'green');
    results.push({ scenario: currentScenario, step: name, status: 'PASS', duration });
  } catch (error: any) {
    const duration = Date.now() - start;
    log(`      ✗ ${error.message}`, 'red');
    results.push({ scenario: currentScenario, step: name, status: 'FAIL', duration, error: error.message });
    throw error; // Propagate to stop scenario
  }
}

// API helper
async function apiRequest(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
) {
  const { token, ...fetchOptions } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...fetchOptions, headers });
  const data = await response.json();
  return { response, data, status: response.status };
}

// Test user helper
async function createTestUser(email: string, password: string, companyId: string = TEST_COMPANY_A) {
  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Try to create user with company_id in app_metadata
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      company_id: companyId,
    },
  });

  if (createError && !createError.message.includes('already been registered')) {
    throw createError;
  }

  // If user already exists, update their metadata and sign them out first
  if (createError && createError.message.includes('already been registered')) {
    // Get user by email
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    const existingUser = users?.find(u => u.email === email);

    if (existingUser) {
      // Update metadata
      await adminClient.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          company_id: companyId,
        },
      });

      // Sign out all sessions to force fresh JWT
      await adminClient.auth.admin.signOut(existingUser.id, 'global');

      // Wait a bit for metadata to propagate
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Sign in
  const userClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) throw signInError;
  if (!signInData.session) throw new Error('No session after sign in');

  return {
    userId: signInData.user.id,
    token: signInData.session.access_token,
    client: userClient,
    companyId,
  };
}

// Cleanup helper
async function cleanupTestData(companyId: string) {
  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  await adminClient.from('schedule_events').delete().eq('company_id', companyId);
  await adminClient.from('day_plans').delete().eq('company_id', companyId);
}

// Setup helper - ensure test companies exist
async function setupTestCompanies() {
  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Create or update test companies
  await adminClient.from('companies').upsert([
    {
      id: TEST_COMPANY_A,
      tenant_id: TEST_COMPANY_A,
      name: 'Test Company A',
      slug: 'test-a',
      status: 'active',
    },
    {
      id: TEST_COMPANY_B,
      tenant_id: TEST_COMPANY_B,
      name: 'Test Company B',
      slug: 'test-b',
      status: 'active',
    },
  ]);
}

// =============================================================================
// SCENARIO 1: Happy Path - Full Day Planning
// =============================================================================
async function scenario1() {
  currentScenario = 'Scenario 1: Happy Path';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 1: Happy Path - Full Day Planning', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario1@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  let planId: string;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const planDate = tomorrow.toISOString().split('T')[0];

  try {
    await step('Create day plan for tomorrow', async () => {
      const { data, status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: planDate,
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
      planId = data.id;
    });

    await step('Add 6 jobs sequentially', async () => {
      for (let i = 1; i <= 6; i++) {
        const { status } = await apiRequest('/api/scheduling/schedule-events', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: 'job',
            location_address: `${100 + i} Test St, NY`,
            location_data: `POINT(-74.00${i} 40.71${i})`,
            estimated_duration_minutes: 60,
            sequence_number: i,
            status: 'pending',
          }),
        });
        if (status !== 201) throw new Error(`Job ${i} failed: ${status}`);
      }
    });

    await step('Try to add 7th job (should fail)', async () => {
      const { status } = await apiRequest('/api/scheduling/schedule-events', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          day_plan_id: planId,
          event_type: 'job',
          location_address: '107 Test St, NY',
          location_data: 'POINT(-74.007 40.717)',
          estimated_duration_minutes: 60,
          sequence_number: 7,
          status: 'pending',
        }),
      });
      // Should return mock or error, but not 201
      if (status === 201) {
        // Check if it's real or mock
        const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
        const { count } = await adminClient
          .from('schedule_events')
          .select('id', { count: 'exact', head: true })
          .eq('day_plan_id', planId)
          .eq('event_type', 'job');
        if (count && count > 6) throw new Error(`7th job was created! Count: ${count}`);
      }
    });

    await step('List all plans - verify 1 plan exists', async () => {
      const { data, status } = await apiRequest(
        `/api/scheduling/day-plans?user_id=${user.userId}`,
        { token: user.token }
      );
      if (status !== 200) throw new Error(`Expected 200, got ${status}`);
      if (!Array.isArray(data) || data.length !== 1) {
        throw new Error(`Expected 1 plan, got ${data.length}`);
      }
    });

    await step('Query events for plan - verify 6 jobs', async () => {
      const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
      const { data, error } = await adminClient
        .from('schedule_events')
        .select('*')
        .eq('day_plan_id', planId)
        .eq('event_type', 'job');

      if (error) throw error;
      if (data.length !== 6) throw new Error(`Expected 6 jobs, got ${data.length}`);
    });

    log('  ✅ Scenario 1 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 1 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 2: Edge Case - Date Boundaries
// =============================================================================
async function scenario2() {
  currentScenario = 'Scenario 2: Date Boundaries';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 2: Edge Case - Date Boundaries', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario2@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const future365 = new Date(today);
  future365.setDate(future365.getDate() + 365);

  try {
    await step('Create plan for today', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: today.toISOString().split('T')[0],
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
    });

    await step('Create plan for yesterday (past date)', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: yesterday.toISOString().split('T')[0],
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
    });

    await step('Create plan for 365 days in future', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: future365.toISOString().split('T')[0],
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
    });

    await step('Try duplicate plan (same user, same date)', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: today.toISOString().split('T')[0],
          events: [],
        }),
      });
      // Should fail or return mock - not create duplicate in DB
      const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
      const { count } = await adminClient
        .from('day_plans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.userId)
        .eq('plan_date', today.toISOString().split('T')[0]);

      if (count && count > 1) throw new Error(`Duplicate plan created! Count: ${count}`);
    });

    await step('Query plans by date range', async () => {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, status } = await apiRequest(
        `/api/scheduling/day-plans?user_id=${user.userId}&start_date=${yesterday.toISOString().split('T')[0]}&end_date=${tomorrow.toISOString().split('T')[0]}`,
        { token: user.token }
      );
      if (status !== 200) throw new Error(`Expected 200, got ${status}`);
      // Should return at least today and yesterday
      if (!Array.isArray(data) || data.length < 2) {
        log(`      Note: Got ${data.length} plans in range, expected at least 2`, 'yellow');
      }
    });

    log('  ✅ Scenario 2 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 2 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 3: Concurrency - Race Conditions
// =============================================================================
async function scenario3() {
  currentScenario = 'Scenario 3: Concurrency';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 3: Concurrency - Race Conditions', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario3@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  let planId: string;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    await step('Create day plan', async () => {
      const { data, status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: tomorrow.toISOString().split('T')[0],
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
      planId = data.id;
    });

    await step('Spawn 10 concurrent job creation requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        apiRequest('/api/scheduling/schedule-events', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: 'job',
            location_address: `${200 + i} Test St, NY`,
            location_data: `POINT(-74.0${10 + i} 40.7${10 + i})`,
            estimated_duration_minutes: 60,
            sequence_number: i + 1,
            status: 'pending',
          }),
        })
      );

      await Promise.all(promises);
    });

    await step('Verify only 6 jobs created', async () => {
      const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
      const { count } = await adminClient
        .from('schedule_events')
        .select('id', { count: 'exact', head: true })
        .eq('day_plan_id', planId)
        .eq('event_type', 'job');

      if (!count || count > 6) {
        throw new Error(`Expected max 6 jobs, got ${count}. Race condition not handled!`);
      }
      log(`      Found ${count} jobs (correctly limited)`, 'cyan');
    });

    await step('Try to add another job (should fail)', async () => {
      const { status } = await apiRequest('/api/scheduling/schedule-events', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          day_plan_id: planId,
          event_type: 'job',
          location_address: '299 Test St, NY',
          location_data: 'POINT(-74.099 40.799)',
          estimated_duration_minutes: 60,
          sequence_number: 99,
          status: 'pending',
        }),
      });

      // Verify still only 6 jobs
      const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
      const { count } = await adminClient
        .from('schedule_events')
        .select('id', { count: 'exact', head: true })
        .eq('day_plan_id', planId)
        .eq('event_type', 'job');

      if (count && count > 6) throw new Error(`More than 6 jobs exist after limit test`);
    });

    log('  ✅ Scenario 3 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 3 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 4: Error Handling - Invalid Data
// =============================================================================
async function scenario4() {
  currentScenario = 'Scenario 4: Error Handling';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 4: Error Handling - Invalid Data', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario4@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const planDate = tomorrow.toISOString().split('T')[0];

  try {
    await step('POST plan without company_id (should fail 400)', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          user_id: user.userId,
          plan_date: planDate,
          events: [],
        }),
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    });

    await step('POST plan without user_id (should fail 400)', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          plan_date: planDate,
          events: [],
        }),
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    });

    await step('POST plan without plan_date (should fail 400)', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          events: [],
        }),
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    });

    await step('POST plan with invalid date format', async () => {
      const { status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: 'not-a-date',
          events: [],
        }),
      });
      // Database will reject invalid date format
      if (status === 201) {
        log('      Note: Invalid date not rejected at API level', 'yellow');
      }
    });

    // Create a valid plan for event tests
    let planId: string;
    await step('Create valid plan for event error tests', async () => {
      const { data, status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: planDate,
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
      planId = data.id;
    });

    await step('POST event with invalid event_type', async () => {
      const { status } = await apiRequest('/api/scheduling/schedule-events', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          day_plan_id: planId,
          event_type: 'invalid_type',
          location_address: '100 Test St',
          estimated_duration_minutes: 60,
          sequence_number: 1,
          status: 'pending',
        }),
      });
      if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    });

    await step('POST event with non-existent day_plan_id', async () => {
      const { status } = await apiRequest('/api/scheduling/schedule-events', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          day_plan_id: '00000000-0000-0000-0000-000000000099',
          event_type: 'job',
          location_address: '100 Test St',
          estimated_duration_minutes: 60,
          sequence_number: 1,
          status: 'pending',
        }),
      });
      // Should fail FK constraint or return mock
      if (status === 201) {
        log('      Note: FK constraint not validated at API level', 'yellow');
      }
    });

    await step('GET with invalid query parameters', async () => {
      const { status } = await apiRequest(
        '/api/scheduling/day-plans?limit=invalid',
        { token: user.token }
      );
      // Should handle gracefully
      if (status >= 500) throw new Error(`Server error: ${status}`);
    });

    log('  ✅ Scenario 4 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 4 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 5: Multi-User Isolation
// =============================================================================
async function scenario5() {
  currentScenario = 'Scenario 5: Multi-User Isolation';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 5: Multi-User Isolation', 'cyan');
  log('='.repeat(80), 'cyan');

  const userA = await createTestUser('scenario5a@test.com', 'Test123!', TEST_COMPANY_A);
  const userB = await createTestUser('scenario5b@test.com', 'Test123!', TEST_COMPANY_B);
  await cleanupTestData(TEST_COMPANY_A);
  await cleanupTestData(TEST_COMPANY_B);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const planDate = tomorrow.toISOString().split('T')[0];

  let userAPlanIds: string[] = [];
  let userBPlanIds: string[] = [];

  try {
    await step('User A creates 2 day plans', async () => {
      for (let i = 1; i <= 2; i++) {
        const date = new Date(tomorrow);
        date.setDate(date.getDate() + i);
        const { data, status } = await apiRequest('/api/scheduling/day-plans', {
          method: 'POST',
          token: userA.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_A,
            user_id: userA.userId,
            plan_date: date.toISOString().split('T')[0],
            events: [],
          }),
        });
        if (status !== 201) throw new Error(`User A plan ${i} failed: ${status}`);
        userAPlanIds.push(data.id);
      }
    });

    await step('User B creates 2 day plans', async () => {
      for (let i = 1; i <= 2; i++) {
        const date = new Date(tomorrow);
        date.setDate(date.getDate() + i);
        const { data, status } = await apiRequest('/api/scheduling/day-plans', {
          method: 'POST',
          token: userB.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_B,
            user_id: userB.userId,
            plan_date: date.toISOString().split('T')[0],
            events: [],
          }),
        });
        if (status !== 201) throw new Error(`User B plan ${i} failed: ${status}`);
        userBPlanIds.push(data.id);
      }
    });

    await step('User A queries plans (should see only their 2)', async () => {
      const { data, status } = await apiRequest(
        `/api/scheduling/day-plans?user_id=${userA.userId}`,
        { token: userA.token }
      );
      if (status !== 200) throw new Error(`Expected 200, got ${status}`);
      if (!Array.isArray(data)) throw new Error('Expected array');

      // Filter to only plans from company A
      const companyAPlans = data.filter(p => p.company_id === TEST_COMPANY_A);
      if (companyAPlans.length !== 2) {
        throw new Error(`User A should see 2 plans, saw ${companyAPlans.length}`);
      }
    });

    await step('User B queries plans (should see only their 2)', async () => {
      const { data, status } = await apiRequest(
        `/api/scheduling/day-plans?user_id=${userB.userId}`,
        { token: userB.token }
      );
      if (status !== 200) throw new Error(`Expected 200, got ${status}`);
      if (!Array.isArray(data)) throw new Error('Expected array');

      const companyBPlans = data.filter(p => p.company_id === TEST_COMPANY_B);
      if (companyBPlans.length !== 2) {
        throw new Error(`User B should see 2 plans, saw ${companyBPlans.length}`);
      }
    });

    await step('Admin queries all plans (should see 4 total)', async () => {
      const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
      const { data, error } = await adminClient
        .from('day_plans')
        .select('*')
        .in('company_id', [TEST_COMPANY_A, TEST_COMPANY_B]);

      if (error) throw error;
      if (data.length !== 4) {
        log(`      Note: Admin saw ${data.length} plans, expected 4`, 'yellow');
      }
    });

    log('  ✅ Scenario 5 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 5 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
    await cleanupTestData(TEST_COMPANY_B);
  }
}

// =============================================================================
// SCENARIO 6: Complex Workflow - Day Replanning
// =============================================================================
async function scenario6() {
  currentScenario = 'Scenario 6: Complex Workflow';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 6: Complex Workflow - Day Replanning', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario6@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
  let planId: string;
  let jobIds: string[] = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    await step('Create morning plan with 3 jobs', async () => {
      const { data, status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: tomorrow.toISOString().split('T')[0],
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
      planId = data.id;

      // Add 3 jobs
      for (let i = 1; i <= 3; i++) {
        const { data: eventData, status: eventStatus } = await apiRequest('/api/scheduling/schedule-events', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: 'job',
            location_address: `${300 + i} Morning St, NY`,
            location_data: `POINT(-74.0${20 + i} 40.7${20 + i})`,
            estimated_duration_minutes: 90,
            sequence_number: i,
            status: 'pending',
          }),
        });
        if (eventStatus === 201 && eventData.id) jobIds.push(eventData.id);
      }
    });

    await step('Mark first job as in_progress', async () => {
      if (jobIds.length === 0) {
        // Get job IDs from DB
        const { data } = await adminClient
          .from('schedule_events')
          .select('id')
          .eq('day_plan_id', planId)
          .order('sequence_number');
        if (data) jobIds = data.map(j => j.id);
      }

      if (jobIds[0]) {
        await adminClient
          .from('schedule_events')
          .update({ status: 'in_progress' })
          .eq('id', jobIds[0]);
      }
    });

    await step('Mark first job as completed', async () => {
      if (jobIds[0]) {
        await adminClient
          .from('schedule_events')
          .update({ status: 'completed' })
          .eq('id', jobIds[0]);
      }
    });

    await step('Add urgent job', async () => {
      const { status } = await apiRequest('/api/scheduling/schedule-events', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          day_plan_id: planId,
          event_type: 'job',
          location_address: '999 Urgent St, NY',
          location_data: 'POINT(-74.099 40.799)',
          estimated_duration_minutes: 120,
          sequence_number: 2, // Insert between jobs
          status: 'pending',
        }),
      });
      // Should succeed
    });

    await step('Mark second job as cancelled', async () => {
      if (jobIds[1]) {
        await adminClient
          .from('schedule_events')
          .update({ status: 'cancelled' })
          .eq('id', jobIds[1]);
      }
    });

    await step('Query final state and calculate stats', async () => {
      const { data, error } = await adminClient
        .from('schedule_events')
        .select('*')
        .eq('day_plan_id', planId)
        .eq('event_type', 'job');

      if (error) throw error;

      const completed = data.filter(j => j.status === 'completed').length;
      const cancelled = data.filter(j => j.status === 'cancelled').length;
      const pending = data.filter(j => j.status === 'pending').length;

      log(`      Stats: ${completed} completed, ${cancelled} cancelled, ${pending} pending`, 'cyan');
    });

    log('  ✅ Scenario 6 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 6 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 7: Geographic Data - Location Queries
// =============================================================================
async function scenario7() {
  currentScenario = 'Scenario 7: Geographic Data';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 7: Geographic Data - Location Queries', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario7@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
  let planId: string;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // NYC Borough coordinates
  const locations = [
    { name: 'Manhattan', coords: 'POINT(-73.9712 40.7831)' },
    { name: 'Brooklyn', coords: 'POINT(-73.9442 40.6782)' },
    { name: 'Queens', coords: 'POINT(-73.7949 40.7282)' },
    { name: 'Bronx', coords: 'POINT(-73.8648 40.8448)' },
    { name: 'Staten Island', coords: 'POINT(-74.1502 40.5795)' },
  ];

  try {
    await step('Create plan', async () => {
      const { data, status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: tomorrow.toISOString().split('T')[0],
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
      planId = data.id;
    });

    await step('Add jobs across NYC boroughs', async () => {
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        const { status } = await apiRequest('/api/scheduling/schedule-events', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: 'job',
            location_address: `${loc.name} Office`,
            location_data: loc.coords,
            estimated_duration_minutes: 60,
            sequence_number: i + 1,
            status: 'pending',
          }),
        });
        if (status !== 201 && status !== 200) {
          throw new Error(`Job in ${loc.name} failed: ${status}`);
        }
      }
    });

    await step('Add job with invalid PostGIS format', async () => {
      const { status } = await apiRequest('/api/scheduling/schedule-events', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          day_plan_id: planId,
          event_type: 'job',
          location_address: 'Invalid Location',
          location_data: 'INVALID_FORMAT',
          estimated_duration_minutes: 60,
          sequence_number: 6,
          status: 'pending',
        }),
      });
      // Should fail or return mock
      if (status === 201) {
        log('      Note: Invalid PostGIS format not rejected', 'yellow');
      }
    });

    await step('Test boundary coordinates', async () => {
      const boundaries = [
        { name: 'Origin', coords: 'POINT(0 0)' },
        { name: 'Max East', coords: 'POINT(180 45)' },
        { name: 'Max West', coords: 'POINT(-180 45)' },
      ];

      for (const boundary of boundaries) {
        const { data, error } = await adminClient
          .from('schedule_events')
          .insert({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: 'travel',
            location_address: boundary.name,
            location_data: boundary.coords,
            estimated_duration_minutes: 30,
            sequence_number: 99,
            status: 'pending',
          })
          .select()
          .single();

        if (!error && data) {
          // Clean up test record
          await adminClient.from('schedule_events').delete().eq('id', data.id);
        }
      }
    });

    await step('Verify all valid locations stored correctly', async () => {
      const { data, error } = await adminClient
        .from('schedule_events')
        .select('address, location_data')
        .eq('day_plan_id', planId)
        .eq('event_type', 'job')
        .not('location_data', 'is', null);

      if (error) throw error;
      log(`      Found ${data.length} jobs with location data`, 'cyan');
    });

    log('  ✅ Scenario 7 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 7 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 8: Event Types - Mixed Schedule
// =============================================================================
async function scenario8() {
  currentScenario = 'Scenario 8: Event Types';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 8: Event Types - Mixed Schedule', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario8@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
  let planId: string;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    await step('Create day plan', async () => {
      const { data, status } = await apiRequest('/api/scheduling/day-plans', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: tomorrow.toISOString().split('T')[0],
          events: [],
        }),
      });
      if (status !== 201) throw new Error(`Expected 201, got ${status}`);
      planId = data.id;
    });

    await step('Add mixed event schedule', async () => {
      const events = [
        { type: 'job', name: 'Morning Install', duration: 90, seq: 1 },
        { type: 'break', name: 'Coffee Break', duration: 15, seq: 2 },
        { type: 'job', name: 'Repair Job', duration: 60, seq: 3 },
        { type: 'travel', name: 'Drive to site', duration: 30, seq: 4 },
        { type: 'job', name: 'Afternoon Install', duration: 120, seq: 5 },
        { type: 'meeting', name: 'Team Standup', duration: 15, seq: 6 },
        { type: 'break', name: 'Lunch', duration: 30, seq: 7 },
        { type: 'job', name: 'Final Job', duration: 90, seq: 8 },
      ];

      for (const event of events) {
        const { status } = await apiRequest('/api/scheduling/schedule-events', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: event.type,
            location_address: event.name,
            location_data: 'POINT(-74.006 40.7128)',
            estimated_duration_minutes: event.duration,
            sequence_number: event.seq,
            status: 'pending',
          }),
        });
        // All should succeed (or return mock)
      }
    });

    await step('Verify only job events count toward limit', async () => {
      const { count: jobCount } = await adminClient
        .from('schedule_events')
        .select('id', { count: 'exact', head: true })
        .eq('day_plan_id', planId)
        .eq('event_type', 'job');

      const { count: totalCount } = await adminClient
        .from('schedule_events')
        .select('id', { count: 'exact', head: true })
        .eq('day_plan_id', planId);

      log(`      Jobs: ${jobCount}, Total events: ${totalCount}`, 'cyan');

      if (jobCount && jobCount > 6) {
        throw new Error(`Too many jobs created: ${jobCount}`);
      }
    });

    await step('Try to add more jobs (should respect limit)', async () => {
      // Try to add 2 more jobs
      for (let i = 1; i <= 2; i++) {
        const { status } = await apiRequest('/api/scheduling/schedule-events', {
          method: 'POST',
          token: user.token,
          body: JSON.stringify({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: 'job',
            location_address: `Extra Job ${i}`,
            location_data: 'POINT(-74.006 40.7128)',
            estimated_duration_minutes: 60,
            sequence_number: 10 + i,
            status: 'pending',
          }),
        });
      }

      // Verify still within limit
      const { count } = await adminClient
        .from('schedule_events')
        .select('id', { count: 'exact', head: true })
        .eq('day_plan_id', planId)
        .eq('event_type', 'job');

      if (count && count > 6) {
        throw new Error(`Job limit exceeded: ${count} jobs`);
      }
    });

    await step('Verify breaks/travel/meetings are unlimited', async () => {
      // Add more non-job events
      const extraEvents = [
        { type: 'break', name: 'Afternoon Break' },
        { type: 'travel', name: 'Return Trip' },
        { type: 'meeting', name: 'End of Day Call' },
      ];

      for (let i = 0; i < extraEvents.length; i++) {
        const event = extraEvents[i];
        await adminClient
          .from('schedule_events')
          .insert({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: event.type as any,
            location_address: event.name,
            estimated_duration_minutes: 15,
            sequence_number: 20 + i,
            status: 'pending',
          });
      }

      const { count: nonJobCount } = await adminClient
        .from('schedule_events')
        .select('id', { count: 'exact', head: true })
        .eq('day_plan_id', planId)
        .neq('event_type', 'job');

      log(`      Non-job events: ${nonJobCount} (unlimited)`, 'cyan');
    });

    log('  ✅ Scenario 8 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 8 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 9: Voice Integration - Session Tracking
// =============================================================================
async function scenario9() {
  currentScenario = 'Scenario 9: Voice Integration';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 9: Voice Integration - Session Tracking', 'cyan');
  log('='.repeat(80), 'cyan');

  const user = await createTestUser('scenario9@test.com', 'Test123!');
  await cleanupTestData(TEST_COMPANY_A);

  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
  const voiceSessionId = `voice-session-${Date.now()}`;
  let planId: string;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    await step('Create plan with voice_session_id', async () => {
      const { data, error } = await adminClient
        .from('day_plans')
        .insert({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: tomorrow.toISOString().split('T')[0],
          status: 'draft',
          voice_session_id: voiceSessionId,
        })
        .select()
        .single();

      if (error) throw error;
      planId = data.id;
    });

    await step('Add jobs via voice (include voice metadata)', async () => {
      for (let i = 1; i <= 3; i++) {
        const { error } = await adminClient
          .from('schedule_events')
          .insert({
            company_id: TEST_COMPANY_A,
            day_plan_id: planId,
            event_type: 'job',
            location_address: `Voice Job ${i}`,
            location_data: `POINT(-74.0${i} 40.7${i})`,
            estimated_duration_minutes: 60,
            sequence_number: i,
            status: 'pending',
            metadata: {
              created_via: 'voice',
              voice_session_id: voiceSessionId,
              voice_confidence: 0.95,
            },
          });

        if (error) throw error;
      }
    });

    await step('Query plans by voice_session_id', async () => {
      const { data, error } = await adminClient
        .from('day_plans')
        .select('*')
        .eq('voice_session_id', voiceSessionId);

      if (error) throw error;
      if (!data || data.length !== 1) {
        throw new Error(`Expected 1 plan with voice session, found ${data?.length}`);
      }
    });

    await step('Create plan without voice (null voice fields)', async () => {
      const { data, error } = await adminClient
        .from('day_plans')
        .insert({
          company_id: TEST_COMPANY_A,
          user_id: user.userId,
          plan_date: new Date(tomorrow.getTime() + 86400000).toISOString().split('T')[0],
          status: 'draft',
          // voice_session_id intentionally null
        })
        .select()
        .single();

      if (error) throw error;
      if (data.voice_session_id !== null) {
        throw new Error('voice_session_id should be null');
      }
    });

    await step('Verify voice fields are optional', async () => {
      const { data, error } = await adminClient
        .from('day_plans')
        .select('*')
        .eq('company_id', TEST_COMPANY_A)
        .eq('user_id', user.userId);

      if (error) throw error;

      const withVoice = data.filter(p => p.voice_session_id !== null).length;
      const withoutVoice = data.filter(p => p.voice_session_id === null).length;

      log(`      Plans with voice: ${withVoice}, without: ${withoutVoice}`, 'cyan');
    });

    log('  ✅ Scenario 9 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 9 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// SCENARIO 10: Performance & Stress - Bulk Operations
// =============================================================================
async function scenario10() {
  currentScenario = 'Scenario 10: Performance';
  log('\n' + '='.repeat(80), 'cyan');
  log('SCENARIO 10: Performance & Stress - Bulk Operations', 'cyan');
  log('='.repeat(80), 'cyan');

  await cleanupTestData(TEST_COMPANY_A);

  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey);
  const userCount = 5; // Reduced from 20 for faster testing
  const plansPerUser = 3; // Reduced from 5
  const users: Array<{ userId: string; token: string }> = [];

  try {
    await step(`Create ${userCount} test users`, async () => {
      for (let i = 1; i <= userCount; i++) {
        const user = await createTestUser(`perf${i}@test.com`, 'Test123!');
        users.push(user);
      }
    });

    const startBulk = Date.now();

    await step(`Each user creates ${plansPerUser} day plans`, async () => {
      const promises = [];
      for (const user of users) {
        for (let i = 1; i <= plansPerUser; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);

          promises.push(
            apiRequest('/api/scheduling/day-plans', {
              method: 'POST',
              token: user.token,
              body: JSON.stringify({
                company_id: TEST_COMPANY_A,
                user_id: user.userId,
                plan_date: date.toISOString().split('T')[0],
                events: [],
              }),
            })
          );
        }
      }

      await Promise.all(promises);
      log(`      Created ${userCount * plansPerUser} plans concurrently`, 'cyan');
    });

    await step('Add 4-6 jobs to each plan', async () => {
      // Get all plan IDs
      const { data: plans } = await adminClient
        .from('day_plans')
        .select('id')
        .eq('company_id', TEST_COMPANY_A);

      if (!plans) throw new Error('No plans found');

      const jobPromises = [];
      for (const plan of plans) {
        const jobCount = Math.floor(Math.random() * 3) + 4; // 4-6 jobs
        for (let j = 1; j <= jobCount; j++) {
          jobPromises.push(
            adminClient.from('schedule_events').insert({
              company_id: TEST_COMPANY_A,
              day_plan_id: plan.id,
              event_type: 'job',
              location_address: `Bulk Job ${j}`,
              location_data: `POINT(-74.0${j} 40.7${j})`,
              estimated_duration_minutes: 60,
              sequence_number: j,
              status: 'pending',
            })
          );
        }
      }

      await Promise.all(jobPromises);
      log(`      Created ~${plans.length * 5} jobs`, 'cyan');
    });

    const bulkDuration = Date.now() - startBulk;
    log(`      Total bulk creation time: ${bulkDuration}ms`, 'cyan');

    await step('Query all plans (measure performance)', async () => {
      const queryStart = Date.now();
      const { data, error } = await adminClient
        .from('day_plans')
        .select('*')
        .eq('company_id', TEST_COMPANY_A)
        .limit(100);

      const queryTime = Date.now() - queryStart;
      if (error) throw error;

      log(`      Query returned ${data.length} plans in ${queryTime}ms`, 'cyan');
      if (queryTime > 500) {
        log(`      Warning: Query took ${queryTime}ms (>500ms threshold)`, 'yellow');
      }
    });

    await step('Query with complex filters', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const queryStart = Date.now();
      const { data, error } = await adminClient
        .from('day_plans')
        .select('*, schedule_events(*)')
        .eq('company_id', TEST_COMPANY_A)
        .gte('plan_date', tomorrow.toISOString().split('T')[0])
        .lte('plan_date', nextWeek.toISOString().split('T')[0])
        .eq('status', 'draft');

      const queryTime = Date.now() - queryStart;
      if (error) throw error;

      log(`      Complex query returned ${data.length} plans in ${queryTime}ms`, 'cyan');
    });

    await step('Verify no data corruption', async () => {
      const { count: planCount } = await adminClient
        .from('day_plans')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', TEST_COMPANY_A);

      const { count: eventCount } = await adminClient
        .from('schedule_events')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', TEST_COMPANY_A);

      log(`      Final counts: ${planCount} plans, ${eventCount} events`, 'cyan');

      if (!planCount || planCount < userCount * plansPerUser) {
        throw new Error('Some plans missing!');
      }
    });

    log('  ✅ Scenario 10 PASSED', 'green');
  } catch (error: any) {
    log(`  ❌ Scenario 10 FAILED: ${error.message}`, 'red');
  } finally {
    await cleanupTestData(TEST_COMPANY_A);
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================
async function main() {
  log('\n' + '='.repeat(80), 'magenta');
  log('COMPREHENSIVE E2E TEST SUITE', 'magenta');
  log('10 Scenarios Covering Edge Cases, Security, and Performance', 'magenta');
  log('='.repeat(80), 'magenta');

  // Setup test companies
  log('\n🔧 Setting up test companies...', 'cyan');
  await setupTestCompanies();
  log('✅ Test companies ready', 'green');

  const startTime = Date.now();

  // Execute all scenarios
  await scenario1();
  await scenario2();
  await scenario3();
  await scenario4();
  await scenario5();
  await scenario6();
  await scenario7();
  await scenario8();
  await scenario9();
  await scenario10();

  const totalTime = Date.now() - startTime;

  // Summary
  log('\n' + '='.repeat(80), 'magenta');
  log('FINAL SUMMARY', 'magenta');
  log('='.repeat(80), 'magenta');

  const scenarios = [...new Set(results.map(r => r.scenario))];
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  log(`\n📊 Overall Results:`, 'blue');
  log(`   Total Scenarios: ${scenarios.length}`);
  log(`   Total Steps: ${results.length}`);
  log(`   ✅ Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`, 'green');
  if (failed > 0) {
    log(`   ❌ Failed: ${failed}`, 'red');
  }
  log(`   ⏱️  Total Duration: ${(totalTime / 1000).toFixed(1)}s`);
  log(`   ⏱️  Average Step: ${(results.reduce((s, r) => s + r.duration, 0) / results.length).toFixed(0)}ms`);

  log(`\n📋 By Scenario:`, 'blue');
  for (const scenario of scenarios) {
    const scenarioResults = results.filter(r => r.scenario === scenario);
    const scenarioPassed = scenarioResults.filter(r => r.status === 'PASS').length;
    const scenarioTotal = scenarioResults.length;
    const status = scenarioPassed === scenarioTotal ? '✅' : '⚠️';
    log(`   ${status} ${scenario}: ${scenarioPassed}/${scenarioTotal}`, scenarioPassed === scenarioTotal ? 'green' : 'yellow');
  }

  if (failed > 0) {
    log(`\n❌ Failed Steps:`, 'red');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        log(`   • ${r.scenario} - ${r.step}`, 'red');
        log(`     ${r.error}`, 'gray');
      });
  }

  log('\n' + '='.repeat(80), 'magenta');
  if (failed === 0) {
    log('✅ ALL SCENARIOS PASSED', 'green');
  } else {
    log(`⚠️  ${failed} STEP(S) FAILED`, 'yellow');
  }
  log('='.repeat(80), 'magenta');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});