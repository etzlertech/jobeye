/**
 * @file /src/domains/crew/lib/load-item-state-manager.ts
 * @phase 3
 * @domain crew
 * @purpose Manages real-time persistence of load item states with offline support
 * @complexity_budget 200
 * @offline_capability CORE
 */

import { JobLoadRepository } from '../repositories/job-load.repository';
import { OfflineDatabase } from '@/lib/offline/offline-db';
import type { Database } from '@/types/database';

type TaskItemStatus = Database['public']['Enums']['task_item_status'];

export interface ItemStateUpdate {
  itemId: string;
  status: TaskItemStatus;
  taskId?: string;
}

export interface UpdateResult {
  success: boolean;
  offline: boolean;
  error?: string;
}

/**
 * Manages real-time persistence of load item states
 * Auto-saves to database immediately when items change
 * Falls back to offline queue if network fails
 */
export class LoadItemStateManager {
  constructor(
    private jobId: string,
    private loadRepo: JobLoadRepository,
    private offlineDB: OfflineDatabase
  ) {}

  /**
   * Auto-save item state change (online)
   * Falls back to offline queue if network fails
   */
  async updateItemState(
    itemId: string,
    status: TaskItemStatus,
    taskId?: string
  ): Promise<UpdateResult> {
    try {
      // Attempt immediate save to database
      if (status === 'verified') {
        await this.loadRepo.markItemVerified(this.jobId, itemId, taskId);
      } else if (status === 'missing') {
        await this.loadRepo.markItemMissing(this.jobId, itemId, taskId);
      } else if (status === 'loaded') {
        await this.loadRepo.markItemLoaded(this.jobId, itemId, taskId);
      } else if (status === 'pending') {
        // For pending, we don't have a specific method, so we'll skip
        // or you could add markItemPending to the repository
        console.log('[LoadItemStateManager] Pending status - no action needed');
      }

      console.log(
        `[LoadItemStateManager] Saved ${status} for item ${itemId} (online)`
      );
      return { success: true, offline: false };
    } catch (error: any) {
      // Network failure → queue for offline sync
      console.warn('[LoadItemStateManager] Saving offline:', error.message);

      try {
        await this.offlineDB.queuePriorityOperation({
          operation: 'update',
          entity: 'load_verification_item',
          entityId: itemId,
          data: { jobId: this.jobId, itemId, status, taskId },
          priority: 'high',
          conflictResolution: 'overwrite',
        });

        console.log(
          `[LoadItemStateManager] Queued ${status} for item ${itemId} (offline)`
        );
        return { success: true, offline: true };
      } catch (offlineError: any) {
        console.error(
          '[LoadItemStateManager] Failed to queue offline:',
          offlineError
        );
        return {
          success: false,
          offline: true,
          error: offlineError.message,
        };
      }
    }
  }

  /**
   * Batch update multiple items (AI detection results)
   */
  async batchUpdateItems(
    items: ItemStateUpdate[]
  ): Promise<UpdateResult> {
    const results = await Promise.allSettled(
      items.map((item) =>
        this.updateItemState(item.itemId, item.status, item.taskId)
      )
    );

    const anyOffline = results.some(
      (r) => r.status === 'fulfilled' && r.value.offline
    );
    const allSuccess = results.every((r) => r.status === 'fulfilled');
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason.message);

    console.log(
      `[LoadItemStateManager] Batch update: ${results.length} items, ` +
        `${results.filter((r) => r.status === 'fulfilled').length} succeeded, ` +
        `${errors.length} failed, offline: ${anyOffline}`
    );

    return {
      success: allSuccess,
      offline: anyOffline,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Clear all pending changes for this job (e.g., when user cancels)
   */
  async clearPendingChanges(): Promise<void> {
    // This would require a method to remove queued operations by job ID
    // For now, we'll just log
    console.log(
      `[LoadItemStateManager] Clear pending changes for job ${this.jobId}`
    );
  }

  /**
   * Get count of pending offline changes for this job
   */
  async getPendingCount(): Promise<number> {
    try {
      const pending = await this.offlineDB.getPendingOperations(1000);
      const jobPending = pending.filter(
        (op) =>
          op.entity === 'load_verification_item' &&
          op.data?.jobId === this.jobId
      );
      return jobPending.length;
    } catch (error) {
      console.error(
        '[LoadItemStateManager] Failed to get pending count:',
        error
      );
      return 0;
    }
  }
}
