/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/services/day-plan-validation.service.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Validates day plans and enforces business rules
 * spec_ref: .specify/features/003-scheduling-kits/specs/backend-scheduling.md
 * complexity_budget: 200
 * state_machine: none
 * estimated_llm_cost: 0.01
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - /src/scheduling/repositories/day-plan.repository.ts
 *     - /src/scheduling/repositories/schedule-event.repository.ts
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - DayPlanValidationService
 * voice_considerations:
 *   - Return voice-friendly validation messages
 *   - Support voice-triggered validation checks
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/integration/job-limit-enforcement.test.ts
 * tasks:
 *   - T031: Implement validation rules
 *   - Support company-specific limits
 *   - Validate schedule conflicts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { DayPlanRepository } from '../repositories/day-plan.repository';
import { ScheduleEventRepository } from '../repositories/schedule-event.repository';

type Tables = Database['public']['Tables'];
type DayPlanInsert = Tables['day_plans']['Insert'];
type ScheduleEventInsert = Tables['schedule_events']['Insert'];

const DEFAULT_JOB_LIMIT = 6;

export class DayPlanValidationService {
  private dayPlanRepo: DayPlanRepository;
  private scheduleEventRepo: ScheduleEventRepository;

  constructor(private supabase: SupabaseClient) {
    this.dayPlanRepo = new DayPlanRepository(supabase);
    this.scheduleEventRepo = new ScheduleEventRepository(supabase);
  }

  async validateDayPlan(input: Partial<DayPlanInsert>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Required fields
    if (!input.user_id) {
      errors.push('user_id is required');
    }
    if (!input.plan_date) {
      errors.push('plan_date is required');
    }

    // Validate date format
    if (input.plan_date && !this.isValidDate(input.plan_date)) {
      errors.push('plan_date must be in YYYY-MM-DD format');
    }

    // Check for duplicate day plan
    if (input.user_id && input.plan_date) {
      const existing = await this.dayPlanRepo.findByUserAndDate(input.user_id, input.plan_date);
      if (existing && existing.length > 0) {
        errors.push('A day plan already exists for this technician on this date');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async validateScheduleEvents(
    dayPlanId: string,
    events: Partial<ScheduleEventInsert>[]
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Count job events
    const jobCount = events.filter(e => e.event_type === 'job').length;
    const limit = await this.getCompanyJobLimit();

    if (jobCount > limit) {
      errors.push(`Exceeded maximum of ${limit} jobs per technician per day`);
    }

    // Validate each event
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      if (!event.event_type) {
        errors.push(`Event ${i + 1}: event_type is required`);
      }
      
      if (event.event_type === 'job' && !event.job_id) {
        errors.push(`Event ${i + 1}: job_id is required for job events`);
      }

      if (!event.scheduled_start) {
        errors.push(`Event ${i + 1}: scheduled_start is required`);
      }

      if (!event.scheduled_duration_minutes || event.scheduled_duration_minutes <= 0) {
        errors.push(`Event ${i + 1}: scheduled_duration_minutes must be positive`);
      }
    }

    // Check for time conflicts
    const timeConflicts = this.checkTimeConflicts(events);
    errors.push(...timeConflicts);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async getCompanyJobLimit(): Promise<number> {
    // TODO: Implement company-specific limits from config
    // For now, return default
    return DEFAULT_JOB_LIMIT;
  }

  private isValidDate(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  private checkTimeConflicts(events: Partial<ScheduleEventInsert>[]): string[] {
    const errors: string[] = [];
    
    // Sort events by start time
    const sortedEvents = events
      .filter(e => e.scheduled_start && e.scheduled_duration_minutes)
      .sort((a, b) => {
        const aStart = new Date(a.scheduled_start!).getTime();
        const bStart = new Date(b.scheduled_start!).getTime();
        return aStart - bStart;
      });

    // Check for overlaps
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];
      
      const currentEnd = new Date(current.scheduled_start!);
      currentEnd.setMinutes(currentEnd.getMinutes() + current.scheduled_duration_minutes!);
      
      const nextStart = new Date(next.scheduled_start!);
      
      if (currentEnd > nextStart) {
        errors.push(
          `Time conflict: Event at ${current.scheduled_start} overlaps with event at ${next.scheduled_start}`
        );
      }
    }

    return errors;
  }

  async canAddJobToTechnician(userId: string, date: string): Promise<boolean> {
    // Find the day plan
    const plans = await this.dayPlanRepo.findByUserAndDate(userId, date);
    if (plans.length === 0) return true; // No plan yet, can add

    const dayPlan = plans[0];
    
    // Count current jobs
    const events = await this.scheduleEventRepo.findByDayPlan(dayPlan.id);
    const jobCount = events.filter(e => e.event_type === 'job').length;
    
    const limit = await this.getCompanyJobLimit();
    return jobCount < limit;
  }
}