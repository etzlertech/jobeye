/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/intent/services/offline-sync.service.ts
 * phase: 3
 * domain: intent
 * purpose: Service for managing offline data synchronization with retry logic
 * spec_ref: 007-mvp-intent-driven/contracts/sync-api.md
 * complexity_budget: 350
 * migrations_touched: ['042_offline_sync_queue.sql']
 * state_machine: {
 *   states: ['idle', 'syncing', 'retrying', 'error'],
 *   transitions: [
 *     'idle->syncing: startSync()',
 *     'syncing->idle: syncComplete()',
 *     'syncing->retrying: syncError()',
 *     'retrying->syncing: retrySync()',
 *     'retrying->error: maxRetriesReached()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "sync": "$0.00 (data transfer only)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '../repositories/offline-sync-queue.repository',
 *     '@/core/errors/error-types',
 *     '@/lib/offline/offline-db'
 *   ],
 *   external: [],
 *   supabase: ['offline_sync_queue table']
 * }
 * exports: ['OfflineSyncService', 'SyncProgress', 'SyncEvent']
 * voice_considerations: Voice commands get priority sync when connection restored
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/domains/intent/services/offline-sync.test.ts',
 *   integration_tests: 'tests/integration/offline-sync-flow.test.ts'
 * }
 * tasks: [
 *   'Implement sync queue processing with priorities',
 *   'Add retry logic with exponential backoff',
 *   'Create conflict resolution strategies',
 *   'Implement progress tracking and events'
 * ]
 */

import { 
  OfflineSyncQueueRepository,
  SyncQueueItem,
  SyncPriority,
  SyncStatus
} from '../repositories/offline-sync-queue.repository';
import { AppError } from '@/core/errors/error-types';
import { OfflineDatabase } from '@/lib/offline/offline-db';

export interface SyncProgress {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  currentItem?: string;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}

export interface SyncEvent {
  type: 'started' | 'progress' | 'item-synced' | 'item-failed' | 'completed' | 'error';
  timestamp: Date;
  data: any;
}

export type SyncEventHandler = (event: SyncEvent) => void;

export class OfflineSyncService {
  private repository: OfflineSyncQueueRepository;
  private offlineDb: OfflineDatabase;
  private isSyncing = false;
  private eventHandlers: SyncEventHandler[] = [];
  private syncAbortController?: AbortController;
  
  // Retry configuration
  private readonly MAX_RETRY_DELAY = 60000; // 60 seconds
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly BATCH_SIZE = 10;

  constructor() {
    this.repository = new OfflineSyncQueueRepository();
    this.offlineDb = new OfflineDatabase();
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * Start synchronization process
   */
  async startSync(tenantId: string): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      throw new AppError('Cannot sync while offline', {
        code: 'SYNC_OFFLINE_ERROR'
      });
    }

    this.isSyncing = true;
    this.syncAbortController = new AbortController();

    try {
      this.emitEvent({
        type: 'started',
        timestamp: new Date(),
        data: { tenantId }
      });

      await this.processSyncQueue(tenantId);

      this.emitEvent({
        type: 'completed',
        timestamp: new Date(),
        data: { tenantId }
      });
    } catch (error) {
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    } finally {
      this.isSyncing = false;
      this.syncAbortController = undefined;
    }
  }

  /**
   * Process sync queue by priority
   */
  private async processSyncQueue(tenantId: string): Promise<void> {
    const stats = await this.repository.getSyncStats(tenantId);
    const totalItems = stats.pending + stats.failed;

    if (totalItems === 0) {
      console.log('No items to sync');
      return;
    }

    let processedCount = 0;
    let failedCount = 0;

    // Process in batches
    while (processedCount + failedCount < totalItems) {
      if (this.syncAbortController?.signal.aborted) {
        break;
      }

      // Get next batch of items
      const items = await this.repository.getPendingItems(tenantId, this.BATCH_SIZE);
      
      if (items.length === 0) {
        break;
      }

      // Process batch
      for (const item of items) {
        if (this.syncAbortController?.signal.aborted) {
          break;
        }

        const success = await this.processSyncItem(item, tenantId);
        
        if (success) {
          processedCount++;
        } else {
          failedCount++;
        }

        // Emit progress
        this.emitEvent({
          type: 'progress',
          timestamp: new Date(),
          data: {
            totalItems,
            processedItems: processedCount,
            failedItems: failedCount,
            currentItem: item.entity,
            percentComplete: ((processedCount + failedCount) / totalItems) * 100
          } as SyncProgress
        });
      }

      // Small delay between batches
      await this.delay(100);
    }
  }

  /**
   * Process individual sync item
   */
  private async processSyncItem(
    item: SyncQueueItem,
    tenantId: string
  ): Promise<boolean> {
    try {
      // Mark as syncing
      await this.repository.markAsSyncing(item.id, tenantId);

      // Execute sync based on entity type
      await this.executeSyncOperation(item);

      // Mark as completed
      await this.repository.markAsCompleted(item.id, tenantId);

      this.emitEvent({
        type: 'item-synced',
        timestamp: new Date(),
        data: {
          itemId: item.id,
          entity: item.entity,
          operation: item.operation
        }
      });

      return true;
    } catch (error) {
      // Handle specific error types
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.repository.markAsFailed(item.id, tenantId, errorMessage);

      this.emitEvent({
        type: 'item-failed',
        timestamp: new Date(),
        data: {
          itemId: item.id,
          entity: item.entity,
          error: errorMessage,
          willRetry: item.retryCount < item.maxRetries
        }
      });

      return false;
    }
  }

  /**
   * Execute sync operation based on entity type
   */
  private async executeSyncOperation(item: SyncQueueItem): Promise<void> {
    const endpoint = this.getEndpointForEntity(item.entity);
    const method = this.getMethodForOperation(item.operation);

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Request': 'true',
        'X-Request-ID': item.id
      },
      body: JSON.stringify({
        ...item.data,
        syncMetadata: {
          originalTimestamp: item.createdAt,
          retryCount: item.retryCount,
          conflictResolution: item.conflictResolution
        }
      }),
      signal: this.syncAbortController?.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle conflict (409)
      if (response.status === 409) {
        await this.handleConflict(item, errorData);
        return;
      }

      throw new AppError(`Sync failed: ${response.statusText}`, {
        code: 'SYNC_API_ERROR',
        status: response.status,
        details: errorData
      });
    }

    // Update local cache if needed
    const result = await response.json();
    if (result.id && item.operation === 'create') {
      await this.updateLocalEntityId(item, result.id);
    }
  }

  /**
   * Handle sync conflicts
   */
  private async handleConflict(
    item: SyncQueueItem,
    conflictData: any
  ): Promise<void> {
    switch (item.conflictResolution) {
      case 'overwrite':
        // Force overwrite by adding flag
        const overwriteItem = { ...item, data: { ...item.data, forceOverwrite: true } };
        await this.executeSyncOperation(overwriteItem);
        break;
        
      case 'skip':
        // Mark as completed without processing
        console.log(`Skipping conflicted item: ${item.id}`);
        break;
        
      case 'merge':
      default:
        // Attempt to merge changes
        const mergedData = this.mergeConflictData(item.data, conflictData.currentData);
        const mergeItem = { ...item, data: mergedData };
        await this.executeSyncOperation(mergeItem);
        break;
    }
  }

  /**
   * Merge conflict data
   */
  private mergeConflictData(localData: any, serverData: any): any {
    // Simple merge strategy - prefer local for user-modified fields
    const merged = { ...serverData };
    
    // User-modified fields take precedence
    const userFields = ['name', 'description', 'notes', 'status'];
    userFields.forEach(field => {
      if (localData[field] !== undefined) {
        merged[field] = localData[field];
      }
    });

    // Server timestamps take precedence
    const serverFields = ['updatedAt', 'lastModifiedBy'];
    serverFields.forEach(field => {
      if (serverData[field] !== undefined) {
        merged[field] = serverData[field];
      }
    });

    return merged;
  }

  /**
   * Get API endpoint for entity
   */
  private getEndpointForEntity(entity: string): string {
    const endpoints: Record<string, string> = {
      'jobs': '/api/crew/jobs',
      'inventory': '/api/supervisor/inventory',
      'maintenance_reports': '/api/crew/maintenance/report',
      'intent_classifications': '/api/intent/classify',
      'ai_interaction_logs': '/api/logs/ai-interactions',
      'load_verifications': '/api/crew/jobs/load-verify'
    };

    return endpoints[entity] || `/api/sync/${entity}`;
  }

  /**
   * Get HTTP method for operation
   */
  private getMethodForOperation(operation: string): string {
    switch (operation) {
      case 'create':
        return 'POST';
      case 'update':
        return 'PUT';
      case 'delete':
        return 'DELETE';
      default:
        return 'POST';
    }
  }

  /**
   * Update local entity ID after successful create
   */
  private async updateLocalEntityId(
    item: SyncQueueItem,
    newId: string
  ): Promise<void> {
    // Update in IndexedDB
    await this.offlineDb.updateEntity(item.entity, item.entityId || '', {
      id: newId,
      syncStatus: 'synced'
    });
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    console.log('🌐 Connection restored - checking for pending sync items');
    
    // Get tenant from context (would be injected in real app)
    const tenantId = await this.getCurrentTenantId();
    
    if (tenantId) {
      // Wait a moment for connection to stabilize
      await this.delay(2000);
      
      // Check for pending items
      const stats = await this.repository.getSyncStats(tenantId);
      
      if (stats.pending > 0 || stats.failed > 0) {
        console.log(`📤 Found ${stats.pending + stats.failed} items to sync`);
        
        // Auto-start sync
        this.startSync(tenantId).catch(error => {
          console.error('Auto-sync failed:', error);
        });
      }
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('📵 Connection lost - pausing sync');
    
    if (this.isSyncing && this.syncAbortController) {
      this.syncAbortController.abort();
    }
  }

  /**
   * Cancel ongoing sync
   */
  cancelSync(): void {
    if (this.syncAbortController) {
      this.syncAbortController.abort();
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(tenantId: string): Promise<{
    isSyncing: boolean;
    stats: any;
  }> {
    const stats = await this.repository.getSyncStats(tenantId);
    
    return {
      isSyncing: this.isSyncing,
      stats
    };
  }

  /**
   * Clear old completed items
   */
  async cleanupSyncQueue(
    tenantId: string,
    olderThanDays: number = 7
  ): Promise<number> {
    return this.repository.clearCompleted(tenantId, olderThanDays);
  }

  /**
   * Subscribe to sync events
   */
  onSyncEvent(handler: SyncEventHandler): () => void {
    this.eventHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Emit sync event
   */
  private emitEvent(event: SyncEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in sync event handler:', error);
      }
    });
  }

  /**
   * Get current tenant ID (would be from auth context)
   */
  private async getCurrentTenantId(): Promise<string | null> {
    // In real implementation, this would come from auth context
    // For now, return from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tenantId');
    }
    return null;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry delay with exponential backoff
   */
  private getRetryDelay(retryCount: number): number {
    const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    return Math.min(delay, this.MAX_RETRY_DELAY);
  }
}