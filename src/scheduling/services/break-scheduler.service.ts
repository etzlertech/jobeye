/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/break-scheduler.service.ts
 * phase: 3
 * domain: scheduling
 * purpose: Schedule breaks according to labor rules
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 300
 * state_machine: idle -> calculating -> breaks_scheduled
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/repositories/schedule-event.repository"
 *     - "@/scheduling/config/labor-rules"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - date-fns
 *   supabase:
 *     - schedule_events (read/write)
 * exports:
 *   - BreakSchedulerService
 *   - BreakScheduleResult
 * voice_considerations:
 *   - Voice prompts for break reminders
 *   - Simple break duration announcements
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/break-scheduler.test.ts
 * tasks:
 *   - Calculate break requirements based on labor rules
 *   - Auto-insert breaks at optimal times
 *   - Handle break preferences
 *   - Ensure compliance with labor laws
 */

import { addMinutes, differenceInMinutes, format, isAfter, isBefore } from 'date-fns';
import { ScheduleEventRepository } from '@/scheduling/repositories/schedule-event.repository';
import { LaborRules, getDefaultLaborRules } from '@/scheduling/config/labor-rules';
import { logger } from '@/core/logger/voice-logger';

export interface BreakScheduleOptions {
  dayPlanId: string;
  preferredBreakTimes?: string[]; // HH:mm format
  allowFlexibleBreaks?: boolean;
  respectExistingBreaks?: boolean;
}

export interface BreakScheduleResult {
  breaksAdded: number;
  breaksSkipped: number;
  totalBreakMinutes: number;
  warnings: string[];
  voiceSummary: string;
}

export interface ScheduledBreak {
  startTime: Date;
  durationMinutes: number;
  type: 'meal' | 'rest';
  reason: string;
}

export class BreakSchedulerService {
  constructor(
    private scheduleEventRepo: ScheduleEventRepository,
    private laborRules: LaborRules = getDefaultLaborRules()
  ) {}

  async scheduleBreaks(options: BreakScheduleOptions): Promise<BreakScheduleResult> {
    const { 
      dayPlanId, 
      preferredBreakTimes = [], 
      allowFlexibleBreaks = true,
      respectExistingBreaks = true 
    } = options;

    const result: BreakScheduleResult = {
      breaksAdded: 0,
      breaksSkipped: 0,
      totalBreakMinutes: 0,
      warnings: [],
      voiceSummary: ''
    };

    try {
      logger.info('Scheduling breaks for day plan', {
        dayPlanId,
        metadata: { voice: { action: 'Calculating break schedule' } }
      });

      // Get all events for the day
      const events = await this.scheduleEventRepo.findByDayPlan(dayPlanId);
      const sortedEvents = events.sort((a, b) => 
        new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime()
      );

      if (sortedEvents.length === 0) {
        result.warnings.push('No events found in day plan');
        result.voiceSummary = 'No events to schedule breaks for';
        return result;
      }

      // Filter existing breaks if respecting them
      const existingBreaks = respectExistingBreaks 
        ? sortedEvents.filter(e => e.event_type === 'break')
        : [];

      const workEvents = sortedEvents.filter(e => e.event_type !== 'break');
      
      // Calculate required breaks
      const requiredBreaks = this.calculateRequiredBreaks(
        workEvents,
        existingBreaks,
        preferredBreakTimes
      );

      // Insert breaks into the schedule
      for (const breakToSchedule of requiredBreaks) {
        const inserted = await this.insertBreak(
          dayPlanId,
          breakToSchedule,
          workEvents,
          allowFlexibleBreaks
        );

        if (inserted) {
          result.breaksAdded++;
          result.totalBreakMinutes += breakToSchedule.durationMinutes;
        } else {
          result.breaksSkipped++;
          result.warnings.push(`Could not schedule ${breakToSchedule.type} break at ${format(breakToSchedule.startTime, 'HH:mm')}`);
        }
      }

      // Generate voice summary
      result.voiceSummary = this.generateVoiceSummary(result);

      logger.info('Break scheduling completed', {
        dayPlanId,
        breaksAdded: result.breaksAdded,
        totalMinutes: result.totalBreakMinutes,
        metadata: { voice: { summary: result.voiceSummary } }
      });

      return result;
    } catch (error) {
      logger.error('Error scheduling breaks', { error, dayPlanId });
      throw error;
    }
  }

  private calculateRequiredBreaks(
    workEvents: any[],
    existingBreaks: any[],
    preferredTimes: string[]
  ): ScheduledBreak[] {
    const requiredBreaks: ScheduledBreak[] = [];
    
    if (workEvents.length === 0) return requiredBreaks;

    const workStart = new Date(workEvents[0].scheduled_start!);
    const lastEvent = workEvents[workEvents.length - 1];
    const workEnd = addMinutes(
      new Date(lastEvent.scheduled_start!),
      lastEvent.scheduled_duration_minutes || 0
    );

    const totalWorkMinutes = differenceInMinutes(workEnd, workStart);
    const workHours = totalWorkMinutes / 60;

    // Calculate meal breaks (typically after 5-6 hours)
    if (workHours >= this.laborRules.maxHoursBeforeMealBreak) {
      const mealBreakTime = this.findOptimalBreakTime(
        workStart,
        workEnd,
        this.laborRules.mealBreakDuration,
        preferredTimes,
        workEvents,
        'meal'
      );

      if (mealBreakTime && !this.isBreakAlreadyScheduled(mealBreakTime, existingBreaks)) {
        requiredBreaks.push({
          startTime: mealBreakTime,
          durationMinutes: this.laborRules.mealBreakDuration,
          type: 'meal',
          reason: `Required meal break after ${this.laborRules.maxHoursBeforeMealBreak} hours`
        });
      }
    }

    // Calculate rest breaks (every 4 hours)
    const restBreakInterval = this.laborRules.maxContinuousWorkHours * 60;
    let currentWorkDuration = 0;
    let lastBreakTime = workStart;

    for (const event of workEvents) {
      const eventStart = new Date(event.scheduled_start!);
      const eventDuration = event.scheduled_duration_minutes || 0;

      currentWorkDuration += eventDuration;

      if (currentWorkDuration >= restBreakInterval) {
        const restBreakTime = this.findOptimalBreakTime(
          lastBreakTime,
          addMinutes(eventStart, eventDuration),
          this.laborRules.restBreakDuration,
          preferredTimes,
          workEvents,
          'rest'
        );

        if (restBreakTime && !this.isBreakAlreadyScheduled(restBreakTime, existingBreaks)) {
          requiredBreaks.push({
            startTime: restBreakTime,
            durationMinutes: this.laborRules.restBreakDuration,
            type: 'rest',
            reason: `Rest break after ${this.laborRules.maxContinuousWorkHours} hours of continuous work`
          });
          lastBreakTime = restBreakTime;
          currentWorkDuration = 0;
        }
      }
    }

    return requiredBreaks;
  }

  private findOptimalBreakTime(
    earliestTime: Date,
    latestTime: Date,
    durationMinutes: number,
    preferredTimes: string[],
    workEvents: any[],
    breakType: 'meal' | 'rest'
  ): Date | null {
    // First try preferred times
    for (const timeStr of preferredTimes) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const breakTime = new Date(earliestTime);
      breakTime.setHours(hours, minutes, 0, 0);

      if (this.isTimeSlotAvailable(breakTime, durationMinutes, workEvents) &&
          isAfter(breakTime, earliestTime) && 
          isBefore(breakTime, latestTime)) {
        return breakTime;
      }
    }

    // Find first available gap
    for (let i = 0; i < workEvents.length - 1; i++) {
      const currentEnd = addMinutes(
        new Date(workEvents[i].scheduled_start!),
        workEvents[i].scheduled_duration_minutes || 0
      );
      const nextStart = new Date(workEvents[i + 1].scheduled_start!);
      
      const gapMinutes = differenceInMinutes(nextStart, currentEnd);
      
      if (gapMinutes >= durationMinutes + 10) { // 10 min buffer
        return addMinutes(currentEnd, 5); // 5 min after previous event
      }
    }

    // Try after all events
    const lastEventEnd = addMinutes(
      new Date(workEvents[workEvents.length - 1].scheduled_start!),
      workEvents[workEvents.length - 1].scheduled_duration_minutes || 0
    );

    if (isBefore(lastEventEnd, latestTime)) {
      return lastEventEnd;
    }

    return null;
  }

  private isTimeSlotAvailable(
    startTime: Date,
    durationMinutes: number,
    events: any[]
  ): boolean {
    const endTime = addMinutes(startTime, durationMinutes);

    for (const event of events) {
      const eventStart = new Date(event.scheduled_start!);
      const eventEnd = addMinutes(eventStart, event.scheduled_duration_minutes || 0);

      // Check for overlap
      if (
        (isAfter(startTime, eventStart) && isBefore(startTime, eventEnd)) ||
        (isAfter(endTime, eventStart) && isBefore(endTime, eventEnd)) ||
        (isBefore(startTime, eventStart) && isAfter(endTime, eventEnd))
      ) {
        return false;
      }
    }

    return true;
  }

  private isBreakAlreadyScheduled(
    proposedTime: Date,
    existingBreaks: any[]
  ): boolean {
    const threshold = 30; // 30 minutes threshold

    for (const existingBreak of existingBreaks) {
      const breakStart = new Date(existingBreak.scheduled_start!);
      const timeDiff = Math.abs(differenceInMinutes(proposedTime, breakStart));
      
      if (timeDiff < threshold) {
        return true;
      }
    }

    return false;
  }

  private async insertBreak(
    dayPlanId: string,
    scheduledBreak: ScheduledBreak,
    workEvents: any[],
    allowFlexible: boolean
  ): Promise<boolean> {
    try {
      // Find the correct sequence order
      let sequenceOrder = 1;
      for (const event of workEvents) {
        if (new Date(event.scheduled_start!) > scheduledBreak.startTime) {
          break;
        }
        sequenceOrder = event.sequence_order + 1;
      }

      // Create the break event
      await this.scheduleEventRepo.create({
        tenant_id: workEvents[0].tenant_id,
        day_plan_id: dayPlanId,
        event_type: 'break',
        sequence_order: sequenceOrder,
        scheduled_start: scheduledBreak.startTime.toISOString(),
        scheduled_duration_minutes: scheduledBreak.durationMinutes,
        status: 'pending',
        notes: scheduledBreak.reason,
        metadata: {
          break_type: scheduledBreak.type,
          auto_scheduled: true,
          voice_reminder: true
        }
      });

      // Update sequence orders for subsequent events
      const eventsToUpdate = workEvents.filter(
        e => e.sequence_order >= sequenceOrder
      );
      
      for (const event of eventsToUpdate) {
        await this.scheduleEventRepo.update(event.id, {
          sequence_order: event.sequence_order + 1
        });
      }

      return true;
    } catch (error) {
      logger.error('Error inserting break', { error, scheduledBreak });
      return false;
    }
  }

  private generateVoiceSummary(result: BreakScheduleResult): string {
    if (result.breaksAdded === 0) {
      return 'No breaks added to schedule';
    }

    const parts = [`Added ${result.breaksAdded} break${result.breaksAdded > 1 ? 's' : ''}`];
    
    if (result.totalBreakMinutes > 0) {
      parts.push(`totaling ${result.totalBreakMinutes} minutes`);
    }

    if (result.warnings.length > 0) {
      parts.push(`with ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`);
    }

    return parts.join(' ');
  }

  async validateBreakCompliance(dayPlanId: string): Promise<{
    compliant: boolean;
    violations: string[];
  }> {
    const events = await this.scheduleEventRepo.findByDayPlan(dayPlanId);
    const violations: string[] = [];

    // Check continuous work hours
    let continuousWorkMinutes = 0;
    let lastBreakTime: Date | null = null;

    for (const event of events) {
      if (event.event_type === 'break') {
        continuousWorkMinutes = 0;
        lastBreakTime = new Date(event.scheduled_start!);
      } else {
        continuousWorkMinutes += event.scheduled_duration_minutes || 0;
        
        if (continuousWorkMinutes > this.laborRules.maxContinuousWorkHours * 60) {
          violations.push(
            `More than ${this.laborRules.maxContinuousWorkHours} hours without a break`
          );
        }
      }
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }
}