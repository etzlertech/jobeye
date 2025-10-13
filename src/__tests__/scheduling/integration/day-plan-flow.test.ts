/**
 * @file /src/__tests__/scheduling/integration/day-plan-flow.test.ts
 * @purpose Integration test: Create and optimize day plan
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// These will fail with "Cannot find module" - as expected for TDD
import { DayPlanRepository } from '@/scheduling/repositories/day-plan.repository';
import { ScheduleEventRepository } from '@/scheduling/repositories/schedule-event.repository';
import { DayPlanService } from '@/scheduling/services/day-plan.service';
import { RouteOptimizationService } from '@/scheduling/services/route-optimization.service';
import type { Database } from '@/types/database';

describe('Day Plan Flow Integration', () => {
  let supabase: SupabaseClient<Database>;
  let dayPlanRepo: DayPlanRepository;
  let scheduleEventRepo: ScheduleEventRepository;
  let dayPlanService: DayPlanService;
  let routeOptimizationService: RouteOptimizationService;
  
  const testCompanyId = '00000000-0000-4000-a000-000000000003';
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    // Setup test client with company context
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        },
        global: {
          headers: {
            'x-company-id': testCompanyId
          }
        }
      }
    );

    // Initialize repositories and services
    dayPlanRepo = new DayPlanRepository(supabase);
    scheduleEventRepo = new ScheduleEventRepository(supabase);
    routeOptimizationService = new RouteOptimizationService({ 
      mapboxToken: process.env.MAPBOX_ACCESS_TOKEN 
    });
    dayPlanService = new DayPlanService(
      dayPlanRepo,
      scheduleEventRepo,
      routeOptimizationService
    );
  });

  afterEach(async () => {
    // Cleanup test data
    await supabase
      .from('day_plans')
      .delete()
      .eq('tenant_id', testCompanyId)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());
  });

  it('should create a day plan with multiple jobs and optimize route', async () => {
    // Step 1: Create day plan
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: testUserId,
      plan_date: '2024-01-15',
      initial_stops: [
        {
          address: '123 Main St, New York, NY 10001',
          lat: 40.7128,
          lng: -74.0060,
          job_id: 'job-001'
        },
        {
          address: '456 Park Ave, New York, NY 10022',
          lat: 40.7580,
          lng: -73.9855,
          job_id: 'job-002'
        },
        {
          address: '789 Broadway, New York, NY 10003',
          lat: 40.7314,
          lng: -73.9892,
          job_id: 'job-003'
        }
      ]
    });

    expect(dayPlan).toMatchObject({
      id: expect.any(String),
      user_id: testUserId,
      plan_date: '2024-01-15',
      status: 'draft',
      tenant_id: testCompanyId
    });

    // Step 2: Create schedule events for jobs
    const events = await Promise.all([
      scheduleEventRepo.create({
        tenant_id: testCompanyId,
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: 'job-001',
        sequence_order: 1,
        scheduled_start: '2024-01-15T09:00:00Z',
        scheduled_duration_minutes: 60,
        location_data: { type: 'Point', coordinates: [-74.0060, 40.7128] },
        address: { street: '123 Main St' }
      }),
      scheduleEventRepo.create({
        tenant_id: testCompanyId,
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: 'job-002',
        sequence_order: 2,
        scheduled_start: '2024-01-15T10:30:00Z',
        scheduled_duration_minutes: 45,
        location_data: { type: 'Point', coordinates: [-73.9855, 40.7580] },
        address: { street: '456 Park Ave' }
      }),
      scheduleEventRepo.create({
        tenant_id: testCompanyId,
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: 'job-003',
        sequence_order: 3,
        scheduled_start: '2024-01-15T11:45:00Z',
        scheduled_duration_minutes: 90,
        location_data: { type: 'Point', coordinates: [-73.9892, 40.7314] },
        address: { street: '789 Broadway' }
      })
    ]);

    expect(events).toHaveLength(3);

    // Step 3: Optimize the route
    const optimizedPlan = await dayPlanService.optimizeRoute(dayPlan.id, {
      optimization_mode: 'time',
      include_breaks: true
    });

    expect(optimizedPlan.route_data).toMatchObject({
      optimized: true,
      optimization_mode: 'time',
      stops: expect.arrayContaining([
        expect.objectContaining({
          job_id: expect.any(String),
          sequence: expect.any(Number),
          arrival_time: expect.any(String),
          travel_time_minutes: expect.any(Number)
        })
      ])
    });

    // Verify breaks were added
    const updatedEvents = await scheduleEventRepo.findByDayPlanId(dayPlan.id);
    const breakEvents = updatedEvents.filter(e => e.event_type === 'break');
    expect(breakEvents.length).toBeGreaterThan(0);

    // Step 4: Publish the plan
    const publishedPlan = await dayPlanService.updateStatus(dayPlan.id, 'published');
    expect(publishedPlan.status).toBe('published');
  });

  it('should enforce 6 job maximum per day', async () => {
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: testUserId,
      plan_date: '2024-01-15'
    });

    // Try to add 7 jobs
    const jobPromises = Array.from({ length: 7 }, (_, i) => 
      scheduleEventRepo.create({
        tenant_id: testCompanyId,
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: `job-${i + 1}`,
        sequence_order: i + 1,
        scheduled_start: `2024-01-15T${9 + i}:00:00Z`,
        scheduled_duration_minutes: 45
      })
    );

    await expect(Promise.all(jobPromises)).rejects.toThrow(/maximum of 6 jobs/);
  });

  it('should handle offline mode optimization', async () => {
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: testUserId,
      plan_date: '2024-01-15'
    });

    // Create events
    await scheduleEventRepo.create({
      tenant_id: testCompanyId,
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-001',
      sequence_order: 1,
      scheduled_start: '2024-01-15T09:00:00Z',
      scheduled_duration_minutes: 60,
      location_data: { type: 'Point', coordinates: [-74.0060, 40.7128] }
    });

    // Optimize in offline mode
    const optimizedPlan = await dayPlanService.optimizeRoute(dayPlan.id, {
      offline_mode: true
    });

    expect(optimizedPlan.route_data).toMatchObject({
      optimized: true,
      optimization_method: 'offline',
      algorithm: expect.stringMatching(/nearest_neighbor|2_opt/)
    });
  });

  it('should re-optimize after job completion', async () => {
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: testUserId,
      plan_date: '2024-01-15'
    });

    // Create initial events
    const event1 = await scheduleEventRepo.create({
      tenant_id: testCompanyId,
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-001',
      sequence_order: 1,
      scheduled_start: '2024-01-15T09:00:00Z',
      scheduled_duration_minutes: 60
    });

    const event2 = await scheduleEventRepo.create({
      tenant_id: testCompanyId,
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-002',
      sequence_order: 2,
      scheduled_start: '2024-01-15T10:30:00Z',
      scheduled_duration_minutes: 45
    });

    // Complete first job
    await scheduleEventRepo.update(event1.id, {
      status: 'completed',
      actual_start: '2024-01-15T09:00:00Z',
      actual_end: '2024-01-15T09:45:00Z'
    });

    // Re-optimize based on current location
    const reOptimizedPlan = await dayPlanService.optimizeRoute(dayPlan.id, {
      trigger: 'job_completed',
      completed_event_id: event1.id,
      current_location: {
        lat: 40.7128,
        lng: -74.0060
      }
    });

    expect(reOptimizedPlan.route_data).toMatchObject({
      re_optimized_at: expect.any(String),
      trigger: 'job_completed'
    });
  });
});