/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/lib/offline/sync-manager.ts
 * phase: 3
 * domain: offline
 * purpose: Enhanced offline sync manager for coordinating data synchronization between local storage and backend
 * spec_ref: 007-mvp-intent-driven/contracts/offline-sync-manager.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['idle', 'syncing', 'conflict_resolution', 'error'],
 *   transitions: [
 *     'idle->syncing: startSync()',
 *     'syncing->idle: syncComplete()',
 *     'syncing->conflict_resolution: conflictDetected()',
 *     'conflict_resolution->syncing: resolveConflict()',
 *     'syncing->error: syncError()',
 *     'error->idle: resetError()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "syncManager": "$0.00 (no AI operations)"
 * }
 * offline_capability: CORE
 * dependencies: {
 *   internal: [
 *     '@/lib/offline/offline-db',
 *     '@/core/errors/error-types',
 *     '@/core/logger/voice-logger'
 *   ],
 *   external: [],
 *   supabase: ['auth', 'database']
 * }
 * exports: ['OfflineSyncManager', 'SyncResult', 'ConflictResolution']
 * voice_considerations: Sync voice recordings and transcripts with priority queuing
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/lib/offline/sync-manager.test.ts'
 * }
 * tasks: [
 *   'Implement priority-based sync queue processing',
 *   'Add conflict resolution strategies',
 *   'Handle voice and image data synchronization',
 *   'Implement retry logic with exponential backoff'
 * ]
 */

import { offlineDB, type OfflineQueueItem, type SyncQueueItem, type VoiceRecording, type ImageData, type OfflineEntity } from './offline-db';
import { createClient } from '@/lib/supabase/client';
import { AppError } from '@/core/errors/error-types';
import { voiceLogger } from '@/core/logger/voice-logger';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
  voiceRecordings?: number;
  imageData?: number;
  offlineEntities?: number;
}

export interface ConflictResolution {
  strategy: 'overwrite' | 'merge' | 'skip';
  remoteData?: any;
  localData?: any;
  resolvedData?: any;
}

export interface SyncOptions {
  maxRetries?: number;
  batchSize?: number;
  timeout?: number;
  priorityOnly?: boolean;
  includeVoice?: boolean;
  includeImages?: boolean;
}

export class SyncManager {
  private static instance: SyncManager;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInProgress: Set<string> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize offline DB on creation
    offlineDB.initialize().catch(console.error);
    this.setupNetworkListeners();
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

  // Enhanced MVP methods
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      voiceLogger.info('Network connection restored, starting sync');
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      voiceLogger.info('Network connection lost');
    });

    // Listen for visibility changes to sync when app becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncAll();
      }
    });
  }

  async syncAll(options: SyncOptions = {}): Promise<SyncResult> {
    if (!this.isOnline) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: ['Network is offline']
      };
    }

    if (this.isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: ['Sync already in progress']
      };
    }

    this.isSyncing = true;
    voiceLogger.info('Starting enhanced sync', { options });

    try {
      const results = await Promise.allSettled([
        this.syncPriorityOperations(options),
        options.includeVoice !== false ? this.syncVoiceRecordings(options) : Promise.resolve({ synced: 0, failed: 0, conflicts: 0, errors: [] }),
        options.includeImages !== false ? this.syncImageData(options) : Promise.resolve({ synced: 0, failed: 0, conflicts: 0, errors: [] }),
        this.syncOfflineEntities(options)
      ]);

      const combinedResult = this.combineResults(results);
      
      voiceLogger.info('Enhanced sync completed', combinedResult);
      return combinedResult;
    } catch (error) {
      voiceLogger.error('Enhanced sync failed', error);
      throw new AppError('Sync operation failed', 'SYNC_ERROR', { error });
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncPriorityOperations(options: SyncOptions): Promise<Partial<SyncResult>> {
    const operations = await offlineDB.getPriorityOperations(options.batchSize || 50);
    let synced = 0;
    let failed = 0;
    let conflicts = 0;
    const errors: string[] = [];

    for (const operation of operations) {
      try {
        if (this.syncInProgress.has(operation.id!)) {
          continue;
        }

        this.syncInProgress.add(operation.id!);
        
        const result = await this.syncOperation(operation, options);
        
        if (result.success) {
          synced++;
        } else if (result.conflict) {
          conflicts++;
          await this.handleConflict(operation, result.conflictData);
        } else {
          failed++;
          await this.handleSyncFailure(operation, result.error);
          errors.push(result.error || 'Unknown sync error');
        }
      } catch (error) {
        failed++;
        errors.push(error instanceof Error ? error.message : 'Unknown error');
        await this.handleSyncFailure(operation, error instanceof Error ? error.message : 'Unknown error');
      } finally {
        this.syncInProgress.delete(operation.id!);
      }
    }

    return { synced, failed, conflicts, errors };
  }

  private async syncOperation(operation: SyncQueueItem, options: SyncOptions): Promise<{
    success: boolean;
    conflict?: boolean;
    conflictData?: any;
    error?: string;
  }> {
    try {
      // Use existing sync logic but enhanced
      await this.processSyncItem(operation as any);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async syncVoiceRecordings(options: SyncOptions): Promise<Partial<SyncResult>> {
    const recordings = await offlineDB.getPendingVoiceRecordings();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recording of recordings.slice(0, options.batchSize || 10)) {
      try {
        const formData = new FormData();
        formData.append('voice', recording.blob, `voice-${recording.id}.wav`);
        formData.append('transcript', recording.transcript || '');
        formData.append('duration', recording.duration?.toString() || '0');
        formData.append('jobId', recording.jobId || '');

        const response = await fetch('/api/voice/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          await offlineDB.updateVoiceRecordingStatus(recording.id, 'synced');
          synced++;
        } else {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Voice recording ${recording.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        await offlineDB.updateVoiceRecordingStatus(recording.id, 'error');
      }
    }

    return { synced, failed, errors };
  }

  private async syncImageData(options: SyncOptions): Promise<Partial<SyncResult>> {
    const images = await offlineDB.getPendingImageData();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const imageData of images.slice(0, options.batchSize || 10)) {
      try {
        const formData = new FormData();
        formData.append('image', imageData.blob, `image-${imageData.id}.jpg`);
        
        if (imageData.thumbnailBlob) {
          formData.append('thumbnail', imageData.thumbnailBlob, `thumb-${imageData.id}.jpg`);
        }
        
        formData.append('metadata', JSON.stringify(imageData.metadata));
        formData.append('jobId', imageData.jobId || '');

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          await offlineDB.updateImageDataStatus(imageData.id, 'synced');
          synced++;
        } else {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Image ${imageData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        await offlineDB.updateImageDataStatus(imageData.id, 'error');
      }
    }

    return { synced, failed, errors };
  }

  private async syncOfflineEntities(options: SyncOptions): Promise<Partial<SyncResult>> {
    const entities = await offlineDB.getPendingOfflineEntities();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entity of entities.slice(0, options.batchSize || 20)) {
      try {
        const response = await fetch(`/api/${entity.entity}/${entity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entity.data)
        });

        if (response.ok) {
          await this.markEntitySynced(entity.id);
          synced++;
        } else {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Entity ${entity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { synced, failed, errors };
  }

  private async handleConflict(operation: SyncQueueItem, conflictData: any): Promise<void> {
    const resolution = this.determineConflictResolution(operation, conflictData);
    
    switch (resolution.strategy) {
      case 'overwrite':
        await offlineDB.queuePriorityOperation({
          ...operation,
          conflictResolution: 'overwrite'
        });
        break;
        
      case 'merge':
        const mergedData = this.mergeData(operation.data, conflictData);
        await offlineDB.queuePriorityOperation({
          ...operation,
          data: mergedData,
          conflictResolution: 'merge'
        });
        break;
        
      case 'skip':
        // Skip operation
        break;
    }
  }

  private determineConflictResolution(operation: SyncQueueItem, conflictData: any): ConflictResolution {
    if (operation.conflictResolution) {
      return { strategy: operation.conflictResolution };
    }

    if (operation.priority === 'critical') {
      return { strategy: 'overwrite' };
    }

    return { strategy: 'merge' };
  }

  private mergeData(localData: any, remoteData: any): any {
    return {
      ...remoteData,
      ...localData,
      lastModified: Date.now()
    };
  }

  private async handleSyncFailure(operation: SyncQueueItem, error: string): Promise<void> {
    const retryCount = (operation.retryCount || 0) + 1;
    const maxRetries = operation.maxRetries || 3;

    if (retryCount >= maxRetries) {
      voiceLogger.error('Max retries exceeded for operation', { operation, error });
      return;
    }

    const delay = Math.pow(2, retryCount) * 1000;
    
    const timeoutId = setTimeout(async () => {
      try {
        await offlineDB.queuePriorityOperation({
          ...operation,
          retryCount
        });
      } catch (retryError) {
        voiceLogger.error('Failed to re-queue operation', { operation, retryError });
      }
    }, delay);

    this.retryTimeouts.set(operation.id!, timeoutId);
  }

  private async markEntitySynced(entityId: string): Promise<void> {
    const entity = await offlineDB.getOfflineEntity(entityId);
    if (entity) {
      entity.syncStatus = 'synced';
      entity.lastModified = Date.now();
      await offlineDB.storeOfflineEntity(entity);
    }
  }

  private combineResults(results: PromiseSettledResult<Partial<SyncResult>>[]): SyncResult {
    let synced = 0;
    let failed = 0;
    let conflicts = 0;
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        synced += result.value.synced || 0;
        failed += result.value.failed || 0;
        conflicts += result.value.conflicts || 0;
        errors.push(...(result.value.errors || []));
      } else {
        failed += 1;
        errors.push(result.reason instanceof Error ? result.reason.message : 'Unknown error');
      }
    }

    return {
      success: failed === 0 && conflicts === 0,
      synced,
      failed,
      conflicts,
      errors
    };
  }

  // Public MVP methods
  async queueVoiceRecording(recording: VoiceRecording): Promise<void> {
    await offlineDB.storeVoiceRecording(recording);
    
    if (this.isOnline) {
      await this.syncVoiceRecordings({ batchSize: 1 });
    }
  }

  async queueImageData(imageData: ImageData): Promise<void> {
    await offlineDB.storeImageData(imageData);
    
    if (this.isOnline) {
      await this.syncImageData({ batchSize: 1 });
    }
  }

  async queuePriorityOperation(operation: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void> {
    await offlineDB.queuePriorityOperation(operation);
    
    if (this.isOnline && operation.priority === 'critical') {
      await this.syncPriorityOperations({ batchSize: 1, priorityOnly: true });
    }
  }

  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  async getSyncStats(): Promise<{
    pendingOperations: number;
    pendingVoice: number;
    pendingImages: number;
    pendingEntities: number;
  }> {
    const [operations, voice, images, entities] = await Promise.all([
      offlineDB.getPriorityOperations(1000),
      offlineDB.getPendingVoiceRecordings(),
      offlineDB.getPendingImageData(),
      offlineDB.getPendingOfflineEntities()
    ]);

    return {
      pendingOperations: operations.length,
      pendingVoice: voice.length,
      pendingImages: images.length,
      pendingEntities: entities.length
    };
  }
}

// Export singleton instance
export const syncManager = SyncManager.getInstance();