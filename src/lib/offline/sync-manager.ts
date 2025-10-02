/**
 * @file /src/lib/offline/sync-manager.ts
 * @purpose Manages offline-to-online synchronization
 * @phase 3
 * @domain Core Infrastructure
 * @complexity_budget 250
 * @test_coverage 80%
 */

import { offlineDB, type OfflineQueueItem } from './offline-db';
import { createClient } from '@/lib/supabase/client';

export interface SyncResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

export class SyncManager {
  private static instance: SyncManager;
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize offline DB on creation
    offlineDB.initialize().catch(console.error);
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Start automatic sync with interval
   */
  startAutoSync(intervalMs = 30000): void {
    if (this.syncInterval) {
      this.stopAutoSync();
    }

    // Initial sync if online
    if (navigator.onLine) {
      this.syncPendingOperations();
    }

    // Set up interval
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncPendingOperations();
      }
    }, intervalMs);

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  /**
   * Manually trigger sync
   */
  async syncPendingOperations(): Promise<SyncResult> {
    if (this.isSyncing || !navigator.onLine) {
      return { total: 0, successful: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      // Clean up old items first
      await offlineDB.clearOldSyncItems();
      
      // Get pending operations
      const operations = await offlineDB.getPendingOperations();
      result.total = operations.length;

      // Process each operation
      for (const operation of operations) {
        try {
          await this.processSyncItem(operation);
          await offlineDB.updateOperationStatus(operation.id!, 'completed');
          result.successful++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await offlineDB.updateOperationStatus(operation.id!, 'failed', errorMessage);
          result.failed++;
          result.errors.push({ id: operation.id!, error: errorMessage });
        }
      }

      // Sync cache expiration
      await offlineDB.clearExpiredCache();

      // Notify UI if registered
      this.notifySyncComplete(result);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Process a single sync item
   */
  private async processSyncItem(item: OfflineQueueItem): Promise<void> {
    const supabase = createClient();

    // Update status to syncing
    await offlineDB.updateOperationStatus(item.id!, 'syncing');

    switch (item.entity) {
      case 'jobs':
        await this.syncJobOperation(supabase, item);
        break;

      case 'inventory':
        await this.syncInventoryOperation(supabase, item);
        break;

      case 'load_verification':
        await this.syncLoadVerification(supabase, item);
        break;

      case 'ai_interaction_logs':
        await this.syncAILog(supabase, item);
        break;

      case 'intent_classifications':
        await this.syncIntentClassification(supabase, item);
        break;

      default:
        throw new Error(`Unknown entity type: ${item.entity}`);
    }
  }

  private async syncJobOperation(supabase: any, item: OfflineQueueItem): Promise<void> {
    switch (item.operation) {
      case 'create':
        const { error: createError } = await supabase
          .from('jobs')
          .insert(item.data);
        if (createError) throw createError;
        break;

      case 'update':
        const { error: updateError } = await supabase
          .from('jobs')
          .update(item.data)
          .eq('id', item.entityId);
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from('jobs')
          .delete()
          .eq('id', item.entityId);
        if (deleteError) throw deleteError;
        break;
    }
  }

  private async syncInventoryOperation(supabase: any, item: OfflineQueueItem): Promise<void> {
    switch (item.operation) {
      case 'create':
        const { error } = await supabase
          .from('equipment_items')
          .insert(item.data);
        if (error) throw error;
        break;

      case 'update':
        const { error: updateError } = await supabase
          .from('equipment_items')
          .update(item.data)
          .eq('id', item.entityId);
        if (updateError) throw updateError;
        break;

      default:
        throw new Error(`Unsupported operation for inventory: ${item.operation}`);
    }
  }

  private async syncLoadVerification(supabase: any, item: OfflineQueueItem): Promise<void> {
    if (item.operation !== 'create') {
      throw new Error('Only create operations supported for load verification');
    }

    const { error } = await supabase
      .from('kit_verifications')
      .insert(item.data);
    if (error) throw error;
  }

  private async syncAILog(supabase: any, item: OfflineQueueItem): Promise<void> {
    if (item.operation !== 'create') {
      throw new Error('Only create operations supported for AI logs');
    }

    const { error } = await supabase
      .from('ai_interaction_logs')
      .insert(item.data);
    if (error) throw error;
  }

  private async syncIntentClassification(supabase: any, item: OfflineQueueItem): Promise<void> {
    if (item.operation !== 'create') {
      throw new Error('Only create operations supported for intent classifications');
    }

    const { error } = await supabase
      .from('intent_classifications')
      .insert(item.data);
    if (error) throw error;
  }

  private handleOnline = (): void => {
    console.log('[SyncManager] Network online, triggering sync');
    this.syncPendingOperations();
  };

  private handleOffline = (): void => {
    console.log('[SyncManager] Network offline');
  };

  private notifySyncComplete(result: SyncResult): void {
    // Emit custom event for UI components
    const event = new CustomEvent('sync:complete', { detail: result });
    window.dispatchEvent(event);
  }

  /**
   * Queue an operation for sync
   */
  async queueOperation(
    entity: string,
    operation: 'create' | 'update' | 'delete',
    data: any,
    entityId?: string
  ): Promise<number> {
    return offlineDB.queueOperation({
      entity,
      operation,
      data,
      entityId
    });
  }

  /**
   * Check if there are pending operations
   */
  async hasPendingOperations(): Promise<boolean> {
    const pending = await offlineDB.getPendingOperations(1);
    return pending.length > 0;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): { isSyncing: boolean; isOnline: boolean } {
    return {
      isSyncing: this.isSyncing,
      isOnline: navigator.onLine
    };
  }
}

// Export singleton instance
export const syncManager = SyncManager.getInstance();