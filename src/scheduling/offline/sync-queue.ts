/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/sync-queue.ts
 * phase: 3
 * domain: scheduling
 * purpose: Queue and manage offline data synchronization
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 300
 * state_machine: idle -> syncing -> completed/failed/retry
 * estimated_llm_cost: 0.002
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/offline/scheduling-cache"
 *     - "@/scheduling/offline/conflict-resolver"
 *     - "@/scheduling/repositories/day-plan.repository"
 *     - "@/scheduling/repositories/schedule-event.repository"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - p-queue
 *   supabase:
 *     - all scheduling tables (sync)
 * exports:
 *   - SyncQueue
 *   - SyncOperation
 *   - SyncStatus
 * voice_considerations:
 *   - Voice feedback on sync progress
 *   - Simple sync status announcements
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/sync-queue.test.ts
 * tasks:
 *   - Implement sync queue with retry logic
 *   - Handle network detection
 *   - Process sync operations in order
 *   - Integrate conflict resolution
 *   - Track sync progress
 */

import PQueue from 'p-queue';
import { SchedulingOfflineDB, OfflineDayPlan, OfflineScheduleEvent, OfflineOverride } from '@/scheduling/offline/scheduling-cache';
import { ConflictResolver, UserRole } from '@/scheduling/offline/conflict-resolver';
import { DayPlanRepository } from '@/scheduling/repositories/day-plan.repository';
import { ScheduleEventRepository } from '@/scheduling/repositories/schedule-event.repository';
import { KitOverrideLogRepository } from '@/scheduling/repositories/kit-override-log.repository';
import { logger } from '@/core/logger/voice-logger';

export enum SyncOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CONFLICT = 'conflict'
}

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  entity: 'dayPlan' | 'scheduleEvent' | 'override' | 'voiceCommand';
  entityId: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  status: SyncStatus;
  error?: string;
  createdAt: Date;
  lastAttemptAt?: Date;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  conflicts: number;
}

export interface SyncOptions {
  maxConcurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
  onProgress?: (progress: SyncProgress) => void;
  onConflict?: (conflict: any) => void;
}

export class SyncQueue {
  private queue: PQueue;
  private operations: Map<string, SyncOperation> = new Map();
  private isOnline: boolean = navigator.onLine;
  private conflictResolver: ConflictResolver;
  private syncInProgress: boolean = false;
  
  private readonly defaultOptions: Required<SyncOptions> = {
    maxConcurrency: 3,
    retryDelay: 5000,
    maxRetries: 3,
    onProgress: () => {},
    onConflict: () => {}
  };

  constructor(
    private db: SchedulingOfflineDB,
    private dayPlanRepo: DayPlanRepository,
    private scheduleEventRepo: ScheduleEventRepository,
    private overrideRepo: KitOverrideLogRepository,
    private options: SyncOptions = {}
  ) {
    this.options = { ...this.defaultOptions, ...options };
    this.conflictResolver = new ConflictResolver(db);
    
    this.queue = new PQueue({
      concurrency: this.options.maxConcurrency,
      autoStart: false
    });

    this.setupNetworkListeners();
    this.loadPendingOperations();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      logger.info('Network online, starting sync');
      this.isOnline = true;
      this.startSync();
    });

    window.addEventListener('offline', () => {
      logger.info('Network offline, pausing sync');
      this.isOnline = false;
      this.queue.pause();
    });
  }

  private async loadPendingOperations(): Promise<void> {
    try {
      const pending = await this.db.getPendingSyncItems();
      
      // Create operations for day plans
      for (const dayPlan of pending.dayPlans) {
        this.addOperation({
          type: dayPlan.offline_created ? SyncOperationType.CREATE : SyncOperationType.UPDATE,
          entity: 'dayPlan',
          entityId: dayPlan.id,
          data: dayPlan
        });
      }

      // Create operations for schedule events
      for (const event of pending.scheduleEvents) {
        this.addOperation({
          type: event.offline_created ? SyncOperationType.CREATE : SyncOperationType.UPDATE,
          entity: 'scheduleEvent',
          entityId: event.id,
          data: event
        });
      }

      // Create operations for overrides
      for (const override of pending.overrides) {
        this.addOperation({
          type: SyncOperationType.CREATE,
          entity: 'override',
          entityId: override.id,
          data: override
        });
      }

      logger.info('Loaded pending sync operations', {
        count: this.operations.size,
        metadata: { voice: { summary: `${this.operations.size} items to sync` } }
      });
    } catch (error) {
      logger.error('Error loading pending operations', { error });
    }
  }

  addOperation(params: {
    type: SyncOperationType;
    entity: SyncOperation['entity'];
    entityId: string;
    data: any;
  }): void {
    const operation: SyncOperation = {
      id: `${params.entity}_${params.entityId}_${Date.now()}`,
      type: params.type,
      entity: params.entity,
      entityId: params.entityId,
      data: params.data,
      attempts: 0,
      maxAttempts: this.options.maxRetries,
      status: SyncStatus.PENDING,
      createdAt: new Date()
    };

    this.operations.set(operation.id, operation);
    
    if (this.isOnline && !this.syncInProgress) {
      this.startSync();
    }
  }

  async startSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    logger.info('Starting sync queue');

    // Add all pending operations to queue
    for (const operation of this.operations.values()) {
      if (operation.status === SyncStatus.PENDING || operation.status === SyncStatus.FAILED) {
        this.queue.add(() => this.processOperation(operation));
      }
    }

    this.queue.start();

    // Wait for queue to be empty
    await this.queue.onIdle();
    
    this.syncInProgress = false;
    logger.info('Sync queue completed');
    
    this.reportProgress();
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    if (!this.isOnline) {
      logger.debug('Skipping operation - offline', { operationId: operation.id });
      return;
    }

    try {
      operation.status = SyncStatus.IN_PROGRESS;
      operation.lastAttemptAt = new Date();
      operation.attempts++;

      logger.debug('Processing sync operation', {
        type: operation.type,
        entity: operation.entity,
        entityId: operation.entityId
      });

      switch (operation.entity) {
        case 'dayPlan':
          await this.syncDayPlan(operation);
          break;
        case 'scheduleEvent':
          await this.syncScheduleEvent(operation);
          break;
        case 'override':
          await this.syncOverride(operation);
          break;
        case 'voiceCommand':
          await this.syncVoiceCommand(operation);
          break;
      }

      operation.status = SyncStatus.COMPLETED;
      await this.handleSuccessfulSync(operation);

    } catch (error: any) {
      logger.error('Sync operation failed', { error, operation });
      
      if (error.code === 'CONFLICT') {
        operation.status = SyncStatus.CONFLICT;
        await this.handleConflict(operation, error.data);
      } else if (operation.attempts < operation.maxAttempts) {
        operation.status = SyncStatus.FAILED;
        operation.error = error.message;
        
        // Retry after delay
        setTimeout(() => {
          if (this.isOnline) {
            this.queue.add(() => this.processOperation(operation));
          }
        }, this.options.retryDelay * operation.attempts);
      } else {
        operation.status = SyncStatus.FAILED;
        operation.error = 'Max retries exceeded';
      }
    }

    this.reportProgress();
  }

  private async syncDayPlan(operation: SyncOperation): Promise<void> {
    const dayPlan = operation.data as OfflineDayPlan;

    if (operation.type === SyncOperationType.CREATE) {
      // Remove offline ID and create on server
      const serverData = this.prepareForServer(dayPlan);
      const created = await this.dayPlanRepo.create(serverData);
      
      // Update local with server ID
      await this.db.dayPlans.delete(dayPlan.id);
      dayPlan.id = created.id;
      await this.db.saveDayPlan(dayPlan);
    } else {
      // Check for conflicts
      const serverData = await this.dayPlanRepo.findById(dayPlan.id);
      
      if (serverData && this.hasConflict(dayPlan, serverData)) {
        throw { code: 'CONFLICT', data: serverData };
      }

      await this.dayPlanRepo.update(dayPlan.id, this.prepareForServer(dayPlan));
    }
  }

  private async syncScheduleEvent(operation: SyncOperation): Promise<void> {
    const event = operation.data as OfflineScheduleEvent;

    if (operation.type === SyncOperationType.CREATE) {
      const serverData = this.prepareForServer(event);
      const created = await this.scheduleEventRepo.create(serverData);
      
      await this.db.scheduleEvents.delete(event.id);
      event.id = created.id;
      await this.db.saveScheduleEvent(event);
    } else {
      const serverData = await this.scheduleEventRepo.findById(event.id);
      
      if (serverData && this.hasConflict(event, serverData)) {
        throw { code: 'CONFLICT', data: serverData };
      }

      await this.scheduleEventRepo.update(event.id, this.prepareForServer(event));
    }
  }

  private async syncOverride(operation: SyncOperation): Promise<void> {
    const override = operation.data as OfflineOverride;
    await this.overrideRepo.create(this.prepareForServer(override));
  }

  private async syncVoiceCommand(operation: SyncOperation): Promise<void> {
    // Voice commands are processed differently
    // They might trigger other operations
    logger.info('Voice command sync not implemented yet', { operation });
  }

  private hasConflict(local: any, remote: any): boolean {
    // Simple conflict detection - can be enhanced
    return new Date(local.updated_at) < new Date(remote.updated_at);
  }

  private async handleConflict(operation: SyncOperation, remoteData: any): Promise<void> {
    const context = {
      type: 'SCHEDULE_UPDATE' as any,
      localData: operation.data,
      remoteData,
      localTimestamp: new Date(operation.data.updated_at),
      remoteTimestamp: new Date(remoteData.updated_at),
      localRole: UserRole.TECHNICIAN, // Would get from context
      remoteRole: UserRole.SYSTEM
    };

    const resolution = await this.conflictResolver.resolveConflict(context);
    
    if (resolution.autoResolved) {
      await this.conflictResolver.applyResolution(
        resolution,
        operation.entity,
        operation.entityId
      );
      operation.status = SyncStatus.COMPLETED;
    } else {
      this.options.onConflict({
        operation,
        resolution,
        localData: operation.data,
        remoteData
      });
    }
  }

  private async handleSuccessfulSync(operation: SyncOperation): Promise<void> {
    // Mark as synced in offline DB
    const table = operation.entity === 'dayPlan' ? 'dayPlans' : 
                  operation.entity === 'scheduleEvent' ? 'scheduleEvents' :
                  'overrides';
    
    await this.db.markSynced(table, operation.entityId);
    
    // Remove from operations
    this.operations.delete(operation.id);
  }

  private prepareForServer(data: any): any {
    const serverData = { ...data };
    
    // Remove offline-specific fields
    delete serverData.offline_created;
    delete serverData.offline_modified;
    delete serverData.sync_status;
    delete serverData.last_synced;
    
    // Remove offline ID prefix if present
    if (serverData.id && serverData.id.includes('_offline_')) {
      delete serverData.id;
    }

    return serverData;
  }

  private reportProgress(): void {
    const progress: SyncProgress = {
      total: this.operations.size,
      completed: 0,
      failed: 0,
      inProgress: 0,
      conflicts: 0
    };

    for (const operation of this.operations.values()) {
      switch (operation.status) {
        case SyncStatus.COMPLETED:
          progress.completed++;
          break;
        case SyncStatus.FAILED:
          progress.failed++;
          break;
        case SyncStatus.IN_PROGRESS:
          progress.inProgress++;
          break;
        case SyncStatus.CONFLICT:
          progress.conflicts++;
          break;
      }
    }

    this.options.onProgress(progress);

    logger.debug('Sync progress', {
      ...progress,
      metadata: { 
        voice: { 
          summary: `${progress.completed} synced, ${this.operations.size - progress.completed} remaining` 
        }
      }
    });
  }

  async pauseSync(): Promise<void> {
    this.queue.pause();
    logger.info('Sync queue paused');
  }

  async resumeSync(): Promise<void> {
    if (this.isOnline) {
      this.queue.start();
      logger.info('Sync queue resumed');
    }
  }

  async clearCompleted(): Promise<void> {
    const completed = Array.from(this.operations.entries())
      .filter(([_, op]) => op.status === SyncStatus.COMPLETED)
      .map(([id]) => id);

    for (const id of completed) {
      this.operations.delete(id);
    }

    logger.info('Cleared completed operations', { count: completed.length });
  }

  getSyncStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    progress: SyncProgress;
    operations: SyncOperation[];
  } {
    const progress: SyncProgress = {
      total: this.operations.size,
      completed: 0,
      failed: 0,
      inProgress: 0,
      conflicts: 0
    };

    const operations = Array.from(this.operations.values());

    for (const operation of operations) {
      switch (operation.status) {
        case SyncStatus.COMPLETED:
          progress.completed++;
          break;
        case SyncStatus.FAILED:
          progress.failed++;
          break;
        case SyncStatus.IN_PROGRESS:
          progress.inProgress++;
          break;
        case SyncStatus.CONFLICT:
          progress.conflicts++;
          break;
      }
    }

    return {
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
      progress,
      operations: operations.slice(0, 10) // Return first 10 for UI
    };
  }

  generateVoiceStatus(): string {
    const status = this.getSyncStatus();
    
    if (!status.isOnline) {
      return 'Working offline';
    }

    if (status.isSyncing) {
      return `Syncing ${status.progress.total} items`;
    }

    if (status.progress.failed > 0) {
      return `${status.progress.failed} items failed to sync`;
    }

    if (status.progress.conflicts > 0) {
      return `${status.progress.conflicts} conflicts need resolution`;
    }

    return 'All synced';
  }
}