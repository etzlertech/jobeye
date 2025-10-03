/**
 * @file /src/__tests__/scheduling/integration/job-limit-enforcement.test.ts
 * @purpose Integration test: Enforce 6-job maximum per technician
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// These will fail with "Cannot find module" - as expected for TDD
import { DayPlanService } from '@/scheduling/services/day-plan.service';
import { SchedulingService } from '@/scheduling/services/scheduling.service';
import { DayPlanValidationService } from '@/scheduling/services/day-plan-validation.service';
import { NotificationService } from '@/scheduling/services/notification.service';
import type { Database } from '@/types/supabase';

describe('Job Limit Enforcement', () => {
  let supabase: SupabaseClient<Database>;
  let dayPlanService: DayPlanService;
  let schedulingService: SchedulingService;
  let validationService: DayPlanValidationService;
  let notificationService: NotificationService;
  
  const testCompanyId = '00000000-0000-4000-a000-000000000003';
  const technicianId = '123e4567-e89b-12d3-a456-426614174000';
  const supervisorId = '456e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: { 'x-company-id': testCompanyId }
        }
      }
    );

    validationService = new DayPlanValidationService(supabase);
    notificationService = new NotificationService(supabase);
    schedulingService = new SchedulingService(supabase, validationService, notificationService);
    dayPlanService = new DayPlanService(supabase, schedulingService, validationService);
  });

  afterEach(async () => {
    // Cleanup test data
    await supabase
      .from('day_plans')
      .delete()
      .eq('tenant_id', testCompanyId)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());
  });

  it('should enforce 6 job maximum when creating day plan', async () => {
    // Try to create day plan with 7 jobs
    const jobSchedules = Array.from({ length: 7 }, (_, i) => ({
      event_type: 'job' as const,
      job_id: `job-${i + 1}`,
      sequence_order: i + 1,
      scheduled_start: `2024-01-15T${9 + i}:00:00Z`,
      scheduled_duration_minutes: 45
    }));

    await expect(
      dayPlanService.createDayPlan({
        user_id: technicianId,
        plan_date: '2024-01-15',
        schedule_events: jobSchedules
      })
    ).rejects.toThrow(/maximum of 6 jobs per technician per day/);

    // Should work with exactly 6 jobs
    const sixJobs = jobSchedules.slice(0, 6);
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15',
      schedule_events: sixJobs
    });

    expect(dayPlan).toBeDefined();
    
    // Verify events were created
    const { data: events } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlan.id)
      .eq('event_type', 'job');

    expect(events).toHaveLength(6);
  });

  it('should prevent adding 7th job to existing plan', async () => {
    // Create plan with 5 jobs
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    // Add 5 jobs
    for (let i = 0; i < 5; i++) {
      await schedulingService.scheduleEvent({
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: `job-${i + 1}`,
        sequence_order: i + 1,
        scheduled_start: `2024-01-15T${9 + i}:00:00Z`,
        scheduled_duration_minutes: 60
      });
    }

    // 6th job should succeed
    const sixthJob = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-6',
      sequence_order: 6,
      scheduled_start: '2024-01-15T14:00:00Z',
      scheduled_duration_minutes: 60
    });

    expect(sixthJob).toBeDefined();

    // 7th job should fail
    await expect(
      schedulingService.scheduleEvent({
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: 'job-7',
        sequence_order: 7,
        scheduled_start: '2024-01-15T15:00:00Z',
        scheduled_duration_minutes: 60
      })
    ).rejects.toThrow(/maximum of 6 jobs/);
  });

  it('should alert supervisor when approaching limit', async () => {
    const notificationSpy = jest.spyOn(notificationService, 'sendNotification');

    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    // Add jobs one by one
    for (let i = 0; i < 5; i++) {
      await schedulingService.scheduleEvent({
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: `job-${i + 1}`,
        sequence_order: i + 1,
        scheduled_start: `2024-01-15T${9 + i}:00:00Z`,
        scheduled_duration_minutes: 60
      });
    }

    // 5th job (approaching limit) should trigger alert
    expect(notificationSpy).toHaveBeenCalledWith({
      recipient_id: supervisorId,
      type: 'job_limit_warning',
      priority: 'medium',
      message: expect.stringContaining('5 of 6 jobs'),
      message: expect.stringContaining(technicianId),
      data: {
        technician_id: technicianId,
        day_plan_id: dayPlan.id,
        current_job_count: 5,
        max_jobs: 6
      }
    });

    // Add 6th job (at limit)
    await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-6',
      sequence_order: 6,
      scheduled_start: '2024-01-15T14:00:00Z',
      scheduled_duration_minutes: 60
    });

    // Should send "at limit" notification
    expect(notificationSpy).toHaveBeenCalledWith({
      recipient_id: supervisorId,
      type: 'job_limit_reached',
      priority: 'high',
      message: expect.stringContaining('reached maximum'),
      data: {
        technician_id: technicianId,
        day_plan_id: dayPlan.id,
        current_job_count: 6
      }
    });
  });

  it('should not count non-job events toward limit', async () => {
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    // Add 6 jobs
    for (let i = 0; i < 6; i++) {
      await schedulingService.scheduleEvent({
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: `job-${i + 1}`,
        sequence_order: i * 2 + 1,
        scheduled_start: `2024-01-15T${9 + i}:00:00Z`,
        scheduled_duration_minutes: 45
      });
    }

    // Should still be able to add breaks
    const breakEvent = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'break',
      sequence_order: 4,
      scheduled_start: '2024-01-15T12:00:00Z',
      scheduled_duration_minutes: 30,
      notes: 'Lunch break'
    });

    expect(breakEvent).toBeDefined();

    // And travel time
    const travelEvent = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'travel',
      sequence_order: 2,
      scheduled_start: '2024-01-15T09:45:00Z',
      scheduled_duration_minutes: 15
    });

    expect(travelEvent).toBeDefined();

    // Verify total events
    const { data: allEvents } = await supabase
      .from('schedule_events')
      .select('event_type')
      .eq('day_plan_id', dayPlan.id);

    expect(allEvents).toHaveLength(8); // 6 jobs + 1 break + 1 travel
    expect(allEvents!.filter(e => e.event_type === 'job')).toHaveLength(6);
  });

  it('should handle multi-technician job limits independently', async () => {
    const technician2Id = '789e4567-e89b-12d3-a456-426614174000';

    // Create plans for two technicians
    const plan1 = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    const plan2 = await dayPlanService.createDayPlan({
      user_id: technician2Id,
      plan_date: '2024-01-15'
    });

    // Add 6 jobs to technician 1
    for (let i = 0; i < 6; i++) {
      await schedulingService.scheduleEvent({
        day_plan_id: plan1.id,
        event_type: 'job',
        job_id: `tech1-job-${i + 1}`,
        sequence_order: i + 1,
        scheduled_start: `2024-01-15T${9 + i}:00:00Z`,
        scheduled_duration_minutes: 45
      });
    }

    // Technician 2 should still be able to add jobs
    const tech2Job = await schedulingService.scheduleEvent({
      day_plan_id: plan2.id,
      event_type: 'job',
      job_id: 'tech2-job-1',
      sequence_order: 1,
      scheduled_start: '2024-01-15T09:00:00Z',
      scheduled_duration_minutes: 60
    });

    expect(tech2Job).toBeDefined();

    // But technician 1 cannot add more
    await expect(
      schedulingService.scheduleEvent({
        day_plan_id: plan1.id,
        event_type: 'job',
        job_id: 'tech1-job-7',
        sequence_order: 7,
        scheduled_start: '2024-01-15T15:00:00Z',
        scheduled_duration_minutes: 60
      })
    ).rejects.toThrow(/maximum of 6 jobs/);
  });

  it('should respect company-specific job limits', async () => {
    // Mock company settings with custom limit
    jest.spyOn(validationService, 'getCompanyJobLimit')
      .mockResolvedValue(4); // Lower limit

    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    // Add 4 jobs (company limit)
    for (let i = 0; i < 4; i++) {
      await schedulingService.scheduleEvent({
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: `job-${i + 1}`,
        sequence_order: i + 1,
        scheduled_start: `2024-01-15T${9 + i}:00:00Z`,
        scheduled_duration_minutes: 60
      });
    }

    // 5th job should fail (even though default is 6)
    await expect(
      schedulingService.scheduleEvent({
        day_plan_id: dayPlan.id,
        event_type: 'job',
        job_id: 'job-5',
        sequence_order: 5,
        scheduled_start: '2024-01-15T13:00:00Z',
        scheduled_duration_minutes: 60
      })
    ).rejects.toThrow(/maximum of 4 jobs/); // Company-specific message
  });
});