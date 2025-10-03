/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/types/offline.types.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Type definitions for offline functionality
 * spec_ref: 003-scheduling-kits
 * complexity_budget: 100
 * migration_touched: None
 * state_machine: none
 * estimated_llm_cost: 0
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: []
 *   external: []
 * exports: types
 * voice_considerations: none
 * test_requirements:
 *   unit: 0%
 *   integration: 0%
 * tasks:
 *   - Define sync queue types
 *   - Define conflict resolution types
 *   - Define offline cache types
 */

export type OperationType = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncQueueEntry {
  id: string;
  operation_type: OperationType;
  entity_type: string;
  entity_id: string;
  tenant_id: string;
  user_id: string;
  data: any;
  status: SyncStatus;
  created_at: Date;
  synced_at?: Date;
  attempts: number;
  last_error?: string;
  metadata?: any;
}

export interface ConflictResolution {
  winner_id: string;
  strategy: string;
  merged_data: any;
  losing_operations: string[];
  notifications: ConflictNotification[];
  merge_details?: {
    merged_fields?: string[];
    conflicts?: string[];
  };
}

export interface ConflictNotification {
  user_id: string;
  type: 'conflict_override' | 'conflict_merge' | 'manual_review_required';
  message: string;
  entity_type: string;
  entity_id: string;
  timestamp: Date;
}

export interface SyncConflict {
  entity_id: string;
  entity_type: string;
  operations: SyncQueueEntry[];
  detected_at: Date;
}

export interface OfflineCapabilities {
  canSync: boolean;
  hasPendingChanges: boolean;
  lastSyncTime: Date | null;
  pendingOperationCount: number;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflicts: SyncConflict[];
  errors: string[];
}

export interface OfflineConfig {
  syncInterval: number; // milliseconds
  maxRetries: number;
  conflictResolutionStrategy: 'role_based' | 'timestamp' | 'manual';
  enableAutoSync: boolean;
  syncBatchSize: number;
}

export interface CacheEntry<T> {
  id: string;
  data: T;
  version: number;
  lastModified: Date;
  syncStatus: SyncStatus;
  localChanges?: Partial<T>;
}