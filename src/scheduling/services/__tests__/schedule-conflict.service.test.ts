/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/__tests__/schedule-conflict.service.test.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Test schedule conflict detection service
 * spec_ref: 003-scheduling-kits
 * complexity_budget: 300
 * migration_touched: None
 * state_machine: none
 * estimated_llm_cost: 0
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: ['ScheduleConflictService', 'types']
 *   external: ['jest']
 * exports: tests
 * voice_considerations: none
 * test_requirements:
 *   unit: 100%
 *   integration: 0%
 * tasks:
 *   - Test overlap detection
 *   - Test travel time violations
 *   - Test break violations
 *   - Test labor rule conflicts
 */

import { ScheduleConflictService } from '../schedule-conflict.service';
import { ScheduleEvent, ConflictType } from '../../types/schedule-event.types';

describe('ScheduleConflictService', () => {
  let service: ScheduleConflictService;

  beforeEach(() => {
    service = new ScheduleConflictService();
  });

  describe('checkConflicts', () => {
    const baseEvent: ScheduleEvent = {
      id: '1',
      tenant_id: 'company-1',
      day_plan_id: 'plan-1',
      event_type: 'job',
      job_id: 'job-1',
      sequence_order: 1,
      scheduled_start: new Date('2025-01-30T09:00:00Z'),
      scheduled_duration_minutes: 60,
      status: 'scheduled',
      location_data: { lat: 40.7128, lng: -74.0060 },
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001'
      },
      notes: null,
      voice_notes: null,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should detect time overlap conflicts', () => {
      const newEvent: ScheduleEvent = {
        ...baseEvent,
        id: '2',
        scheduled_start: new Date('2025-01-30T09:30:00Z'),
        location_data: { lat: 40.7128, lng: -74.0060 }
      };

      const existingEvents = [baseEvent];
      const conflicts = service.checkConflicts(newEvent, existingEvents);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('time_overlap');
      expect(conflicts[0].conflicting_event_id).toBe('1');
    });

    it('should detect insufficient travel time', () => {
      const newEvent: ScheduleEvent = {
        ...baseEvent,
        id: '2',
        scheduled_start: new Date('2025-01-30T10:00:00Z'),
        location_data: { lat: 40.7580, lng: -73.9855 } // Times Square
      };

      const existingEvents = [baseEvent];
      const conflicts = service.checkConflicts(newEvent, existingEvents);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('travel_time');
      expect(conflicts[0].details?.required_minutes).toBeGreaterThan(0);
    });

    it('should not report conflicts when sufficient time exists', () => {
      const newEvent: ScheduleEvent = {
        ...baseEvent,
        id: '2',
        scheduled_start: new Date('2025-01-30T11:00:00Z'),
        location_data: { lat: 40.7128, lng: -74.0060 } // Same location
      };

      const existingEvents = [baseEvent];
      const conflicts = service.checkConflicts(newEvent, existingEvents);

      expect(conflicts).toHaveLength(0);
    });

    it('should detect break violations', () => {
      const existingEvents: ScheduleEvent[] = [];
      
      // Add 5 hours of continuous work
      for (let i = 0; i < 5; i++) {
        const hour = 9 + i;
        existingEvents.push({
          ...baseEvent,
          id: `event-${i}`,
          scheduled_start: new Date(`2025-01-30T${hour.toString().padStart(2, '0')}:00:00Z`),
          scheduled_duration_minutes: 60
        });
      }

      const newEvent: ScheduleEvent = {
        ...baseEvent,
        id: 'new-event',
        scheduled_start: new Date('2025-01-30T14:00:00Z')
      };

      const conflicts = service.checkConflicts(newEvent, existingEvents);
      const breakConflict = conflicts.find(c => c.type === 'break_violation');

      expect(breakConflict).toBeDefined();
      expect(breakConflict?.details?.message).toContain('break required');
    });

    it('should respect scheduled breaks', () => {
      const existingEvents: ScheduleEvent[] = [
        {
          ...baseEvent,
          id: 'work-1',
          scheduled_start: new Date('2025-01-30T09:00:00Z'),
          scheduled_duration_minutes: 180 // 3 hours
        },
        {
          ...baseEvent,
          id: 'break-1',
          event_type: 'break',
          scheduled_start: new Date('2025-01-30T12:00:00Z'),
          scheduled_duration_minutes: 30
        }
      ];

      const newEvent: ScheduleEvent = {
        ...baseEvent,
        id: 'work-2',
        scheduled_start: new Date('2025-01-30T12:30:00Z'),
        scheduled_duration_minutes: 120
      };

      const conflicts = service.checkConflicts(newEvent, existingEvents);
      const breakConflict = conflicts.find(c => c.type === 'break_violation');

      expect(breakConflict).toBeUndefined();
    });

    it('should handle day boundary checks', () => {
      const lateEvent: ScheduleEvent = {
        ...baseEvent,
        scheduled_start: new Date('2025-01-30T22:00:00Z'),
        scheduled_duration_minutes: 180 // Would go past midnight
      };

      const conflicts = service.checkConflicts(lateEvent, []);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('day_boundary');
    });
  });

  describe('findOptimalSlot', () => {
    const baseEvent: ScheduleEvent = {
      id: '1',
      tenant_id: 'company-1',
      day_plan_id: 'plan-1',
      event_type: 'job',
      job_id: 'job-1',
      sequence_order: 1,
      scheduled_start: new Date('2025-01-30T09:00:00Z'),
      scheduled_duration_minutes: 60,
      status: 'scheduled',
      location_data: { lat: 40.7128, lng: -74.0060 },
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001'
      },
      notes: null,
      voice_notes: null,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should find the next available slot', () => {
      const existingEvents = [
        {
          ...baseEvent,
          scheduled_start: new Date('2025-01-30T09:00:00Z'),
          scheduled_duration_minutes: 60
        },
        {
          ...baseEvent,
          id: '2',
          scheduled_start: new Date('2025-01-30T11:00:00Z'),
          scheduled_duration_minutes: 60
        }
      ];

      const slot = service.findOptimalSlot(
        90, // 90 minutes needed
        existingEvents,
        new Date('2025-01-30T08:00:00Z'),
        new Date('2025-01-30T17:00:00Z')
      );

      expect(slot).toBeDefined();
      expect(slot?.getUTCHours()).toBe(12); // Should find 12:00 PM slot (UTC)
    });

    it('should account for travel time between locations', () => {
      const existingEvents = [{
        ...baseEvent,
        scheduled_start: new Date('2025-01-30T09:00:00Z'),
        scheduled_duration_minutes: 60,
        location_data: { lat: 40.7128, lng: -74.0060 }
      }];

      const slot = service.findOptimalSlot(
        60,
        existingEvents,
        new Date('2025-01-30T08:00:00Z'),
        new Date('2025-01-30T17:00:00Z'),
        { lat: 40.7580, lng: -73.9855 } // Different location
      );

      expect(slot).toBeDefined();
      expect(slot!.getTime()).toBeGreaterThan(new Date('2025-01-30T10:00:00Z').getTime());
    });

    it('should return null when no slot available', () => {
      // Fill the entire day with events
      const existingEvents = [];
      for (let hour = 8; hour < 17; hour++) {
        existingEvents.push({
          ...baseEvent,
          id: `event-${hour}`,
          scheduled_start: new Date(`2025-01-30T${hour.toString().padStart(2, '0')}:00:00Z`),
          scheduled_duration_minutes: 60
        });
      }

      const slot = service.findOptimalSlot(
        120, // 2 hours needed
        existingEvents,
        new Date('2025-01-30T08:00:00Z'),
        new Date('2025-01-30T17:00:00Z')
      );

      expect(slot).toBeNull();
    });
  });
});