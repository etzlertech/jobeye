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
import { createLogger } from '@/core/logger/logger';
import { ScheduleEvent } from '../types/schedule-event.types';

const logger = createLogger('ScheduleConflictService');

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
    private scheduleEventRepo?: ScheduleEventRepository,
    private dayPlanRepo?: DayPlanRepository
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

  /**
   * Check conflicts for a single event against existing events
   * Used by tests
   */
  checkConflicts(newEvent: ScheduleEvent, existingEvents: ScheduleEvent[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const allEvents = [...existingEvents, newEvent].sort((a, b) => 
      new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
    );

    // Check time overlaps
    for (let i = 0; i < allEvents.length - 1; i++) {
      const event1 = allEvents[i];
      const event2 = allEvents[i + 1];
      
      const end1 = addMinutes(new Date(event1.scheduled_start), event1.scheduled_duration_minutes);
      const start2 = new Date(event2.scheduled_start);

      if (isAfter(end1, start2)) {
        if (event1.id === newEvent.id || event2.id === newEvent.id) {
          conflicts.push({
            id: `overlap_${event1.id}_${event2.id}`,
            type: ConflictType.TIME_OVERLAP,
            severity: 'high',
            description: 'Events overlap',
            voiceDescription: 'Schedule conflict detected',
            affectedEventIds: [event1.id, event2.id],
            suggestedResolutions: [],
            conflicting_event_id: event1.id === newEvent.id ? event2.id : event1.id
          } as any);
        }
      }

      // Check travel time
      const gapMinutes = Math.floor((start2.getTime() - end1.getTime()) / 60000);
      if (gapMinutes >= 0 && gapMinutes < 15) { // Need at least 15 minutes
        // Calculate rough travel time based on distance
        const distance = this.calculateDistance(event1.location_data, event2.location_data);
        const requiredMinutes = Math.ceil(distance * 3); // 3 minutes per mile estimate

        if (gapMinutes < requiredMinutes) {
          if (event1.id === newEvent.id || event2.id === newEvent.id) {
            conflicts.push({
              id: `travel_${event1.id}_${event2.id}`,
              type: ConflictType.TRAVEL_TIME,
              severity: 'medium',
              description: `Need ${requiredMinutes} minutes travel time, only ${gapMinutes} available`,
              voiceDescription: 'Not enough travel time',
              affectedEventIds: [event1.id, event2.id],
              suggestedResolutions: [],
              conflicting_event_id: event1.id === newEvent.id ? event2.id : event1.id,
              details: {
                required_minutes: requiredMinutes,
                available_minutes: gapMinutes
              }
            } as any);
          }
        }
      }
    }

    // Check for break violations
    const workEvents = allEvents.filter(e => e.event_type !== 'break');
    let continuousWork = 0;
    let lastBreak = null;

    for (const event of allEvents) {
      if (event.event_type === 'break') {
        continuousWork = 0;
        lastBreak = event;
      } else {
        continuousWork += event.scheduled_duration_minutes;
        
        if (continuousWork > 240 && event.id === newEvent.id) { // 4 hours
          conflicts.push({
            id: `break_${event.id}`,
            type: ConflictType.BREAK_VIOLATION,
            severity: 'medium',
            description: 'More than 4 hours without a break',
            voiceDescription: 'Break required',
            affectedEventIds: [event.id],
            suggestedResolutions: [],
            details: {
              message: 'A break is required after 4 hours of continuous work'
            }
          } as any);
        }
      }
    }

    // Check day boundary
    for (const event of [newEvent]) {
      const end = addMinutes(new Date(event.scheduled_start), event.scheduled_duration_minutes);
      const startDay = new Date(event.scheduled_start).getDate();
      const endDay = end.getDate();

      if (startDay !== endDay) {
        conflicts.push({
          id: `boundary_${event.id}`,
          type: 'day_boundary' as any,
          severity: 'high',
          description: 'Event spans multiple days',
          voiceDescription: 'Event goes past midnight',
          affectedEventIds: [event.id],
          suggestedResolutions: []
        });
      }
    }

    return conflicts;
  }

  /**
   * Find an optimal time slot for a new event
   * Used by tests
   */
  findOptimalSlot(
    durationMinutes: number,
    existingEvents: ScheduleEvent[],
    dayStart: Date,
    dayEnd: Date,
    location?: { lat: number; lng: number }
  ): Date | null {
    const sortedEvents = existingEvents
      .filter(e => e.scheduled_start)
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

    // Try to find a slot
    let currentTime = new Date(dayStart);

    // Check if we can fit at the beginning
    if (sortedEvents.length === 0 || 
        addMinutes(currentTime, durationMinutes) <= new Date(sortedEvents[0].scheduled_start)) {
      return currentTime;
    }

    // Check gaps between events
    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      const eventEnd = addMinutes(new Date(event.scheduled_start), event.scheduled_duration_minutes);
      
      // Add travel time if location provided
      let bufferMinutes = 0;
      if (location && event.location_data) {
        const distance = this.calculateDistance(location, event.location_data);
        bufferMinutes = Math.ceil(distance * 3); // 3 minutes per mile
      }

      currentTime = addMinutes(eventEnd, bufferMinutes);

      // Check if there's enough time before the next event or day end
      const nextEventStart = i < sortedEvents.length - 1 
        ? new Date(sortedEvents[i + 1].scheduled_start)
        : dayEnd;

      // Add buffer for travel to next event if needed
      if (i < sortedEvents.length - 1 && location && sortedEvents[i + 1].location_data) {
        const distance = this.calculateDistance(location, sortedEvents[i + 1].location_data);
        const travelBuffer = Math.ceil(distance * 3);
        if (addMinutes(currentTime, durationMinutes + travelBuffer) <= nextEventStart) {
          return currentTime;
        }
      } else if (addMinutes(currentTime, durationMinutes) <= nextEventStart) {
        return currentTime;
      }
    }

    // Check if we can fit after all events
    if (sortedEvents.length > 0) {
      const lastEvent = sortedEvents[sortedEvents.length - 1];
      const lastEventEnd = addMinutes(
        new Date(lastEvent.scheduled_start), 
        lastEvent.scheduled_duration_minutes
      );
      
      let bufferMinutes = 0;
      if (location && lastEvent.location_data) {
        const distance = this.calculateDistance(location, lastEvent.location_data);
        bufferMinutes = Math.ceil(distance * 3);
      }

      currentTime = addMinutes(lastEventEnd, bufferMinutes);
      
      if (addMinutes(currentTime, durationMinutes) <= dayEnd) {
        return currentTime;
      }
    }

    return null;
  }

  private calculateDistance(loc1: any, loc2: any): number {
    if (!loc1 || !loc2) return 0;
    
    // Simple Manhattan distance for testing
    const latDiff = Math.abs(loc1.lat - loc2.lat);
    const lngDiff = Math.abs(loc1.lng - loc2.lng);
    
    // Rough approximation: 69 miles per degree latitude, 54.6 miles per degree longitude (at 40° latitude)
    return (latDiff * 69) + (lngDiff * 54.6);
  }
}