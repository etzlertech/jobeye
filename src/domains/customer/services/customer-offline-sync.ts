// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/customer/services/customer-offline-sync.ts
// phase: 2
// domain: customer-management
// purpose: Manage offline queue and sync for customer operations with voice support
// spec_ref: phase2/customer-management#offline-sync
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/customer/types/customer-types
//     - /src/domains/customer/services/customer-service
//     - /src/core/offline/queue-manager
//     - /src/core/logger/voice-logger
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - CustomerOfflineSync: class - Offline sync manager
//   - queueCustomerOperation: function - Queue operation for sync
//   - syncPendingOperations: function - Process pending queue
//   - getOfflineStatus: function - Check sync status
//   - resolveConflicts: function - Handle sync conflicts
//
// voice_considerations: |
//   Provide voice feedback for offline operations queuing.
//   Announce sync status when connection restored.
//   Handle voice commands while offline gracefully.
//   Support conflict resolution via voice interface.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/customer/services/customer-offline-sync.test.ts
//
// tasks:
//   1. Implement offline operation queue with persistence
//   2. Create sync orchestration logic
//   3. Add conflict detection and resolution
//   4. Implement voice feedback for offline status
//   5. Add retry logic with exponential backoff
//   6. Create offline data validation
// --- END DIRECTIVE BLOCK ---

import { CustomerService } from './customer-service';
import {
  Customer,
  CustomerCreate,
  CustomerUpdate,
  CustomerStatus,
  OfflineOperation,
  OfflineOperationType,
  SyncConflict,
} from '../types/customer-types';
import { voiceLogger } from '@/core/logger/voice-logger';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { EventBus } from '@/core/events/event-bus';

interface OfflineQueueEntry {
  id: string;
  operation: OfflineOperation;
  timestamp: Date;
  retryCount: number;
  lastError?: string;
  voiceSessionId?: string;
}

interface SyncResult {
  successful: number;
  failed: number;
  conflicts: SyncConflict[];
  errors: Array<{ operation: OfflineOperation; error: string }>;
}

export class CustomerOfflineSync {
  private queue: Map<string, OfflineQueueEntry> = new Map();
  private customerService: CustomerService;
  private eventBus: EventBus;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // Initial retry delay in ms

  constructor(customerService: CustomerService) {
    this.customerService = customerService;
    this.eventBus = EventBus.getInstance();
    
    // Monitor online status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      this.isOnline = navigator.onLine;
    }
    
    // Load persisted queue
    this.loadQueue();
  }

  /**
   * Queue a customer operation for offline sync
   */
  async queueCustomerOperation(
    operation: OfflineOperation,
    voiceSessionId?: string
  ): Promise<void> {
    const entry: OfflineQueueEntry = {
      id: this.generateOperationId(),
      operation,
      timestamp: new Date(),
      retryCount: 0,
      voiceSessionId,
    };

    this.queue.set(entry.id, entry);
    await this.persistQueue();

    // Voice feedback
    if (voiceSessionId) {
      await voiceLogger.speak(
        'Operation saved offline. Will sync when connection is restored.',
        { voiceSessionId }
      );
    }

    this.eventBus.emit('customer:offline:queued', {
      operationId: entry.id,
      type: operation.type,
    });
  }

  /**
   * Sync all pending operations
   */
  async syncPendingOperations(): Promise<SyncResult> {
    if (!this.isOnline || this.syncInProgress) {
      throw createAppError({
        code: 'SYNC_NOT_AVAILABLE',
        message: 'Cannot sync: offline or sync already in progress',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.NETWORK,
      });
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      successful: 0,
      failed: 0,
      conflicts: [],
      errors: [],
    };

    try {
      const operations = Array.from(this.queue.values())
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      for (const entry of operations) {
        try {
          const conflict = await this.syncOperation(entry);
          if (conflict) {
            result.conflicts.push(conflict);
          } else {
            result.successful++;
            this.queue.delete(entry.id);
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            operation: entry.operation,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          // Update retry count
          entry.retryCount++;
          entry.lastError = error instanceof Error ? error.message : 'Unknown error';
          
          if (entry.retryCount >= this.maxRetries) {
            this.queue.delete(entry.id);
            this.eventBus.emit('customer:offline:failed', {
              operationId: entry.id,
              error: entry.lastError,
            });
          }
        }
      }

      await this.persistQueue();
      
      // Voice announcement of results
      if (result.successful > 0 || result.failed > 0) {
        const message = this.buildSyncResultMessage(result);
        await voiceLogger.speak(message, {});
      }

      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get current offline sync status
   */
  getOfflineStatus(): {
    isOnline: boolean;
    queuedOperations: number;
    oldestOperation: Date | null;
    syncInProgress: boolean;
  } {
    const operations = Array.from(this.queue.values());
    const oldest = operations.length > 0
      ? operations.reduce((min, op) => 
          op.timestamp < min.timestamp ? op : min
        ).timestamp
      : null;

    return {
      isOnline: this.isOnline,
      queuedOperations: this.queue.size,
      oldestOperation: oldest,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Resolve conflicts with user input
   */
  async resolveConflicts(
    conflicts: SyncConflict[],
    resolutions: Array<'local' | 'remote' | 'merge'>
  ): Promise<void> {
    if (conflicts.length !== resolutions.length) {
      throw createAppError({
        code: 'INVALID_RESOLUTIONS',
        message: 'Resolution count must match conflict count',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VALIDATION,
      });
    }

    for (let i = 0; i < conflicts.length; i++) {
      const conflict = conflicts[i];
      const resolution = resolutions[i];

      switch (resolution) {
        case 'local':
          // Apply local version
          await this.applyLocalVersion(conflict);
          break;
        case 'remote':
          // Keep remote version (do nothing)
          break;
        case 'merge':
          // Merge changes
          await this.mergeConflict(conflict);
          break;
      }
    }
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(
    entry: OfflineQueueEntry
  ): Promise<SyncConflict | null> {
    const { operation } = entry;

    switch (operation.type) {
      case OfflineOperationType.CREATE:
        return await this.syncCreateOperation(operation);
      case OfflineOperationType.UPDATE:
        return await this.syncUpdateOperation(operation);
      case OfflineOperationType.DELETE:
        return await this.syncDeleteOperation(operation);
      default:
        throw createAppError({
          code: 'UNKNOWN_OPERATION_TYPE',
          message: `Unknown operation type: ${operation.type}`,
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.VALIDATION,
        });
    }
  }

  /**
   * Sync create operation
   */
  private async syncCreateOperation(
    operation: OfflineOperation
  ): Promise<SyncConflict | null> {
    const { data, tenantId } = operation;
    
    // Check if already exists (created by another device)
    const existing = await this.customerService.findById(
      operation.entityId!
    );

    if (existing) {
      return {
        operationId: operation.id,
        type: 'entity_exists',
        localData: data,
        remoteData: existing,
        message: 'Customer already exists on server',
      };
    }

    await this.customerService.createCustomer(data as CustomerCreate);
    return null;
  }

  /**
   * Sync update operation
   */
  private async syncUpdateOperation(
    operation: OfflineOperation
  ): Promise<SyncConflict | null> {
    const { entityId, data, tenantId, version } = operation;
    
    const current = await this.customerService.findById(entityId!);
    
    if (!current) {
      return {
        operationId: operation.id,
        type: 'entity_not_found',
        localData: data,
        message: 'Customer not found on server',
      };
    }

    // Check version conflict
    if (version && current.version && current.version !== version) {
      return {
        operationId: operation.id,
        type: 'version_mismatch',
        localData: data,
        remoteData: current,
        message: 'Customer was modified by another user',
      };
    }

    await this.customerService.updateCustomer(entityId!, data as CustomerUpdate);
    return null;
  }

  /**
   * Sync delete operation
   */
  private async syncDeleteOperation(
    operation: OfflineOperation
  ): Promise<SyncConflict | null> {
    const { entityId, tenantId } = operation;
    
    const exists = await this.customerService.findById(entityId!);
    
    if (!exists) {
      // Already deleted, consider it successful
      return null;
    }

    // CustomerService doesn't have deleteCustomer, update status instead
    await this.customerService.changeCustomerStatus(entityId!, CustomerStatus.ARCHIVED);
    return null;
  }

  /**
   * Apply local version in conflict resolution
   */
  private async applyLocalVersion(conflict: SyncConflict): Promise<void> {
    const remoteData = conflict.remoteData as Customer | undefined;
    if (!remoteData?.id || !remoteData?.tenant_id) {
      throw createAppError({
        code: 'INVALID_CONFLICT_DATA',
        message: 'Cannot apply local version - missing remote data',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
      });
    }

    const operation: OfflineOperation = {
      id: conflict.operationId,
      type: OfflineOperationType.UPDATE,
      entityId: remoteData.id,
      data: conflict.localData || {},
      tenantId: remoteData.tenant_id,
      timestamp: new Date(),
    };

    await this.syncOperation({
      id: conflict.operationId,
      operation,
      timestamp: new Date(),
      retryCount: 0,
    });
  }

  /**
   * Merge conflict data
   */
  private async mergeConflict(conflict: SyncConflict): Promise<void> {
    if (!conflict.localData || !conflict.remoteData) {
      throw createAppError({
        code: 'INVALID_MERGE_DATA',
        message: 'Cannot merge: missing data',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VALIDATION,
      });
    }

    // Simple merge strategy: local changes override remote
    const merged = {
      ...conflict.remoteData,
      ...conflict.localData,
      updatedAt: new Date(),
    };

    const remoteData = conflict.remoteData as Customer | undefined;
    if (!remoteData?.id) {
      throw createAppError({
        code: 'INVALID_CONFLICT_DATA',
        message: 'Cannot merge - missing remote data',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
      });
    }

    await this.customerService.updateCustomer(
      remoteData.id,
      merged
    );
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    this.isOnline = true;
    
    await voiceLogger.speak(
      'Connection restored. Syncing offline changes...',
      {}
    );

    this.eventBus.emit('customer:sync:online', { status: 'online' });
    
    // Auto-sync with delay
    setTimeout(async () => {
      try {
        await this.syncPendingOperations();
      } catch (error) {
        // Log but don't throw - will retry later
        console.error('Auto-sync failed:', error);
      }
    }, 2000);
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
    
    voiceLogger.speak(
      'Connection lost. Your changes will be saved offline.',
      {}
    );

    this.eventBus.emit('customer:sync:offline', { status: 'offline' });
  }

  /**
   * Persist queue to local storage
   */
  private async persistQueue(): Promise<void> {
    if (typeof window === 'undefined') return;

    const data = Array.from(this.queue.entries()).map(([id, entry]) => ({
      ...entry,
      id, // Override the id from entry if it exists
      timestamp: entry.timestamp.toISOString(),
    }));

    localStorage.setItem('customer_offline_queue', JSON.stringify(data));
  }

  /**
   * Load queue from local storage
   */
  private loadQueue(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = localStorage.getItem('customer_offline_queue');
      if (!data) return;

      const entries = JSON.parse(data);
      entries.forEach((entry: any) => {
        this.queue.set(entry.id, {
          ...entry,
          timestamp: new Date(entry.timestamp),
        });
      });
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build voice-friendly sync result message
   */
  private buildSyncResultMessage(result: SyncResult): string {
    const parts = [];
    
    if (result.successful > 0) {
      parts.push(`${result.successful} operations synced successfully`);
    }
    
    if (result.failed > 0) {
      parts.push(`${result.failed} operations failed`);
    }
    
    if (result.conflicts.length > 0) {
      parts.push(`${result.conflicts.length} conflicts need resolution`);
    }

    return parts.join('. ') + '.';
  }
}

// Convenience export
export const createCustomerOfflineSync = (
  customerService: CustomerService
): CustomerOfflineSync => {
  return new CustomerOfflineSync(customerService);
};
