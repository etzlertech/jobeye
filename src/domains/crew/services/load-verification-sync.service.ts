/**
 * @file /src/domains/crew/services/load-verification-sync.service.ts
 * @phase 3
 * @domain crew
 * @purpose Syncs offline load verification changes to server
 * @complexity_budget 250
 * @offline_capability CORE
 */

import { OfflineDatabase } from '@/lib/offline/offline-db';
import { JobLoadRepository } from '../repositories/job-load.repository';
import { createServerClient } from '@/lib/supabase/server';

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Syncs offline load verification changes to server
 * Runs automatically when network returns
 */
export class LoadVerificationSyncService {
  private offlineDB: OfflineDatabase;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  constructor() {
    this.offlineDB = OfflineDatabase.getInstance();
  }

  /**
   * Sync all pending load item state changes
   */
  async syncPendingChanges(): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('[LoadVerificationSync] Already syncing, skipping...');
      return { synced: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;

    try {
      await this.offlineDB.initialize();
      const pending = await this.offlineDB.getPendingLoadItemStates();

      console.log(
        `[LoadVerificationSync] Found ${pending.length} pending items`
      );

      if (pending.length === 0) {
        return { synced: 0, failed: 0, errors: [] };
      }

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      // Create Supabase client
      const supabase = await createServerClient();

      for (const item of pending) {
        try {
          // Create repository instance
          const loadRepo = new JobLoadRepository(supabase as any);

          // Apply change to database
          if (item.status === 'verified') {
            await loadRepo.markItemVerified(
              item.jobId,
              item.itemId,
              item.taskId
            );
          } else if (item.status === 'missing') {
            await loadRepo.markItemMissing(
              item.jobId,
              item.itemId,
              item.taskId
            );
          } else if (item.status === 'loaded') {
            await loadRepo.markItemLoaded(
              item.jobId,
              item.itemId,
              item.taskId
            );
          }

          // Mark as synced
          await this.offlineDB.updateLoadItemStateStatus(item.id, 'synced');

          synced++;
          console.log(
            `[LoadVerificationSync] Synced item ${item.itemId} (${item.status})`
          );
        } catch (error: any) {
          failed++;
          const errorMsg = `${item.itemId}: ${error.message}`;
          errors.push(errorMsg);

          console.error(
            `[LoadVerificationSync] Failed to sync item ${item.itemId}:`,
            error
          );

          // Update error status
          try {
            await this.offlineDB.updateLoadItemStateStatus(item.id, 'error');
          } catch (updateError) {
            console.error(
              '[LoadVerificationSync] Failed to update error status:',
              updateError
            );
          }
        }
      }

      console.log(
        `[LoadVerificationSync] Sync complete: ${synced} synced, ${failed} failed`
      );

      return { synced, failed, errors };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start auto-sync when online
   */
  startAutoSync(intervalMs: number = 30000): void {
    if (typeof window === 'undefined') {
      console.warn(
        '[LoadVerificationSync] Cannot start auto-sync in server environment'
      );
      return;
    }

    if (this.syncIntervalId) {
      console.log('[LoadVerificationSync] Auto-sync already running');
      return;
    }

    console.log(
      `[LoadVerificationSync] Starting auto-sync (interval: ${intervalMs}ms)`
    );

    // Sync when coming online
    const handleOnline = () => {
      console.log('[LoadVerificationSync] Network online - syncing...');
      this.syncPendingChanges()
        .then((result) => {
          if (result.synced > 0) {
            console.log(
              `[LoadVerificationSync] Synced ${result.synced} items on reconnect`
            );
          }
          if (result.failed > 0) {
            console.warn(
              `[LoadVerificationSync] Failed ${result.failed} items:`,
              result.errors
            );
          }
        })
        .catch((error) => {
          console.error('[LoadVerificationSync] Auto-sync failed:', error);
        });
    };

    window.addEventListener('online', handleOnline);

    // Also run periodic sync
    this.syncIntervalId = setInterval(() => {
      if (navigator.onLine) {
        this.syncPendingChanges().catch((error) => {
          console.error('[LoadVerificationSync] Periodic sync failed:', error);
        });
      }
    }, intervalMs);

    // Initial sync if online
    if (navigator.onLine) {
      setTimeout(() => {
        this.syncPendingChanges().catch((error) => {
          console.error('[LoadVerificationSync] Initial sync failed:', error);
        });
      }, 1000); // Wait 1 second for app initialization
    }
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      console.log('[LoadVerificationSync] Auto-sync stopped');
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }
  }

  /**
   * Get count of pending items
   */
  async getPendingCount(jobId?: string): Promise<number> {
    try {
      await this.offlineDB.initialize();
      const pending = await this.offlineDB.getPendingLoadItemStates(jobId);
      return pending.length;
    } catch (error) {
      console.error(
        '[LoadVerificationSync] Failed to get pending count:',
        error
      );
      return 0;
    }
  }

  /**
   * Handle online event (bound method for removeEventListener)
   */
  private handleOnline = () => {
    console.log('[LoadVerificationSync] Network online - syncing...');
    this.syncPendingChanges().catch((error) => {
      console.error('[LoadVerificationSync] Sync on online event failed:', error);
    });
  };
}

/**
 * Singleton instance
 */
let syncServiceInstance: LoadVerificationSyncService | null = null;

export function getLoadVerificationSyncService(): LoadVerificationSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new LoadVerificationSyncService();
  }
  return syncServiceInstance;
}
