/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/services/scheduling.service.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Core scheduling service for managing events and enforcing limits
 * spec_ref: .specify/features/003-scheduling-kits/specs/backend-scheduling.md
 * complexity_budget: 300
 * state_machine: none
 * estimated_llm_cost: 0.02
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - /src/scheduling/repositories/schedule-event.repository.ts
 *     - /src/scheduling/repositories/day-plan.repository.ts
 *     - /src/scheduling/services/day-plan-validation.service.ts
 *     - /src/scheduling/services/notification.service.ts
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - SchedulingService
 * voice_considerations:
 *   - Provide clear voice feedback on job limits
 *   - Return voice-friendly error messages
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/integration/job-limit-enforcement.test.ts
 * tasks:
 *   - T030: Implement scheduleEvent with job limit checking
 *   - Handle supervisor notifications
 *   - Support offline queueing
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { ScheduleEventRepository } from '../repositories/schedule-event.repository';
import { DayPlanRepository } from '../repositories/day-plan.repository';
import type { DayPlanValidationService } from './day-plan-validation.service';
import type { NotificationService } from './notification.service';

type Tables = Database['public']['Tables'];
type ScheduleEventInsert = Tables['schedule_events']['Insert'];
type ScheduleEvent = Tables['schedule_events']['Row'];

interface ScheduleEventInput extends Omit<ScheduleEventInsert, 'tenant_id' | 'id' | 'created_at' | 'updated_at'> {
  day_plan_id: string;
}

export class SchedulingService {
  private scheduleEventRepo: ScheduleEventRepository;
  private dayPlanRepo: DayPlanRepository;

  constructor(
    private supabase: SupabaseClient,
    private validationService: DayPlanValidationService,
    private notificationService: NotificationService
  ) {
    this.scheduleEventRepo = new ScheduleEventRepository(supabase);
    this.dayPlanRepo = new DayPlanRepository(supabase);
  }

  async scheduleEvent(input: ScheduleEventInput): Promise<ScheduleEvent> {
    // Get the day plan to find the user
    const dayPlan = await this.dayPlanRepo.findById(input.day_plan_id);
    if (!dayPlan) {
      throw new Error('Day plan not found');
    }

    // If it's a job event, check limits
    if (input.event_type === 'job') {
      await this.checkJobLimits(input.day_plan_id, dayPlan.user_id);
    }

    // Create the event
    const event = await this.scheduleEventRepo.create({
      ...input,
      tenant_id: dayPlan.tenant_id
    });

    // Check if we need to send notifications
    if (input.event_type === 'job') {
      await this.checkAndSendNotifications(input.day_plan_id, dayPlan.user_id);
    }

    return event;
  }

  private async checkJobLimits(dayPlanId: string, userId: string): Promise<void> {
    // Get current job count
    const events = await this.scheduleEventRepo.findByDayPlan(dayPlanId);
    const jobCount = events.filter(e => e.event_type === 'job').length;

    // Get the limit (company-specific or default)
    const limit = await this.validationService.getCompanyJobLimit();

    if (jobCount >= limit) {
      throw new Error(`Cannot add job: maximum of ${limit} jobs per technician per day`);
    }
  }

  private async checkAndSendNotifications(dayPlanId: string, technicianId: string): Promise<void> {
    // Get current job count
    const events = await this.scheduleEventRepo.findByDayPlan(dayPlanId);
    const jobCount = events.filter(e => e.event_type === 'job').length;
    
    // Get the limit
    const limit = await this.validationService.getCompanyJobLimit();

    // Find supervisor (mock for now - should come from user/role service)
    const supervisorId = '456e4567-e89b-12d3-a456-426614174000';

    // Send warning at limit - 1
    if (jobCount === limit - 1) {
      await this.notificationService.sendNotification({
        recipient_id: supervisorId,
        type: 'job_limit_warning',
        priority: 'medium',
        message: `Technician ${technicianId} has ${jobCount} of ${limit} jobs scheduled`,
        data: {
          technician_id: technicianId,
          day_plan_id: dayPlanId,
          current_job_count: jobCount,
          max_jobs: limit
        }
      });
    }

    // Send alert at limit
    if (jobCount === limit) {
      await this.notificationService.sendNotification({
        recipient_id: supervisorId,
        type: 'job_limit_reached',
        priority: 'high',
        message: `Technician ${technicianId} has reached maximum job capacity`,
        data: {
          technician_id: technicianId,
          day_plan_id: dayPlanId,
          current_job_count: jobCount
        }
      });
    }
  }

  async updateEvent(id: string, updates: Partial<ScheduleEventInput>): Promise<ScheduleEvent> {
    // Get existing event to check if we're changing event type
    const existing = await this.scheduleEventRepo.findById(id);
    if (!existing) {
      throw new Error('Schedule event not found');
    }

    // If changing to job or was job, need to recheck limits
    if ((updates.event_type === 'job' && existing.event_type !== 'job') ||
        (existing.event_type === 'job' && updates.event_type !== 'job')) {
      
      // Get day plan
      const dayPlan = await this.dayPlanRepo.findById(existing.day_plan_id);
      if (!dayPlan) {
        throw new Error('Day plan not found');
      }

      // Check if changing to job would exceed limit
      if (updates.event_type === 'job' && existing.event_type !== 'job') {
        await this.checkJobLimits(existing.day_plan_id, dayPlan.user_id);
      }
    }

    return await this.scheduleEventRepo.update(id, updates);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.scheduleEventRepo.delete(id);
  }

  async getEventsByDayPlan(dayPlanId: string): Promise<ScheduleEvent[]> {
    return await this.scheduleEventRepo.findByDayPlan(dayPlanId);
  }

  async resequenceEvents(dayPlanId: string, eventSequence: Array<{ id: string; sequence_order: number }>): Promise<void> {
    // Update each event's sequence
    for (const { id, sequence_order } of eventSequence) {
      await this.scheduleEventRepo.update(id, { sequence_order });
    }
  }
}