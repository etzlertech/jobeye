/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/conflict-resolver-simple.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Simple conflict resolver matching test expectations
 * spec_ref: 003-scheduling-kits
 * complexity_budget: 250
 * migration_touched: None
 * state_machine: none
 * estimated_llm_cost: 0
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: ['types/offline.types']
 *   external: []
 * exports: ConflictResolver
 * voice_considerations: none
 * test_requirements:
 *   unit: 90%
 *   integration: 0%
 * tasks:
 *   - Implement role-based resolution
 *   - Implement timestamp resolution
 *   - Implement merge strategies
 */

import { ConflictResolution, SyncQueueEntry, ConflictNotification } from './types/offline.types';

type UserRole = 'admin' | 'dispatcher' | 'technician' | 'supervisor';

interface RolePriority {
  admin: number;
  supervisor: number;
  dispatcher: number;
  technician: number;
}

export class ConflictResolver {
  private rolePriority: RolePriority = {
    admin: 4,
    supervisor: 3,
    dispatcher: 2,
    technician: 1
  };

  resolveConflict(operations: SyncQueueEntry[]): ConflictResolution {
    if (operations.length === 0) {
      return {
        winner_id: '',
        strategy: 'no_operations',
        merged_data: {},
        losing_operations: [],
        notifications: []
      };
    }

    if (operations.length === 1) {
      return {
        winner_id: operations[0].id,
        strategy: 'no_conflict',
        merged_data: operations[0].data,
        losing_operations: [],
        notifications: []
      };
    }

    // Check for delete operations - they take priority
    const deleteOp = operations.find(op => op.operation_type === 'delete');
    if (deleteOp) {
      const losingOps = operations.filter(op => op.id !== deleteOp.id);
      return {
        winner_id: deleteOp.id,
        strategy: 'delete_priority',
        merged_data: deleteOp.data,
        losing_operations: losingOps.map(op => op.id),
        notifications: losingOps.map(op => ({
          user_id: op.user_id,
          type: 'conflict_override' as const,
          message: `Your changes were overridden by a delete operation`,
          entity_type: op.entity_type,
          entity_id: op.entity_id,
          timestamp: new Date()
        }))
      };
    }

    // Sort by role priority, then by timestamp
    const sortedOps = [...operations].sort((a, b) => {
      const roleA = this.getUserRole(a);
      const roleB = this.getUserRole(b);
      const priorityA = this.rolePriority[roleA] || 0;
      const priorityB = this.rolePriority[roleB] || 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority wins
      }

      // Same role - use timestamp
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const winner = sortedOps[0];
    const losers = sortedOps.slice(1);
    
    // Check if we used role-based or timestamp strategy
    const winnerRole = this.getUserRole(winner);
    const strategy = losers.some(op => 
      this.rolePriority[this.getUserRole(op)] < this.rolePriority[winnerRole]
    ) ? 'role_priority' : 'latest_timestamp';

    // Merge data from all operations
    const mergedData = this.mergeOperationData(operations, winner);

    return {
      winner_id: winner.id,
      strategy,
      merged_data: mergedData.data,
      losing_operations: losers.map(op => op.id),
      notifications: losers.map(op => ({
        user_id: op.user_id,
        type: 'conflict_override' as const,
        message: `Your ${op.operation_type} was overridden by ${winner.user_id}`,
        entity_type: op.entity_type,
        entity_id: op.entity_id,
        timestamp: new Date()
      })),
      merge_details: mergedData.details
    };
  }

  private getUserRole(operation: SyncQueueEntry): UserRole {
    return operation.metadata?.user_role || 'technician';
  }

  private mergeOperationData(
    operations: SyncQueueEntry[], 
    winner: SyncQueueEntry
  ): { 
    data: any; 
    details: { merged_fields?: string[]; conflicts?: string[] } 
  } {
    const mergedData = { ...winner.data };
    const mergedFields: string[] = [];
    const conflicts: string[] = [];

    // Merge non-conflicting fields from other operations
    for (const op of operations) {
      if (op.id === winner.id) continue;

      for (const [key, value] of Object.entries(op.data)) {
        if (!(key in mergedData)) {
          // Non-conflicting field
          mergedData[key] = value;
          mergedFields.push(key);
        } else if (mergedData[key] !== value) {
          // Conflicting field - winner's value is kept
          conflicts.push(key);
        }
      }
    }

    return {
      data: mergedData,
      details: {
        merged_fields: mergedFields.length > 0 ? mergedFields : undefined,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      }
    };
  }
}