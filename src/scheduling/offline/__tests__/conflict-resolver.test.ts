/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/__tests__/conflict-resolver.test.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Test offline conflict resolution logic
 * spec_ref: 003-scheduling-kits
 * complexity_budget: 200
 * migration_touched: None
 * state_machine: none
 * estimated_llm_cost: 0
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: ['ConflictResolver', 'types']
 *   external: ['jest']
 * exports: tests
 * voice_considerations: none
 * test_requirements:
 *   unit: 100%
 *   integration: 0%
 * tasks:
 *   - Test role-based priority
 *   - Test timestamp-based resolution
 *   - Test merge strategies
 *   - Test notification generation
 */

import { ConflictResolver } from '../conflict-resolver-simple';
import { ConflictResolution, OperationType } from '../types/offline.types';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  describe('resolveConflict', () => {
    const baseOperation = {
      id: 'op-1',
      operation_type: 'update' as OperationType,
      entity_type: 'schedule_event',
      entity_id: 'event-1',
      tenant_id: 'company-1',
      status: 'pending' as const,
      attempts: 0,
      created_at: new Date('2025-01-30T10:00:00Z')
    };

    it('should prioritize admin over technician', () => {
      const adminOp = {
        ...baseOperation,
        id: 'op-admin',
        user_id: 'admin-1',
        data: { title: 'Admin Update' },
        metadata: { user_role: 'admin' }
      };

      const techOp = {
        ...baseOperation,
        id: 'op-tech',
        user_id: 'tech-1',
        data: { title: 'Tech Update' },
        metadata: { user_role: 'technician' },
        created_at: new Date('2025-01-30T10:01:00Z') // Even if newer
      };

      const resolution = resolver.resolveConflict([techOp, adminOp]);

      expect(resolution.winner_id).toBe('op-admin');
      expect(resolution.strategy).toBe('role_priority');
      expect(resolution.merged_data.title).toBe('Admin Update');
    });

    it('should prioritize dispatcher over technician', () => {
      const dispatcherOp = {
        ...baseOperation,
        id: 'op-dispatcher',
        user_id: 'dispatcher-1',
        data: { scheduled_start: '2025-01-30T14:00:00Z' },
        metadata: { user_role: 'dispatcher' }
      };

      const techOp = {
        ...baseOperation,
        id: 'op-tech',
        user_id: 'tech-1',
        data: { scheduled_start: '2025-01-30T15:00:00Z' },
        metadata: { user_role: 'technician' }
      };

      const resolution = resolver.resolveConflict([techOp, dispatcherOp]);

      expect(resolution.winner_id).toBe('op-dispatcher');
      expect(resolution.merged_data.scheduled_start).toBe('2025-01-30T14:00:00Z');
    });

    it('should use timestamp when same role', () => {
      const tech1Op = {
        ...baseOperation,
        id: 'op-tech1',
        user_id: 'tech-1',
        data: { notes: 'First update' },
        metadata: { user_role: 'technician' },
        created_at: new Date('2025-01-30T10:00:00Z')
      };

      const tech2Op = {
        ...baseOperation,
        id: 'op-tech2',
        user_id: 'tech-2',
        data: { notes: 'Second update' },
        metadata: { user_role: 'technician' },
        created_at: new Date('2025-01-30T10:01:00Z')
      };

      const resolution = resolver.resolveConflict([tech1Op, tech2Op]);

      expect(resolution.winner_id).toBe('op-tech2');
      expect(resolution.strategy).toBe('latest_timestamp');
      expect(resolution.merged_data.notes).toBe('Second update');
    });

    it('should merge non-conflicting fields', () => {
      const op1 = {
        ...baseOperation,
        id: 'op-1',
        user_id: 'user-1',
        data: { 
          title: 'Updated Title',
          duration: 60 
        },
        metadata: { user_role: 'dispatcher' }
      };

      const op2 = {
        ...baseOperation,
        id: 'op-2',
        user_id: 'user-2',
        data: { 
          notes: 'Added notes',
          status: 'in_progress' 
        },
        metadata: { user_role: 'technician' },
        created_at: new Date('2025-01-30T10:01:00Z')
      };

      const resolution = resolver.resolveConflict([op1, op2]);

      expect(resolution.merged_data).toEqual({
        title: 'Updated Title',
        duration: 60,
        notes: 'Added notes',
        status: 'in_progress'
      });
      expect(resolution.merge_details?.merged_fields).toContain('notes');
      expect(resolution.merge_details?.merged_fields).toContain('status');
    });

    it('should handle field-level conflicts', () => {
      const op1 = {
        ...baseOperation,
        id: 'op-1',
        user_id: 'user-1',
        data: { 
          title: 'Title 1',
          notes: 'Notes 1',
          duration: 30
        },
        metadata: { user_role: 'dispatcher' }
      };

      const op2 = {
        ...baseOperation,
        id: 'op-2',
        user_id: 'user-2',
        data: { 
          title: 'Title 2',
          notes: 'Notes 2',
          status: 'completed'
        },
        metadata: { user_role: 'technician' },
        created_at: new Date('2025-01-30T10:01:00Z')
      };

      const resolution = resolver.resolveConflict([op1, op2]);

      // Dispatcher wins for conflicting fields
      expect(resolution.merged_data.title).toBe('Title 1');
      expect(resolution.merged_data.notes).toBe('Notes 1');
      // Non-conflicting fields are merged
      expect(resolution.merged_data.duration).toBe(30);
      expect(resolution.merged_data.status).toBe('completed');
      expect(resolution.merge_details?.conflicts).toContain('title');
      expect(resolution.merge_details?.conflicts).toContain('notes');
    });

    it('should generate appropriate notifications', () => {
      const ops = [
        {
          ...baseOperation,
          id: 'op-1',
          user_id: 'tech-1',
          data: { title: 'Tech Update' },
          metadata: { user_role: 'technician' }
        },
        {
          ...baseOperation,
          id: 'op-2',
          user_id: 'dispatcher-1',
          data: { title: 'Dispatcher Update' },
          metadata: { user_role: 'dispatcher' },
          created_at: new Date('2025-01-30T10:01:00Z')
        }
      ];

      const resolution = resolver.resolveConflict(ops);

      expect(resolution.notifications).toHaveLength(1);
      expect(resolution.notifications[0]).toMatchObject({
        user_id: 'tech-1',
        type: 'conflict_override',
        message: expect.stringContaining('overridden')
      });
    });

    it('should handle delete operations specially', () => {
      const updateOp = {
        ...baseOperation,
        id: 'op-update',
        user_id: 'user-1',
        data: { title: 'Updated' },
        metadata: { user_role: 'technician' }
      };

      const deleteOp = {
        ...baseOperation,
        id: 'op-delete',
        operation_type: 'delete' as OperationType,
        user_id: 'user-2',
        data: {},
        metadata: { user_role: 'dispatcher' },
        created_at: new Date('2025-01-30T10:01:00Z')
      };

      const resolution = resolver.resolveConflict([updateOp, deleteOp]);

      expect(resolution.winner_id).toBe('op-delete');
      expect(resolution.strategy).toBe('delete_priority');
      expect(resolution.notifications).toHaveLength(1);
    });

    it('should track losing operations', () => {
      const ops = [
        {
          ...baseOperation,
          id: 'op-1',
          user_id: 'user-1',
          data: { field1: 'value1' },
          metadata: { user_role: 'technician' }
        },
        {
          ...baseOperation,
          id: 'op-2',
          user_id: 'user-2',
          data: { field1: 'value2' },
          metadata: { user_role: 'admin' },
          created_at: new Date('2025-01-30T10:01:00Z')
        },
        {
          ...baseOperation,
          id: 'op-3',
          user_id: 'user-3',
          data: { field1: 'value3' },
          metadata: { user_role: 'dispatcher' },
          created_at: new Date('2025-01-30T10:02:00Z')
        }
      ];

      const resolution = resolver.resolveConflict(ops);

      expect(resolution.winner_id).toBe('op-2'); // Admin wins
      expect(resolution.losing_operations).toContain('op-1');
      expect(resolution.losing_operations).toContain('op-3');
      expect(resolution.notifications).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle single operation', () => {
      const op = {
        id: 'op-1',
        operation_type: 'update' as OperationType,
        entity_type: 'schedule_event',
        entity_id: 'event-1',
        tenant_id: 'company-1',
        user_id: 'user-1',
        data: { test: 'data' },
        status: 'pending' as const,
        attempts: 0,
        created_at: new Date()
      };

      const resolution = resolver.resolveConflict([op]);

      expect(resolution.winner_id).toBe('op-1');
      expect(resolution.strategy).toBe('no_conflict');
      expect(resolution.losing_operations).toHaveLength(0);
      expect(resolution.notifications).toHaveLength(0);
    });

    it('should handle empty operations array', () => {
      const resolution = resolver.resolveConflict([]);

      expect(resolution.winner_id).toBe('');
      expect(resolution.strategy).toBe('no_operations');
      expect(resolution.merged_data).toEqual({});
    });
  });
});