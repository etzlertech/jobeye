/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/schedule-conflict.service.ts
 * phase: 3
 * domain: scheduling
 * purpose: Detect and resolve scheduling conflicts
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 300
 * state_machine: pending -> analyzing -> conflicts_found/no_conflicts
 * estimated_llm_cost: 0.002
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/repositories/schedule-event.repository"
 *     - "@/scheduling/repositories/day-plan.repository"
 *   external:
 *     - date-fns
 *   supabase:
 *     - schedule_events (read)
 *     - day_plans (read)
 * exports:
 *   - ScheduleConflictService
 *   - ConflictType
 *   - ConflictResolution
 * voice_considerations:
 *   - Voice alerts for detected conflicts
 *   - Simple conflict descriptions for voice playback
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/schedule-conflict.test.ts
 * tasks:
 *   - Implement conflict detection logic
 *   - Support time overlap detection
 *   - Support travel time conflicts
 *   - Support capacity conflicts
 *   - Provide conflict resolution suggestions
 */

import { addMinutes, areIntervalsOverlapping, isAfter, isBefore } from 'date-fns';
import { ScheduleEventRepository } from '@/scheduling/repositories/schedule-event.repository';
import { DayPlanRepository } from '@/scheduling/repositories/day-plan.repository';
import { logger } from '@/core/logger/voice-logger';

export enum ConflictType {
  TIME_OVERLAP = 'time_overlap',
  TRAVEL_TIME = 'travel_time',
  CAPACITY_EXCEEDED = 'capacity_exceeded',
  BREAK_VIOLATION = 'break_violation',
  OVERTIME_RISK = 'overtime_risk'
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  voiceDescription: string;
  affectedEventIds: string[];
  suggestedResolutions: ConflictResolution[];
}

export interface ConflictResolution {
  action: 'reschedule' | 'reassign' | 'extend_duration' | 'add_break' | 'cancel';
  description: string;
  params: Record<string, any>;
}

export interface ConflictCheckOptions {
  checkTravelTime?: boolean;
  checkBreaks?: boolean;
  checkCapacity?: boolean;
  maxEventsPerDay?: number;
}

export class ScheduleConflictService {
  constructor(
    private scheduleEventRepo: ScheduleEventRepository,
    private dayPlanRepo: DayPlanRepository
  ) {}

  async checkForConflicts(
    dayPlanId: string,
    options: ConflictCheckOptions = {}
  ): Promise<Conflict[]> {
    const {
      checkTravelTime = true,
      checkBreaks = true,
      checkCapacity = true,
      maxEventsPerDay = 6
    } = options;

    const conflicts: Conflict[] = [];

    try {
      // Get day plan and all its events
      const dayPlan = await this.dayPlanRepo.findById(dayPlanId);
      if (!dayPlan) {
        throw new Error(`Day plan ${dayPlanId} not found`);
      }

      const events = await this.scheduleEventRepo.findByDayPlan(dayPlanId);
      
      // Sort events by scheduled start time
      const sortedEvents = events.sort((a, b) => 
        new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime()
      );

      // Check for time overlaps
      conflicts.push(...this.checkTimeOverlaps(sortedEvents));

      // Check travel time conflicts
      if (checkTravelTime) {
        conflicts.push(...await this.checkTravelTimeConflicts(sortedEvents));
      }

      // Check break violations
      if (checkBreaks) {
        conflicts.push(...this.checkBreakViolations(sortedEvents));
      }

      // Check capacity
      if (checkCapacity) {
        const capacityConflicts = this.checkCapacityLimits(sortedEvents, maxEventsPerDay);
        if (capacityConflicts) conflicts.push(capacityConflicts);
      }

      logger.info('Conflict check completed', {
        dayPlanId,
        conflictsFound: conflicts.length,
        metadata: { voice: { summary: `Found ${conflicts.length} scheduling conflicts` } }
      });

      return conflicts;
    } catch (error) {
      logger.error('Error checking for conflicts', { error, dayPlanId });
      throw error;
    }
  }

  private checkTimeOverlaps(events: any[]): Conflict[] {
    const conflicts: Conflict[] = [];

    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];

      if (!currentEvent.scheduled_start || !currentEvent.scheduled_duration_minutes) continue;
      if (!nextEvent.scheduled_start) continue;

      const currentEnd = addMinutes(
        new Date(currentEvent.scheduled_start),
        currentEvent.scheduled_duration_minutes
      );

      if (isAfter(currentEnd, new Date(nextEvent.scheduled_start))) {
        conflicts.push({
          id: `conflict_${currentEvent.id}_${nextEvent.id}`,
          type: ConflictType.TIME_OVERLAP,
          severity: 'high',
          description: `Event "${currentEvent.id}" overlaps with "${nextEvent.id}"`,
          voiceDescription: `Time conflict detected between two scheduled events`,
          affectedEventIds: [currentEvent.id, nextEvent.id],
          suggestedResolutions: [
            {
              action: 'reschedule',
              description: 'Reschedule the second event',
              params: { eventId: nextEvent.id, newStartTime: currentEnd.toISOString() }
            },
            {
              action: 'extend_duration',
              description: 'Shorten the first event duration',
              params: { eventId: currentEvent.id, reduceDurationBy: 15 }
            }
          ]
        });
      }
    }

    return conflicts;
  }

  private async checkTravelTimeConflicts(events: any[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const MIN_TRAVEL_TIME_MINUTES = 15; // Default minimum travel time

    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];

      if (!currentEvent.scheduled_start || !currentEvent.scheduled_duration_minutes) continue;
      if (!nextEvent.scheduled_start) continue;

      const currentEnd = addMinutes(
        new Date(currentEvent.scheduled_start),
        currentEvent.scheduled_duration_minutes
      );

      const gapMinutes = Math.floor(
        (new Date(nextEvent.scheduled_start).getTime() - currentEnd.getTime()) / 60000
      );

      if (gapMinutes < MIN_TRAVEL_TIME_MINUTES) {
        conflicts.push({
          id: `travel_${currentEvent.id}_${nextEvent.id}`,
          type: ConflictType.TRAVEL_TIME,
          severity: 'medium',
          description: `Insufficient travel time between events (${gapMinutes} minutes)`,
          voiceDescription: `Not enough travel time between jobs`,
          affectedEventIds: [currentEvent.id, nextEvent.id],
          suggestedResolutions: [
            {
              action: 'reschedule',
              description: 'Add travel buffer',
              params: { 
                eventId: nextEvent.id, 
                newStartTime: addMinutes(currentEnd, MIN_TRAVEL_TIME_MINUTES).toISOString() 
              }
            }
          ]
        });
      }
    }

    return conflicts;
  }

  private checkBreakViolations(events: any[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const MAX_CONTINUOUS_WORK_HOURS = 4;
    
    if (events.length === 0) return conflicts;

    let workStartTime = new Date(events[0].scheduled_start!);
    let continuousWorkMinutes = 0;
    let lastBreakFound = false;

    for (const event of events) {
      if (event.event_type === 'break') {
        lastBreakFound = true;
        continuousWorkMinutes = 0;
        workStartTime = addMinutes(
          new Date(event.scheduled_start!),
          event.scheduled_duration_minutes || 30
        );
      } else if (event.scheduled_duration_minutes) {
        continuousWorkMinutes += event.scheduled_duration_minutes;
      }

      if (continuousWorkMinutes > MAX_CONTINUOUS_WORK_HOURS * 60 && !lastBreakFound) {
        conflicts.push({
          id: `break_violation_${event.id}`,
          type: ConflictType.BREAK_VIOLATION,
          severity: 'medium',
          description: `More than ${MAX_CONTINUOUS_WORK_HOURS} hours without a break`,
          voiceDescription: `Break needed after ${MAX_CONTINUOUS_WORK_HOURS} hours of work`,
          affectedEventIds: [event.id],
          suggestedResolutions: [
            {
              action: 'add_break',
              description: 'Schedule a 30-minute break',
              params: { afterEventId: event.id, duration: 30 }
            }
          ]
        });
        lastBreakFound = false;
      }
    }

    return conflicts;
  }

  private checkCapacityLimits(events: any[], maxEvents: number): Conflict | null {
    const jobEvents = events.filter(e => e.event_type === 'job');
    
    if (jobEvents.length > maxEvents) {
      return {
        id: `capacity_exceeded`,
        type: ConflictType.CAPACITY_EXCEEDED,
        severity: 'high',
        description: `Day plan has ${jobEvents.length} jobs, exceeding limit of ${maxEvents}`,
        voiceDescription: `Too many jobs scheduled for one day`,
        affectedEventIds: jobEvents.slice(maxEvents).map(e => e.id),
        suggestedResolutions: [
          {
            action: 'reassign',
            description: 'Move excess jobs to another day',
            params: { eventIds: jobEvents.slice(maxEvents).map(e => e.id) }
          },
          {
            action: 'cancel',
            description: 'Cancel lower priority jobs',
            params: { eventIds: jobEvents.slice(maxEvents).map(e => e.id) }
          }
        ]
      };
    }

    return null;
  }

  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<boolean> {
    try {
      logger.info('Resolving conflict', {
        conflictId,
        action: resolution.action,
        metadata: { voice: { action: `Resolving ${resolution.action}` } }
      });

      // Implementation would depend on the specific resolution action
      // This is a placeholder for the resolution logic
      switch (resolution.action) {
        case 'reschedule':
          // Implement rescheduling logic
          break;
        case 'reassign':
          // Implement reassignment logic
          break;
        case 'add_break':
          // Implement break addition logic
          break;
        default:
          logger.warn('Unknown resolution action', { action: resolution.action });
          return false;
      }

      return true;
    } catch (error) {
      logger.error('Error resolving conflict', { error, conflictId });
      return false;
    }
  }
}