/**
 * @file /src/__tests__/scheduling/integration/break-warning.test.ts
 * @purpose Integration test: Break warning after 4 hours
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addHours, addMinutes } from 'date-fns';

// These will fail with "Cannot find module" - as expected for TDD
import { DayPlanService } from '@/scheduling/services/day-plan.service';
import { SchedulingService } from '@/scheduling/services/scheduling.service';
import { BreakSchedulerService } from '@/scheduling/services/break-scheduler.service';
import { NotificationService } from '@/scheduling/services/notification.service';
import { LaborRuleService } from '@/scheduling/services/labor-rule.service';
import type { Database } from '@/types/database';

describe('Break Warning System', () => {
  let supabase: SupabaseClient;
  let dayPlanService: DayPlanService;
  let schedulingService: SchedulingService;
  let breakScheduler: BreakSchedulerService;
  let notificationService: NotificationService;
  let laborRuleService: LaborRuleService;
  
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

    // Initialize services
    laborRuleService = new LaborRuleService(supabase);
    notificationService = new NotificationService(supabase);
    breakScheduler = new BreakSchedulerService(laborRuleService, notificationService);
    schedulingService = new SchedulingService(supabase, breakScheduler);
    dayPlanService = new DayPlanService(supabase, schedulingService);

    // Mock current time for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T08:00:00Z'));
  });

  afterEach(async () => {
    jest.useRealTimers();
    // Cleanup
    await supabase
      .from('day_plans')
      .delete()
      .eq('tenant_id', testCompanyId)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString());
  });

  it('should auto-insert breaks in day plan', async () => {
    // Create day plan with jobs spanning more than 4 hours
    const startTime = new Date('2024-01-15T08:00:00Z');
    
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15',
      auto_schedule_breaks: true,
      schedule_events: [
        {
          event_type: 'job',
          job_id: 'job-1',
          scheduled_start: startTime.toISOString(),
          scheduled_duration_minutes: 90
        },
        {
          event_type: 'job',
          job_id: 'job-2',
          scheduled_start: addMinutes(startTime, 100).toISOString(),
          scheduled_duration_minutes: 60
        },
        {
          event_type: 'job',
          job_id: 'job-3',
          scheduled_start: addMinutes(startTime, 170).toISOString(),
          scheduled_duration_minutes: 120
        },
        {
          event_type: 'job',
          job_id: 'job-4',
          scheduled_start: addMinutes(startTime, 300).toISOString(),
          scheduled_duration_minutes: 60
        }
      ]
    });

    // Verify breaks were inserted
    const { data: events } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlan.id)
      .order('scheduled_start');

    const breaks = events!.filter(e => e.event_type === 'break');
    
    // Should have at least 2 breaks (15-min after 4 hours, 30-min meal after 6 hours)
    expect(breaks.length).toBeGreaterThanOrEqual(2);

    // First break should be around 4 hours from start
    const firstBreak = breaks[0];
    const timeSinceStart = (new Date(firstBreak.scheduled_start).getTime() - startTime.getTime()) / (1000 * 60 * 60);
    expect(timeSinceStart).toBeGreaterThanOrEqual(3.5);
    expect(timeSinceStart).toBeLessThanOrEqual(4.5);
    expect(firstBreak.scheduled_duration_minutes).toBe(15);

    // Meal break for shifts > 6 hours
    const mealBreak = breaks.find(b => b.scheduled_duration_minutes === 30);
    expect(mealBreak).toBeDefined();
  });

  it('should warn when technician works 4 hours without break', async () => {
    const notificationSpy = jest.spyOn(notificationService, 'sendNotification');

    // Create day plan
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15',
      auto_schedule_breaks: false // Manual break scheduling
    });

    // Start first job
    const job1 = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-1',
      scheduled_start: '2024-01-15T08:00:00Z',
      scheduled_duration_minutes: 120
    });

    await schedulingService.updateEventStatus(job1.id, {
      status: 'in_progress',
      actual_start: '2024-01-15T08:00:00Z'
    });

    // Complete first job
    jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    await schedulingService.updateEventStatus(job1.id, {
      status: 'completed',
      actual_end: '2024-01-15T10:00:00Z'
    });

    // Start second job
    const job2 = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-2',
      scheduled_start: '2024-01-15T10:00:00Z',
      scheduled_duration_minutes: 120
    });

    await schedulingService.updateEventStatus(job2.id, {
      status: 'in_progress',
      actual_start: '2024-01-15T10:00:00Z'
    });

    // Advance time to 4 hours without break
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    
    // Check for break violations
    await breakScheduler.checkBreakCompliance(dayPlan.id);

    // Should send warning
    expect(notificationSpy).toHaveBeenCalledWith({
      recipient_id: technicianId,
      type: 'break_warning',
      priority: 'high',
      message: expect.stringContaining('4 hours without a break'),
      data: {
        day_plan_id: dayPlan.id,
        hours_worked: 4,
        last_break: null
      }
    });

    // Also notify supervisor
    expect(notificationSpy).toHaveBeenCalledWith({
      recipient_id: supervisorId,
      type: 'break_violation',
      priority: 'high',
      message: expect.stringContaining(`Technician ${technicianId}`),
      message: expect.stringContaining('4 hours without break'),
      data: {
        technician_id: technicianId,
        day_plan_id: dayPlan.id
      }
    });
  });

  it('should track break compliance correctly', async () => {
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    // Work 3 hours
    const job1 = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-1',
      scheduled_start: '2024-01-15T08:00:00Z',
      scheduled_duration_minutes: 180
    });

    await schedulingService.updateEventStatus(job1.id, {
      status: 'completed',
      actual_start: '2024-01-15T08:00:00Z',
      actual_end: '2024-01-15T11:00:00Z'
    });

    // Take a break
    const break1 = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'break',
      scheduled_start: '2024-01-15T11:00:00Z',
      scheduled_duration_minutes: 15
    });

    await schedulingService.updateEventStatus(break1.id, {
      status: 'completed',
      actual_start: '2024-01-15T11:00:00Z',
      actual_end: '2024-01-15T11:15:00Z'
    });

    // Work another 3 hours
    const job2 = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-2',
      scheduled_start: '2024-01-15T11:15:00Z',
      scheduled_duration_minutes: 180
    });

    jest.setSystemTime(new Date('2024-01-15T14:15:00Z'));
    
    // Check compliance - should be OK
    const compliance = await breakScheduler.getBreakCompliance(dayPlan.id);
    
    expect(compliance).toMatchObject({
      compliant: true,
      total_work_hours: 6,
      breaks_taken: 1,
      break_minutes: 15,
      last_break_at: '2024-01-15T11:00:00Z',
      hours_since_break: 3
    });
  });

  it('should not allow skipping required breaks without override', async () => {
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15'
    });

    // Schedule a required break
    const breakEvent = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'break',
      scheduled_start: '2024-01-15T12:00:00Z',
      scheduled_duration_minutes: 15,
      metadata: { required: true, break_type: 'mandatory_15min' }
    });

    // Try to skip it
    await expect(
      schedulingService.updateEventStatus(breakEvent.id, {
        status: 'cancelled',
        notes: 'Too busy'
      })
    ).rejects.toThrow(/Required breaks cannot be skipped/);

    // Should work with supervisor override
    const overrideResult = await schedulingService.updateEventStatus(breakEvent.id, {
      status: 'cancelled',
      notes: 'Emergency job requirement',
      supervisor_override: {
        supervisor_id: supervisorId,
        reason: 'Critical customer emergency'
      }
    });

    expect(overrideResult).toMatchObject({
      status: 'cancelled',
      metadata: expect.objectContaining({
        supervisor_override: true,
        override_reason: 'Critical customer emergency'
      })
    });
  });

  it('should handle state-specific labor rules', async () => {
    // Mock California labor rules (more strict)
    jest.spyOn(laborRuleService, 'getCompanyLaborRules')
      .mockResolvedValue({
        state: 'CA',
        breaks: {
          rest_break_interval: 4, // Every 4 hours
          rest_break_duration: 10, // 10 minutes minimum
          meal_break_threshold: 5, // Meal break after 5 hours
          meal_break_duration: 30,
          meal_break_deadline: 5 // Must start before 5th hour
        }
      });

    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15',
      auto_schedule_breaks: true,
      schedule_events: [
        {
          event_type: 'job',
          job_id: 'job-1',
          scheduled_start: '2024-01-15T08:00:00Z',
          scheduled_duration_minutes: 300 // 5 hours
        }
      ]
    });

    const { data: events } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlan.id)
      .order('scheduled_start');

    const breaks = events!.filter(e => e.event_type === 'break');
    const mealBreak = breaks.find(b => b.scheduled_duration_minutes >= 30);

    // Meal break must start before 5th hour
    expect(mealBreak).toBeDefined();
    const mealBreakStart = new Date(mealBreak!.scheduled_start);
    const workStart = new Date('2024-01-15T08:00:00Z');
    const hoursUntilMeal = (mealBreakStart.getTime() - workStart.getTime()) / (1000 * 60 * 60);
    
    expect(hoursUntilMeal).toBeLessThan(5);
  });

  it('should generate break compliance report', async () => {
    // Create day plans with various compliance levels
    const compliantPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15',
      auto_schedule_breaks: true
    });

    // Simulate day with proper breaks
    // ... (implementation details)

    const report = await breakScheduler.generateComplianceReport({
      tenant_id: testCompanyId,
      start_date: '2024-01-15',
      end_date: '2024-01-15'
    });

    expect(report).toMatchObject({
      total_days: 1,
      compliant_days: 1,
      violations: [],
      summary: {
        compliance_rate: 1.0,
        average_breaks_per_day: expect.any(Number),
        average_break_duration: expect.any(Number)
      }
    });
  });

  it('should handle voice-initiated break requests', async () => {
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: technicianId,
      plan_date: '2024-01-15',
      status: 'in_progress'
    });

    // Voice command to take break
    const breakRequest = await schedulingService.handleVoiceBreakRequest({
      day_plan_id: dayPlan.id,
      user_id: technicianId,
      voice_transcript: 'Take a 15 minute break',
      requested_at: '2024-01-15T10:00:00Z'
    });

    expect(breakRequest).toMatchObject({
      event_type: 'break',
      scheduled_start: '2024-01-15T10:00:00Z',
      scheduled_duration_minutes: 15,
      status: 'in_progress',
      voice_notes: 'Take a 15 minute break',
      metadata: {
        voice_initiated: true,
        auto_approved: true
      }
    });

    // Verify break is tracked
    const compliance = await breakScheduler.getBreakCompliance(dayPlan.id);
    expect(compliance.current_break).toBeDefined();
  });
});