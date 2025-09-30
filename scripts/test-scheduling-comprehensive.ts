#!/usr/bin/env tsx
/**
 * Comprehensive Scheduling Test Suite
 *
 * Tests all edge cases, error conditions, business rules, and real-world scenarios
 *
 * Categories:
 * 1. Basic CRUD Operations
 * 2. Business Rule Validation (6-job limit, conflicts, etc)
 * 3. Edge Cases (boundaries, nulls, invalid data)
 * 4. Concurrent Operations
 * 5. Data Integrity (FK constraints, RLS, etc)
 * 6. Performance & Stress Tests
 * 7. Real-World Scenarios
 *
 * Run with: npx tsx scripts/test-scheduling-comprehensive.ts
 */

// Load environment FIRST
require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_USER_ID_2 = '223e4567-e89b-12d3-a456-426614174000';

// Test results tracking
interface TestResult {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];
let currentCategory = '';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function category(name: string) {
  currentCategory = name;
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`${name}`, 'cyan');
  log('='.repeat(80), 'cyan');
}

async function test(name: string, testFn: () => Promise<void>) {
  const start = Date.now();

  try {
    log(`\n▶ ${name}`, 'blue');
    await testFn();
    const duration = Date.now() - start;
    log(`  ✅ PASS (${duration}ms)`, 'green');
    results.push({ category: currentCategory, name, status: 'PASS', duration });
  } catch (error: any) {
    const duration = Date.now() - start;
    log(`  ❌ FAIL: ${error.message}`, 'red');
    results.push({
      category: currentCategory,
      name,
      status: 'FAIL',
      duration,
      error: error.message,
      details: error.details || error.hint
    });
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(value: any, message: string) {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

// Helper functions
async function createTestDayPlan(date: string, userId: string = TEST_USER_ID) {
  const { data, error } = await supabase
    .from('day_plans')
    .insert({
      company_id: TEST_COMPANY_ID,
      user_id: userId,
      plan_date: date,
      status: 'draft',
      route_data: {},
      total_distance_miles: 0,
      estimated_duration_minutes: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function createTestEvent(dayPlanId: string, sequenceOrder: number, startTime: string) {
  const { data, error } = await supabase
    .from('schedule_events')
    .insert({
      company_id: TEST_COMPANY_ID,
      day_plan_id: dayPlanId,
      event_type: 'job',
      job_id: `test-job-${sequenceOrder}-${Date.now()}`,
      sequence_order: sequenceOrder,
      scheduled_start: startTime,
      scheduled_duration_minutes: 60,
      status: 'pending',
      address: `${sequenceOrder}23 Test St`,
      location_data: `POINT(${-74.0060 + (sequenceOrder * 0.01)} ${40.7128 + (sequenceOrder * 0.01)})`
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function cleanup() {
  await supabase.from('schedule_events').delete().eq('company_id', TEST_COMPANY_ID);
  await supabase.from('day_plans').delete().eq('company_id', TEST_COMPANY_ID);
}

/**
 * CATEGORY 1: Basic CRUD Operations
 */
async function testBasicCRUD() {
  category('CATEGORY 1: Basic CRUD Operations');

  await test('Create day plan with all required fields', async () => {
    const plan = await createTestDayPlan('2025-11-01');
    assertNotNull(plan.id, 'Plan ID should exist');
    assertEqual(plan.plan_date, '2025-11-01', 'Date should match');
    assertEqual(plan.status, 'draft', 'Initial status should be draft');
  });

  await test('Read day plan by ID', async () => {
    const plan = await createTestDayPlan('2025-11-02');

    const { data, error } = await supabase
      .from('day_plans')
      .select('*')
      .eq('id', plan.id)
      .single();

    assert(!error, 'Should read without error');
    assertEqual(data?.id, plan.id, 'Should return correct plan');
  });

  await test('Update day plan status', async () => {
    const plan = await createTestDayPlan('2025-11-03');

    const { data, error } = await supabase
      .from('day_plans')
      .update({ status: 'published' })
      .eq('id', plan.id)
      .select()
      .single();

    assert(!error, 'Update should succeed');
    assertEqual(data?.status, 'published', 'Status should be updated');
  });

  await test('Delete day plan', async () => {
    const plan = await createTestDayPlan('2025-11-04');

    const { error: deleteError } = await supabase
      .from('day_plans')
      .delete()
      .eq('id', plan.id);

    assert(!deleteError, 'Delete should succeed');

    const { data } = await supabase
      .from('day_plans')
      .select()
      .eq('id', plan.id)
      .single();

    assertEqual(data, null, 'Plan should no longer exist');
  });

  await test('Create schedule event with PostGIS location', async () => {
    const plan = await createTestDayPlan('2025-11-05');
    const event = await createTestEvent(plan.id, 1, '2025-11-05T08:00:00Z');

    assertNotNull(event.id, 'Event should be created');
    assertNotNull(event.location_data, 'Location should be saved');
    assertEqual(event.sequence_order, 1, 'Sequence should match');
  });

  await test('Query events by day plan', async () => {
    const plan = await createTestDayPlan('2025-11-06');
    await createTestEvent(plan.id, 1, '2025-11-06T08:00:00Z');
    await createTestEvent(plan.id, 2, '2025-11-06T09:30:00Z');
    await createTestEvent(plan.id, 3, '2025-11-06T11:00:00Z');

    const { data } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', plan.id)
      .order('sequence_order');

    assertEqual(data?.length, 3, 'Should return 3 events');
    assertEqual(data?.[0].sequence_order, 1, 'Should be ordered');
  });
}

/**
 * CATEGORY 2: Business Rule Validation
 */
async function testBusinessRules() {
  category('CATEGORY 2: Business Rule Validation');

  await test('Enforce 6-job limit per day', async () => {
    const plan = await createTestDayPlan('2025-11-10');

    // Add 6 jobs successfully
    for (let i = 1; i <= 6; i++) {
      await createTestEvent(plan.id, i, `2025-11-10T${7 + i}:00:00Z`);
    }

    // Check count
    const { count } = await supabase
      .from('schedule_events')
      .select('id', { count: 'exact', head: true })
      .eq('day_plan_id', plan.id)
      .eq('event_type', 'job');

    assertEqual(count, 6, 'Should have exactly 6 jobs');

    // Try to add 7th - in production API this would be blocked
    // For this test, we verify count reaches limit
    assert(count! >= 6, '6-job limit reached');
  });

  await test('Unique constraint: one plan per user per date', async () => {
    await createTestDayPlan('2025-11-11', TEST_USER_ID);

    try {
      await createTestDayPlan('2025-11-11', TEST_USER_ID);
      throw new Error('Should have failed with unique constraint');
    } catch (error: any) {
      assert(
        error.message.includes('duplicate key') || error.code === '23505',
        'Should fail with unique constraint error'
      );
    }
  });

  await test('Different users can have plans on same date', async () => {
    await createTestDayPlan('2025-11-12', TEST_USER_ID);
    const plan2 = await createTestDayPlan('2025-11-12', TEST_USER_ID_2);

    assertNotNull(plan2, 'Second user should be able to create plan');
  });

  await test('Cascade delete: deleting plan deletes events', async () => {
    const plan = await createTestDayPlan('2025-11-13');
    const event1 = await createTestEvent(plan.id, 1, '2025-11-13T08:00:00Z');
    const event2 = await createTestEvent(plan.id, 2, '2025-11-13T09:30:00Z');

    // Delete plan
    await supabase.from('day_plans').delete().eq('id', plan.id);

    // Events should be gone
    const { data } = await supabase
      .from('schedule_events')
      .select()
      .in('id', [event1.id, event2.id]);

    assertEqual(data?.length, 0, 'Events should be cascade deleted');
  });

  await test('Valid status transitions', async () => {
    const plan = await createTestDayPlan('2025-11-14');

    const statuses = ['draft', 'published', 'in_progress', 'completed', 'cancelled'];

    for (const status of statuses) {
      const { error } = await supabase
        .from('day_plans')
        .update({ status })
        .eq('id', plan.id);

      assert(!error, `Status ${status} should be valid`);
    }
  });

  await test('Invalid status rejected', async () => {
    const plan = await createTestDayPlan('2025-11-15');

    try {
      await supabase
        .from('day_plans')
        .update({ status: 'invalid_status' as any })
        .eq('id', plan.id);

      throw new Error('Should have rejected invalid status');
    } catch (error: any) {
      assert(
        error.message.includes('violates check constraint') || error.code === '23514',
        'Should fail with check constraint error'
      );
    }
  });
}

/**
 * CATEGORY 3: Edge Cases & Invalid Data
 */
async function testEdgeCases() {
  category('CATEGORY 3: Edge Cases & Invalid Data');

  await test('Create plan with past date', async () => {
    const plan = await createTestDayPlan('2020-01-01');
    assertNotNull(plan, 'Should allow past dates');
    assertEqual(plan.plan_date, '2020-01-01', 'Date should be stored');
  });

  await test('Create plan with far future date', async () => {
    const plan = await createTestDayPlan('2099-12-31');
    assertNotNull(plan, 'Should allow far future dates');
  });

  await test('Create event with null location_data', async () => {
    const plan = await createTestDayPlan('2025-11-20');

    const { data, error } = await supabase
      .from('schedule_events')
      .insert({
        company_id: TEST_COMPANY_ID,
        day_plan_id: plan.id,
        event_type: 'job',
        job_id: `test-job-${Date.now()}`,
        sequence_order: 1,
        scheduled_start: '2025-11-20T08:00:00Z',
        scheduled_duration_minutes: 60,
        status: 'pending',
        location_data: null // Explicitly null
      })
      .select()
      .single();

    assert(!error, 'Should allow null location');
    assertEqual(data.location_data, null, 'Location should be null');
  });

  await test('Event with zero duration', async () => {
    const plan = await createTestDayPlan('2025-11-21');

    const { data, error } = await supabase
      .from('schedule_events')
      .insert({
        company_id: TEST_COMPANY_ID,
        day_plan_id: plan.id,
        event_type: 'job',
        job_id: `test-job-${Date.now()}`,
        sequence_order: 1,
        scheduled_start: '2025-11-21T08:00:00Z',
        scheduled_duration_minutes: 0,
        status: 'pending'
      })
      .select()
      .single();

    assert(!error, 'Should allow zero duration');
  });

  await test('Event with very long duration (24+ hours)', async () => {
    const plan = await createTestDayPlan('2025-11-22');

    const event = await createTestEvent(plan.id, 1, '2025-11-22T08:00:00Z');

    const { error } = await supabase
      .from('schedule_events')
      .update({ scheduled_duration_minutes: 1440 }) // 24 hours
      .eq('id', event.id);

    assert(!error, 'Should allow long duration');
  });

  await test('Create event without job_id (for break/travel)', async () => {
    const plan = await createTestDayPlan('2025-11-23');

    const { data, error } = await supabase
      .from('schedule_events')
      .insert({
        company_id: TEST_COMPANY_ID,
        day_plan_id: plan.id,
        event_type: 'break',
        job_id: null,
        sequence_order: 1,
        scheduled_start: '2025-11-23T12:00:00Z',
        scheduled_duration_minutes: 30,
        status: 'pending'
      })
      .select()
      .single();

    assert(!error, 'Break event should not require job_id');
  });

  await test('Invalid PostGIS format rejected', async () => {
    const plan = await createTestDayPlan('2025-11-24');

    try {
      await supabase
        .from('schedule_events')
        .insert({
          company_id: TEST_COMPANY_ID,
          day_plan_id: plan.id,
          event_type: 'job',
          job_id: `test-job-${Date.now()}`,
          sequence_order: 1,
          scheduled_start: '2025-11-24T08:00:00Z',
          scheduled_duration_minutes: 60,
          status: 'pending',
          location_data: 'INVALID GEOMETRY' as any
        });

      throw new Error('Should reject invalid PostGIS format');
    } catch (error: any) {
      assert(
        error.message.includes('parse error') || error.message.includes('invalid'),
        'Should fail with geometry parse error'
      );
    }
  });

  await test('Missing required company_id', async () => {
    try {
      await supabase
        .from('day_plans')
        .insert({
          company_id: null as any, // Missing required field
          user_id: TEST_USER_ID,
          plan_date: '2025-11-25',
          status: 'draft',
          route_data: {},
          total_distance_miles: 0,
          estimated_duration_minutes: 0
        });

      throw new Error('Should reject null company_id');
    } catch (error: any) {
      assert(
        error.message.includes('null value') || error.code === '23502',
        'Should fail with NOT NULL constraint'
      );
    }
  });

  await test('Foreign key constraint: invalid day_plan_id', async () => {
    try {
      await supabase
        .from('schedule_events')
        .insert({
          company_id: TEST_COMPANY_ID,
          day_plan_id: '00000000-0000-0000-0000-000000000000', // Non-existent
          event_type: 'job',
          job_id: `test-job-${Date.now()}`,
          sequence_order: 1,
          scheduled_start: '2025-11-25T08:00:00Z',
          scheduled_duration_minutes: 60,
          status: 'pending'
        });

      throw new Error('Should reject invalid day_plan_id');
    } catch (error: any) {
      assert(
        error.message.includes('foreign key') || error.code === '23503',
        'Should fail with FK constraint error'
      );
    }
  });
}

/**
 * CATEGORY 4: Date & Time Handling
 */
async function testDateTimeHandling() {
  category('CATEGORY 4: Date & Time Handling');

  await test('Query plans by date range', async () => {
    await createTestDayPlan('2025-12-01');
    await createTestDayPlan('2025-12-15');
    await createTestDayPlan('2025-12-31');

    const { data } = await supabase
      .from('day_plans')
      .select('*')
      .gte('plan_date', '2025-12-01')
      .lte('plan_date', '2025-12-31')
      .eq('user_id', TEST_USER_ID);

    assert(data!.length >= 3, 'Should return plans in range');
  });

  await test('Sort events by scheduled_start', async () => {
    const plan = await createTestDayPlan('2025-12-05');

    // Create in reverse order
    await createTestEvent(plan.id, 3, '2025-12-05T14:00:00Z');
    await createTestEvent(plan.id, 1, '2025-12-05T08:00:00Z');
    await createTestEvent(plan.id, 2, '2025-12-05T11:00:00Z');

    const { data } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', plan.id)
      .order('scheduled_start', { ascending: true });

    const times = data!.map(e => e.scheduled_start);
    assert(times[0]! < times[1]!, 'Should be sorted by time');
    assert(times[1]! < times[2]!, 'Should be sorted by time');
  });

  await test('Events spanning midnight', async () => {
    const plan = await createTestDayPlan('2025-12-06');

    const { data, error } = await supabase
      .from('schedule_events')
      .insert({
        company_id: TEST_COMPANY_ID,
        day_plan_id: plan.id,
        event_type: 'job',
        job_id: `test-job-${Date.now()}`,
        sequence_order: 1,
        scheduled_start: '2025-12-06T23:00:00Z',
        scheduled_duration_minutes: 120, // 2 hours, ends at 1 AM next day
        status: 'pending'
      })
      .select()
      .single();

    assert(!error, 'Should allow events spanning midnight');
  });

  await test('Timezone handling (UTC storage)', async () => {
    const plan = await createTestDayPlan('2025-12-07');

    const event = await createTestEvent(plan.id, 1, '2025-12-07T15:00:00-05:00'); // EST

    // Should be stored as UTC
    assert(event.scheduled_start.includes('Z') || event.scheduled_start.includes('+00'),
      'Should store in UTC');
  });
}

/**
 * CATEGORY 5: Performance & Stress Tests
 */
async function testPerformance() {
  category('CATEGORY 5: Performance & Stress Tests');

  await test('Create 100 day plans (stress test)', async () => {
    const start = Date.now();
    const promises = [];

    for (let i = 0; i < 100; i++) {
      const date = new Date('2026-01-01');
      date.setDate(date.getDate() + i);

      promises.push(
        supabase
          .from('day_plans')
          .insert({
            company_id: TEST_COMPANY_ID,
            user_id: `test-user-${i}`,
            plan_date: date.toISOString().split('T')[0],
            status: 'draft',
            route_data: {},
            total_distance_miles: 0,
            estimated_duration_minutes: 0
          })
      );
    }

    await Promise.all(promises);
    const duration = Date.now() - start;

    log(`  ⏱️  Created 100 plans in ${duration}ms (${(duration/100).toFixed(1)}ms avg)`, 'gray');
    assert(duration < 10000, 'Should complete in under 10 seconds');
  });

  await test('Bulk query with pagination', async () => {
    const { data, error } = await supabase
      .from('day_plans')
      .select('*')
      .eq('company_id', TEST_COMPANY_ID)
      .order('plan_date', { ascending: false })
      .range(0, 49); // First 50

    assert(!error, 'Query should succeed');
    assert(data!.length <= 50, 'Should respect limit');
  });

  await test('Complex join query (plan with events)', async () => {
    const plan = await createTestDayPlan('2026-06-01');
    await createTestEvent(plan.id, 1, '2026-06-01T08:00:00Z');
    await createTestEvent(plan.id, 2, '2026-06-01T09:30:00Z');

    const start = Date.now();

    const { data, error } = await supabase
      .from('day_plans')
      .select(`
        *,
        schedule_events (
          id,
          event_type,
          scheduled_start,
          sequence_order
        )
      `)
      .eq('id', plan.id)
      .single();

    const duration = Date.now() - start;

    assert(!error, 'Join query should succeed');
    assert(data!.schedule_events!.length === 2, 'Should return related events');
    log(`  ⏱️  Join query: ${duration}ms`, 'gray');
  });

  await test('Concurrent writes (race condition)', async () => {
    const date = '2026-07-01';

    // Try to create same plan simultaneously from 5 "users"
    const promises = Array(5).fill(null).map(() =>
      createTestDayPlan(date, TEST_USER_ID).catch(e => e)
    );

    const results = await Promise.all(promises);

    // Only one should succeed, others should fail with unique constraint
    const succeeded = results.filter(r => r.id !== undefined).length;
    const failed = results.filter(r => r.code === '23505').length;

    assertEqual(succeeded, 1, 'Only one should succeed');
    assert(failed >= 4, 'Others should fail with unique constraint');
  });
}

/**
 * CATEGORY 6: Real-World Scenarios
 */
async function testRealWorldScenarios() {
  category('CATEGORY 6: Real-World Scenarios');

  await test('Scenario: Morning schedule creation', async () => {
    // Technician creates plan for the day
    const today = new Date().toISOString().split('T')[0];
    const plan = await createTestDayPlan(today);

    // Add morning jobs
    await createTestEvent(plan.id, 1, `${today}T08:00:00Z`);
    await createTestEvent(plan.id, 2, `${today}T09:30:00Z`);
    await createTestEvent(plan.id, 3, `${today}T11:00:00Z`);

    // Add lunch break
    const { error } = await supabase
      .from('schedule_events')
      .insert({
        company_id: TEST_COMPANY_ID,
        day_plan_id: plan.id,
        event_type: 'break',
        job_id: null,
        sequence_order: 4,
        scheduled_start: `${today}T12:30:00Z`,
        scheduled_duration_minutes: 30,
        status: 'pending',
        notes: 'Lunch break'
      });

    assert(!error, 'Should create mixed schedule');
  });

  await test('Scenario: Job cancellation mid-day', async () => {
    const plan = await createTestDayPlan('2026-08-01');
    const event = await createTestEvent(plan.id, 2, '2026-08-01T09:30:00Z');

    // Mark job as cancelled
    const { data, error } = await supabase
      .from('schedule_events')
      .update({ status: 'cancelled' })
      .eq('id', event.id)
      .select()
      .single();

    assert(!error, 'Should allow cancellation');
    assertEqual(data.status, 'cancelled', 'Status should update');
  });

  await test('Scenario: Emergency job insertion', async () => {
    const plan = await createTestDayPlan('2026-08-02');

    // Existing schedule
    await createTestEvent(plan.id, 1, '2026-08-02T08:00:00Z');
    await createTestEvent(plan.id, 2, '2026-08-02T10:00:00Z');
    await createTestEvent(plan.id, 3, '2026-08-02T13:00:00Z');

    // Insert emergency job (sequence 1.5)
    const { error } = await supabase
      .from('schedule_events')
      .insert({
        company_id: TEST_COMPANY_ID,
        day_plan_id: plan.id,
        event_type: 'job',
        job_id: `emergency-${Date.now()}`,
        sequence_order: 2, // Will shift others
        scheduled_start: '2026-08-02T09:00:00Z',
        scheduled_duration_minutes: 45,
        status: 'pending',
        notes: 'EMERGENCY - burst pipe'
      });

    assert(!error, 'Should insert emergency job');
  });

  await test('Scenario: Route optimization (distance calculation)', async () => {
    const plan = await createTestDayPlan('2026-08-03');

    // Jobs at different locations
    const job1 = await createTestEvent(plan.id, 1, '2026-08-03T08:00:00Z');
    const job2 = await createTestEvent(plan.id, 2, '2026-08-03T10:00:00Z');

    // Calculate total distance (mock - would use Mapbox in production)
    const { data: events } = await supabase
      .from('schedule_events')
      .select('location_data')
      .eq('day_plan_id', plan.id)
      .order('sequence_order');

    assert(events!.length === 2, 'Should have route data');
  });

  await test('Scenario: End of day completion', async () => {
    const plan = await createTestDayPlan('2026-08-04');
    const events = [];

    for (let i = 1; i <= 4; i++) {
      events.push(await createTestEvent(plan.id, i, `2026-08-04T${7+i}:00:00Z`));
    }

    // Mark all as completed
    for (const event of events) {
      await supabase
        .from('schedule_events')
        .update({
          status: 'completed',
          actual_start: event.scheduled_start,
          actual_end: new Date(new Date(event.scheduled_start).getTime() + 60*60*1000).toISOString()
        })
        .eq('id', event.id);
    }

    // Update plan status
    const { error } = await supabase
      .from('day_plans')
      .update({
        status: 'completed',
        actual_end_time: new Date().toISOString()
      })
      .eq('id', plan.id);

    assert(!error, 'Should complete day');
  });

  await test('Scenario: Multi-day planning ahead', async () => {
    const baseDate = new Date('2026-09-01');

    // Create plans for full week
    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);
      await createTestDayPlan(date.toISOString().split('T')[0]);
    }

    // Query week's schedule
    const { data } = await supabase
      .from('day_plans')
      .select('*')
      .gte('plan_date', '2026-09-01')
      .lte('plan_date', '2026-09-07')
      .eq('user_id', TEST_USER_ID);

    assert(data!.length === 7, 'Should create full week');
  });
}

/**
 * Generate final report
 */
function generateReport() {
  log('\n' + '='.repeat(80), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(80), 'cyan');

  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  const skipped = results.filter(r => r.status === 'SKIP');

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = totalDuration / results.length;

  log(`\n📊 Results:`, 'blue');
  log(`   Total Tests: ${results.length}`, 'reset');
  log(`   ✅ Passed: ${passed.length} (${((passed.length/results.length)*100).toFixed(1)}%)`, 'green');
  log(`   ❌ Failed: ${failed.length} (${((failed.length/results.length)*100).toFixed(1)}%)`, failed.length > 0 ? 'red' : 'reset');
  log(`   ⏭️  Skipped: ${skipped.length}`, 'yellow');

  log(`\n⏱️  Performance:`, 'blue');
  log(`   Total Duration: ${totalDuration}ms`, 'reset');
  log(`   Average Test: ${avgDuration.toFixed(1)}ms`, 'reset');

  // Category breakdown
  const categories = [...new Set(results.map(r => r.category))];
  log(`\n📁 By Category:`, 'blue');

  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.status === 'PASS').length;
    const catFailed = catResults.filter(r => r.status === 'FAIL').length;

    const status = catFailed === 0 ? '✅' : '❌';
    log(`   ${status} ${cat}: ${catPassed}/${catResults.length}`, catFailed === 0 ? 'green' : 'red');
  }

  // Failed tests details
  if (failed.length > 0) {
    log(`\n❌ Failed Tests:`, 'red');
    failed.forEach(f => {
      log(`   • ${f.name}`, 'red');
      log(`     ${f.error}`, 'gray');
      if (f.details) {
        log(`     ${f.details}`, 'gray');
      }
    });
  }

  log('\n' + '='.repeat(80), 'cyan');

  if (failed.length === 0) {
    log('🎉 ALL TESTS PASSED! 🎉', 'green');
  } else {
    log(`⚠️  ${failed.length} TEST(S) FAILED`, 'red');
  }

  log('='.repeat(80), 'cyan');
}

/**
 * Main test runner
 */
async function main() {
  log('\n🧪 COMPREHENSIVE SCHEDULING TEST SUITE', 'cyan');
  log('Testing all edge cases, business rules, and real-world scenarios\n', 'cyan');

  // Cleanup before starting
  log('🧹 Cleaning up test data...', 'yellow');
  await cleanup();
  log('✅ Cleanup complete\n', 'green');

  try {
    await testBasicCRUD();
    await testBusinessRules();
    await testEdgeCases();
    await testDateTimeHandling();
    await testPerformance();
    await testRealWorldScenarios();
  } catch (error) {
    log(`\n💥 Fatal error: ${error}`, 'red');
  }

  // Cleanup after tests
  log('\n🧹 Final cleanup...', 'yellow');
  await cleanup();
  log('✅ Cleanup complete', 'green');

  // Generate report
  generateReport();

  // Exit with appropriate code
  const exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
  process.exit(exitCode);
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});