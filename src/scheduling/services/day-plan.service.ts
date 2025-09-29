/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/services/day-plan.service.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Manages day plan creation and updates with validation
 * spec_ref: .specify/features/003-scheduling-kits/specs/backend-scheduling.md
 * complexity_budget: 250
 * state_machine: none
 * estimated_llm_cost: 0.02
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - /src/scheduling/repositories/day-plan.repository.ts
 *     - /src/scheduling/repositories/schedule-event.repository.ts
 *     - /src/scheduling/services/scheduling.service.ts
 *     - /src/scheduling/services/day-plan-validation.service.ts
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - DayPlanService
 * voice_considerations:
 *   - Support voice-driven plan creation
 *   - Return voice-friendly confirmations
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/integration/job-limit-enforcement.test.ts
 * tasks:
 *   - T033: Implement createDayPlan with validation
 *   - Handle batch event creation
 *   - Support offline operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { DayPlanRepository } from '../repositories/day-plan.repository';
import { ScheduleEventRepository } from '../repositories/schedule-event.repository';
import type { SchedulingService } from './scheduling.service';
import type { DayPlanValidationService } from './day-plan-validation.service';

type Tables = Database['public']['Tables'];
type DayPlan = Tables['day_plans']['Row'];
type DayPlanInsert = Tables['day_plans']['Insert'];
type ScheduleEventInsert = Tables['schedule_events']['Insert'];

interface CreateDayPlanInput {
  user_id: string;
  plan_date: string;
  schedule_events?: Array<Omit<ScheduleEventInsert, 'day_plan_id' | 'company_id' | 'id' | 'created_at' | 'updated_at'>>;
  route_data?: any;
  voice_session_id?: string;
}

export class DayPlanService {
  private dayPlanRepo: DayPlanRepository;
  private scheduleEventRepo: ScheduleEventRepository;

  constructor(
    private supabase: SupabaseClient<Database>,
    private schedulingService: SchedulingService,
    private validationService: DayPlanValidationService
  ) {
    this.dayPlanRepo = new DayPlanRepository(supabase);
    this.scheduleEventRepo = new ScheduleEventRepository(supabase);
  }

  async createDayPlan(input: CreateDayPlanInput): Promise<DayPlan> {
    // Validate the day plan
    const validation = await this.validationService.validateDayPlan({
      user_id: input.user_id,
      plan_date: input.plan_date
    });

    if (!validation.valid) {
      throw new Error(`Invalid day plan: ${validation.errors.join(', ')}`);
    }

    // If schedule events provided, validate them
    if (input.schedule_events && input.schedule_events.length > 0) {
      const eventValidation = await this.validationService.validateScheduleEvents(
        'temp-id', // We don't have the day plan ID yet
        input.schedule_events
      );

      if (!eventValidation.valid) {
        throw new Error(`Invalid schedule events: ${eventValidation.errors.join(', ')}`);
      }
    }

    // Get company ID from auth context (mock for now)
    const companyId = '00000000-0000-4000-a000-000000000003';

    // Create the day plan
    const dayPlan = await this.dayPlanRepo.create({
      company_id: companyId,
      user_id: input.user_id,
      plan_date: input.plan_date,
      status: 'draft',
      route_data: input.route_data,
      voice_session_id: input.voice_session_id,
      total_distance_miles: input.route_data ? this.calculateDistance(input.route_data) : 0,
      estimated_duration_minutes: input.route_data ? this.calculateDuration(input.route_data) : 0
    });

    // Create schedule events if provided
    if (input.schedule_events && input.schedule_events.length > 0) {
      for (const event of input.schedule_events) {
        await this.schedulingService.scheduleEvent({
          ...event,
          day_plan_id: dayPlan.id
        });
      }
    }

    return dayPlan;
  }

  async updateDayPlan(
    id: string,
    updates: Partial<DayPlanInsert>
  ): Promise<DayPlan> {
    // Validate updates if changing user or date
    if (updates.user_id || updates.plan_date) {
      const existing = await this.dayPlanRepo.findById(id);
      if (!existing) {
        throw new Error('Day plan not found');
      }

      const validation = await this.validationService.validateDayPlan({
        user_id: updates.user_id || existing.user_id,
        plan_date: updates.plan_date || existing.plan_date
      });

      if (!validation.valid) {
        throw new Error(`Invalid updates: ${validation.errors.join(', ')}`);
      }
    }

    return await this.dayPlanRepo.update(id, updates);
  }

  async getDayPlan(id: string): Promise<DayPlan | null> {
    return await this.dayPlanRepo.findById(id);
  }

  async getTechnicianDayPlans(userId: string, startDate: string, endDate: string): Promise<DayPlan[]> {
    // TODO: Implement date range query in repository
    const plans: DayPlan[] = [];
    
    // For now, query each date
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayPlans = await this.dayPlanRepo.findByUserAndDate(userId, dateStr);
      plans.push(...dayPlans);
    }
    
    return plans;
  }

  async deleteDayPlan(id: string): Promise<void> {
    // First delete all schedule events
    const events = await this.scheduleEventRepo.findByDayPlan(id);
    for (const event of events) {
      await this.schedulingService.deleteEvent(event.id);
    }

    // Then delete the day plan
    await this.dayPlanRepo.delete(id);
  }

  private calculateDistance(routeData: any): number {
    // Mock calculation - in real implementation would use routing service
    if (routeData.stops && routeData.stops.length > 1) {
      return 5.2; // Mock 5.2 miles
    }
    return 0;
  }

  private calculateDuration(routeData: any): number {
    // Mock calculation - in real implementation would use routing service
    if (routeData.stops && routeData.stops.length > 1) {
      return 45; // Mock 45 minutes
    }
    return 0;
  }
}