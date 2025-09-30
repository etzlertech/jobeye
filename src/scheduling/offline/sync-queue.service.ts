/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/offline/sync-queue.service.ts
 * phase: 3
 * domain: Scheduling Core
 * purpose: Manage offline sync queue with retry logic
 * spec_ref: 003-scheduling-kits/offline-support.md
 * complexity_budget: 300
 * state_machine: pending -> syncing -> completed/failed
 * estimated_llm_cost: 0.02
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - IndexedDBService
 *     - types/offline.types
 *   external: []
 * exports:
 *   - SyncQueueService
 * voice_considerations: none
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/scheduling/offline/__tests__/sync-queue.test.ts
 */

import { createLogger } from '@/core/logger/logger';
import { IndexedDBService } from './indexed-db.service';
import { SyncQueueEntry, OperationType, SyncStatus } from './types/offline.types';

const logger = createLogger('SyncQueueService');

const MAX_RETRY_ATTEMPTS = 3;
const SYNC_BATCH_SIZE = 10;
const CLEANUP_AGE_DAYS = 7;

export class SyncQueueService {
  private dbService: IndexedDBService;
  private isSyncing = false;
  private initialized = false;

  constructor(dbService?: IndexedDBService) {
    this.dbService = dbService || new IndexedDBService();
    // Auto-initialize if not provided
    if (!dbService) {
      this.init().catch(err => logger.error('Failed to auto-initialize', { error: err }));
    } else {
      this.initialized = true;
    }
  }

  async init(): Promise<void> {
    if (!this.initialized) {
      await this.dbService.init();
      this.initialized = true;
      logger.info('SyncQueueService initialized');
    }
  }

  async enqueue(
    operation: Omit<SyncQueueEntry, 'id' | 'created_at' | 'attempts'>
  ): Promise<number> {
    await this.ensureInitialized();

    const entry: any = {
      ...operation,
      created_at: new Date().toISOString(),
      attempts: 0,
      status: operation.status || 'pending'
    };

    const id = await this.dbService.add(this.dbService.syncQueueStore, entry);
    logger.info('Operation enqueued', { id, operation_type: operation.operation_type });

    return id as number;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  async getPendingOperations(): Promise<SyncQueueEntry[]> {
    await this.ensureInitialized();

    const entries = await this.dbService.getAllByIndex<SyncQueueEntry>(
      this.dbService.syncQueueStore,
      'status',
      'pending'
    );

    return entries.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  async getAllOperations(): Promise<SyncQueueEntry[]> {
    await this.ensureInitialized();
    return this.dbService.getAll<SyncQueueEntry>(this.dbService.syncQueueStore);
  }

  async processSyncQueue(
    processor?: (entry: SyncQueueEntry) => Promise<any>
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    await this.ensureInitialized();

    if (this.isSyncing) {
      logger.warn('Sync already in progress');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      logger.info('Device is offline, skipping sync');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isSyncing = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      const pendingOps = await this.getPendingOperations();
      const batch = pendingOps.slice(0, SYNC_BATCH_SIZE);

      logger.info('Processing sync batch', {
        totalPending: pendingOps.length,
        batchSize: batch.length
      });

      for (const entry of batch) {
        processed++;

        try {
          // Use provided processor or default simulation
          if (processor) {
            await processor(entry);
          } else {
            await this.syncOperation(entry);
          }

          // Mark as synced
          await this.updateStatus(entry.id!, 'synced');
          succeeded++;

          logger.info('Operation synced successfully', {
            id: entry.id,
            operation_type: entry.operation_type
          });
        } catch (error: any) {
          // First, increment attempts
          await this.incrementAttempts(entry.id!, error.message || String(error));
          const attempts = entry.attempts + 1;

          if (attempts >= MAX_RETRY_ATTEMPTS) {
            // Max retries reached, mark as failed
            await this.updateStatus(entry.id!, 'failed');
            failed++;

            logger.error('Operation failed after max retries', {
              id: entry.id,
              attempts,
              error
            });
          } else {
            logger.warn('Operation failed, will retry', {
              id: entry.id,
              attempts,
              error
            });
          }
        }
      }

      return { processed, succeeded, failed };
    } finally {
      this.isSyncing = false;
    }
  }

  async detectConflicts(): Promise<Array<{
    entity_id: string;
    entity_type: string;
    operations: SyncQueueEntry[];
  }>> {
    await this.ensureInitialized();
    const allOps = await this.getAllOperations();

    // Group by entity
    const entityGroups = new Map<string, SyncQueueEntry[]>();

    for (const op of allOps) {
      if (op.status !== 'pending') continue;

      const key = `${op.entity_type}:${op.entity_id}`;
      if (!entityGroups.has(key)) {
        entityGroups.set(key, []);
      }
      entityGroups.get(key)!.push(op);
    }

    // Find entities with multiple pending operations (conflicts)
    const conflicts: Array<{
      entity_id: string;
      entity_type: string;
      operations: SyncQueueEntry[];
    }> = [];

    for (const [key, operations] of entityGroups) {
      if (operations.length > 1) {
        const [entity_type, entity_id] = key.split(':');
        conflicts.push({
          entity_id,
          entity_type,
          operations
        });
      }
    }

    return conflicts;
  }

  async cleanup(): Promise<number> {
    await this.ensureInitialized();
    const allOps = await this.getAllOperations();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_AGE_DAYS);

    let cleaned = 0;

    for (const entry of allOps) {
      const entryDate = entry.synced_at ? new Date(entry.synced_at) : new Date(entry.created_at);

      if (
        entry.status === 'synced' &&
        entryDate < cutoffDate
      ) {
        await this.dbService.delete(this.dbService.syncQueueStore, entry.id!);
        cleaned++;
      }
    }

    logger.info('Cleanup completed', { removed: cleaned });
    return cleaned;
  }

  private async syncOperation(entry: SyncQueueEntry): Promise<void> {
    // In a real implementation, this would call the actual API
    // For now, simulate sync with a delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate random failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Simulated sync failure');
    }
  }

  private async updateStatus(id: number, status: SyncStatus): Promise<void> {
    const entry = await this.dbService.get<SyncQueueEntry>(
      this.dbService.syncQueueStore,
      id
    );

    if (entry) {
      entry.status = status;
      await this.dbService.put(this.dbService.syncQueueStore, entry);
    }
  }

  private async incrementAttempts(id: number, errorMessage?: string): Promise<void> {
    const entry = await this.dbService.get<SyncQueueEntry>(
      this.dbService.syncQueueStore,
      id
    );

    if (entry) {
      entry.attempts++;
      if (errorMessage) {
        entry.last_error = errorMessage;
      }
      await this.dbService.put(this.dbService.syncQueueStore, entry);
    }
  }
}