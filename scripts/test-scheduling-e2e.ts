#!/usr/bin/env tsx
/**
 * End-to-End Scheduling System Test
 * Tests the complete flow through HTTP API with real authentication
 */

require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Test constants
const TEST_USER_EMAIL = 'test-tech@jobeye.test';
const TEST_USER_PASSWORD = 'TestPassword123!';
const TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    log(`\n▶ ${name}`, 'blue');
    await testFn();
    const duration = Date.now() - start;
    log(`  ✅ PASS (${duration}ms)`, 'green');
    results.push({ name, status: 'PASS', duration });
  } catch (error: any) {
    const duration = Date.now() - start;
    log(`  ❌ FAIL: ${error.message}`, 'red');
    results.push({ name, status: 'FAIL', duration, error: error.message });
  }
}

// API test helper
async function apiRequest(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
) {
  const { token, ...fetchOptions } = options;

  const url = `http://localhost:3000${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  return { response, data, status: response.status };
}

async function main() {
  log('\n' + '='.repeat(80), 'cyan');
  log('END-TO-END SCHEDULING SYSTEM TEST', 'cyan');
  log('Testing complete flow with real authentication', 'cyan');
  log('='.repeat(80), 'cyan');

  // Create clients
  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const userClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

  let authToken: string | undefined;
  let userId: string | undefined;
  let createdPlanId: string | undefined;
  let createdEventId: string | undefined;

  log('\n📋 SETUP PHASE', 'yellow');

  // ===================================================================
  // PHASE 1: Setup Test User & Authentication
  // ===================================================================

  await test('Setup: Ensure test company exists', async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('id')
      .eq('id', TEST_COMPANY_ID)
      .single();

    if (companyError || !company) {
      // Create test company
      const { error: insertError } = await adminClient
        .from('companies')
        .upsert({
          id: TEST_COMPANY_ID,
          tenant_id: TEST_COMPANY_ID,
          name: 'E2E Test Company',
          slug: 'e2e-test',
          status: 'active',
        });

      if (insertError) throw insertError;
      log('    Created test company', 'cyan');
    } else {
      log('    Test company exists', 'cyan');
    }
  });

  await test('Setup: Create or get test user', async () => {
    // Try to sign in first
    const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (signInError) {
      // User doesn't exist, create it
      log('    Creating new test user...', 'cyan');

      const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'E2E Test Technician',
        },
      });

      if (signUpError || !signUpData.user) {
        throw new Error(`Failed to create user: ${signUpError?.message}`);
      }

      userId = signUpData.user.id;

      // Now sign in to get token
      const { data: newSignIn, error: newSignInError } = await userClient.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      if (newSignInError || !newSignIn.session) {
        throw new Error(`Failed to sign in after creation: ${newSignInError?.message}`);
      }

      authToken = newSignIn.session.access_token;
      log(`    Created user and obtained token`, 'cyan');
    } else {
      // User exists and signed in successfully
      if (!signInData.session) {
        throw new Error('Sign in successful but no session returned');
      }

      authToken = signInData.session.access_token;
      userId = signInData.user.id;
      log(`    Signed in as existing user`, 'cyan');
    }

    if (!authToken || !userId) {
      throw new Error('Failed to obtain authentication token or user ID');
    }
  });

  await test('Setup: Clean up old test data', async () => {
    // Delete old test data using service role
    await adminClient
      .from('schedule_events')
      .delete()
      .eq('company_id', TEST_COMPANY_ID);

    await adminClient
      .from('day_plans')
      .delete()
      .eq('company_id', TEST_COMPANY_ID);

    log('    Cleaned up old test data', 'cyan');
  });

  log('\n🧪 API TESTS', 'yellow');

  // ===================================================================
  // PHASE 2: Test Day Plans API
  // ===================================================================

  await test('API: GET /api/scheduling/day-plans (empty)', async () => {
    const { data, status } = await apiRequest('/api/scheduling/day-plans?limit=10', {
      token: authToken,
    });

    if (status !== 200) {
      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data)) {
      throw new Error(`Expected array, got ${typeof data}`);
    }

    log(`    Returned ${data.length} plans`, 'cyan');
  });

  await test('API: POST /api/scheduling/day-plans (create plan)', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const planDate = tomorrow.toISOString().split('T')[0];

    const { data, status } = await apiRequest('/api/scheduling/day-plans', {
      method: 'POST',
      token: authToken,
      body: JSON.stringify({
        company_id: TEST_COMPANY_ID,
        user_id: userId,
        plan_date: planDate,
        status: 'draft',
        events: [
          {
            event_type: 'job',
            location_address: '123 Main St, New York, NY',
            location_data: 'POINT(-74.0060 40.7128)',
            estimated_duration_minutes: 120,
            sequence_number: 1,
            status: 'pending',
          },
        ],
      }),
    });

    if (status !== 201) {
      throw new Error(`Expected 201, got ${status}: ${JSON.stringify(data)}`);
    }

    if (!data.id) {
      throw new Error('Response missing plan ID');
    }

    createdPlanId = data.id;
    log(`    Created plan: ${createdPlanId}`, 'cyan');
  });

  await test('API: GET /api/scheduling/day-plans (with data)', async () => {
    const { data, status } = await apiRequest('/api/scheduling/day-plans?limit=10', {
      token: authToken,
    });

    if (status !== 200) {
      throw new Error(`Expected 200, got ${status}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Expected non-empty array, got ${data.length} items`);
    }

    log(`    Returned ${data.length} plan(s)`, 'cyan');
  });

  await test('API: GET /api/scheduling/day-plans/:id (single plan)', async () => {
    if (!createdPlanId) throw new Error('No plan ID from previous test');

    const { data, status } = await apiRequest(`/api/scheduling/day-plans/${createdPlanId}`, {
      token: authToken,
    });

    if (status !== 200) {
      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
    }

    if (data.id !== createdPlanId) {
      throw new Error(`Expected plan ID ${createdPlanId}, got ${data.id}`);
    }

    log(`    Retrieved plan: ${data.id}`, 'cyan');
    log(`    Status: ${data.status}`, 'cyan');
    log(`    Date: ${data.plan_date}`, 'cyan');
  });

  // ===================================================================
  // PHASE 3: Test Schedule Events API
  // ===================================================================

  await test('API: GET /api/scheduling/events (by day_plan_id)', async () => {
    if (!createdPlanId) throw new Error('No plan ID from previous test');

    const { data, status } = await apiRequest(
      `/api/scheduling/events?day_plan_id=${createdPlanId}`,
      { token: authToken }
    );

    if (status !== 200) {
      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data)) {
      throw new Error(`Expected array, got ${typeof data}`);
    }

    if (data.length > 0) {
      createdEventId = data[0].id;
      log(`    Found ${data.length} event(s)`, 'cyan');
      log(`    First event: ${createdEventId}`, 'cyan');
    }
  });

  await test('API: POST /api/scheduling/events (add job to plan)', async () => {
    if (!createdPlanId) throw new Error('No plan ID from previous test');

    const { data, status } = await apiRequest('/api/scheduling/events', {
      method: 'POST',
      token: authToken,
      body: JSON.stringify({
        company_id: TEST_COMPANY_ID,
        day_plan_id: createdPlanId,
        event_type: 'job',
        location_address: '456 Broadway, New York, NY',
        location_data: 'POINT(-74.0100 40.7150)',
        estimated_duration_minutes: 90,
        sequence_number: 2,
        status: 'pending',
      }),
    });

    if (status !== 201) {
      throw new Error(`Expected 201, got ${status}: ${JSON.stringify(data)}`);
    }

    if (!data.id) {
      throw new Error('Response missing event ID');
    }

    log(`    Created event: ${data.id}`, 'cyan');
  });

  await test('API: Enforce 6-job limit', async () => {
    if (!createdPlanId) throw new Error('No plan ID from previous test');

    // We already have 2 jobs, try to add 5 more (total 7, should fail on 7th)
    let successCount = 0;
    let failureMessage = '';

    for (let i = 3; i <= 8; i++) {
      const { data, status } = await apiRequest('/api/scheduling/events', {
        method: 'POST',
        token: authToken,
        body: JSON.stringify({
          company_id: TEST_COMPANY_ID,
          day_plan_id: createdPlanId,
          event_type: 'job',
          location_address: `${100 + i} Test St, New York, NY`,
          location_data: `POINT(-74.0${100 + i} 40.7${100 + i})`,
          estimated_duration_minutes: 60,
          sequence_number: i,
          status: 'pending',
        }),
      });

      if (status === 201) {
        successCount++;
      } else if (status === 400 && data.error?.includes('6 jobs')) {
        failureMessage = data.error;
        break;
      }
    }

    if (successCount !== 4) {
      throw new Error(`Expected to add exactly 4 more jobs, added ${successCount}`);
    }

    if (!failureMessage.includes('6 jobs')) {
      throw new Error('Expected 6-job limit error message');
    }

    log(`    ✓ Added 4 more jobs (total 6)`, 'cyan');
    log(`    ✓ 7th job rejected with: "${failureMessage}"`, 'cyan');
  });

  await test('API: PATCH /api/scheduling/events/:id (update event)', async () => {
    if (!createdEventId) throw new Error('No event ID from previous test');

    const { data, status } = await apiRequest(`/api/scheduling/events/${createdEventId}`, {
      method: 'PATCH',
      token: authToken,
      body: JSON.stringify({
        status: 'in_progress',
        notes: 'Updated via E2E test',
      }),
    });

    if (status !== 200) {
      throw new Error(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
    }

    if (data.status !== 'in_progress') {
      throw new Error(`Expected status 'in_progress', got '${data.status}'`);
    }

    log(`    Updated event status to: ${data.status}`, 'cyan');
  });

  await test('API: DELETE /api/scheduling/events/:id (delete event)', async () => {
    if (!createdEventId) throw new Error('No event ID from previous test');

    const { status } = await apiRequest(`/api/scheduling/events/${createdEventId}`, {
      method: 'DELETE',
      token: authToken,
    });

    if (status !== 204 && status !== 200) {
      throw new Error(`Expected 204 or 200, got ${status}`);
    }

    // Verify it's gone
    const { status: getStatus } = await apiRequest(`/api/scheduling/events/${createdEventId}`, {
      token: authToken,
    });

    if (getStatus !== 404) {
      throw new Error(`Expected 404 after delete, got ${getStatus}`);
    }

    log(`    Deleted event successfully`, 'cyan');
  });

  // ===================================================================
  // PHASE 4: Authentication & Authorization Tests
  // ===================================================================

  log('\n🔒 SECURITY TESTS', 'yellow');

  await test('Security: API rejects requests without auth token', async () => {
    const { status } = await apiRequest('/api/scheduling/day-plans');

    if (status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${status}`);
    }

    log(`    ✓ Correctly rejected unauthenticated request`, 'cyan');
  });

  await test('Security: API rejects invalid auth token', async () => {
    const { status } = await apiRequest('/api/scheduling/day-plans', {
      token: 'invalid-token-12345',
    });

    if (status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got ${status}`);
    }

    log(`    ✓ Correctly rejected invalid token`, 'cyan');
  });

  // ===================================================================
  // PHASE 5: Cleanup
  // ===================================================================

  log('\n🧹 CLEANUP PHASE', 'yellow');

  await test('Cleanup: Delete test data', async () => {
    await adminClient
      .from('schedule_events')
      .delete()
      .eq('company_id', TEST_COMPANY_ID);

    const { count: eventsCount } = await adminClient
      .from('schedule_events')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', TEST_COMPANY_ID);

    await adminClient
      .from('day_plans')
      .delete()
      .eq('company_id', TEST_COMPANY_ID);

    const { count: plansCount } = await adminClient
      .from('day_plans')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', TEST_COMPANY_ID);

    log(`    Deleted events: ${eventsCount || 0}`, 'cyan');
    log(`    Deleted plans: ${plansCount || 0}`, 'cyan');
  });

  await test('Cleanup: Sign out test user', async () => {
    await userClient.auth.signOut();
    log(`    Signed out successfully`, 'cyan');
  });

  // ===================================================================
  // SUMMARY
  // ===================================================================

  log('\n' + '='.repeat(80), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(80), 'cyan');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  log('\n📊 Results:', 'blue');
  log(`   Total Tests: ${results.length}`);
  log(`   ✅ Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`, 'green');
  if (failed > 0) {
    log(`   ❌ Failed: ${failed}`, 'red');
  }
  log(`\n⏱️  Performance:`);
  log(`   Total Duration: ${totalDuration}ms`);
  log(`   Average Test: ${(totalDuration / results.length).toFixed(1)}ms`);

  if (failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        log(`   • ${r.name}`, 'red');
        log(`     ${r.error}`, 'reset');
      });
    log('\n' + '='.repeat(80), 'cyan');
    log('⚠️  SOME TESTS FAILED', 'red');
    log('='.repeat(80), 'cyan');
    process.exit(1);
  } else {
    log('\n' + '='.repeat(80), 'cyan');
    log('✅ ALL TESTS PASSED', 'green');
    log('='.repeat(80), 'cyan');
  }
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});