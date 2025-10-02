/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/intent/repositories/offline-sync-queue.repository.ts
 * phase: 3
 * domain: intent
 * purpose: Repository for managing offline sync queue operations
 * spec_ref: 007-mvp-intent-driven/contracts/sync-api.md
 * complexity_budget: 300
 * migrations_touched: ['042_offline_sync_queue.sql']
 * state_machine: {
 *   states: ['pending', 'syncing', 'completed', 'failed', 'expired'],
 *   transitions: [
 *     'pending->syncing: startSync()',
 *     'syncing->completed: syncSuccess()',
 *     'syncing->failed: syncError()',
 *     'failed->pending: retry()',
 *     'failed->expired: maxRetriesReached()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "queue": "$0.00 (local storage)",
 *   "sync": "$0.00-0.10 (depends on payload)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/core/errors/error-types', '@/lib/offline/offline-db'],
 *   external: ['@supabase/supabase-js'],
 *   supabase: ['offline_sync_queue table']
 * }
 * exports: ['OfflineSyncQueueRepository', 'SyncQueueItem', 'SyncStatus', 'SyncPriority']
 * voice_considerations: Voice commands queued offline get high priority sync
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/intent/repositories/offline-sync-queue.test.ts',
 *   integration_tests: 'tests/integration/offline-sync.test.ts'
 * }
 * tasks: [
 *   'Define sync queue types and priorities',
 *   'Implement queue management with retry logic',
 *   'Add batch sync capabilities',
 *   'Implement conflict resolution helpers'
 * ]
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AppError } from '@/core/errors/error-types';

export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'expired';
export type SyncPriority = 'critical' | 'high' | 'medium' | 'low';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id: string;
  tenantId: string;
  userId: string;
  createdAt: Date;
  operation: SyncOperation;
  entity: string;
  entityId?: string | null;
  data: any; // JSONB payload
  priority: SyncPriority;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: Date | null;
  completedAt?: Date | null;
  error?: string | null;
  conflictResolution?: 'overwrite' | 'merge' | 'skip' | null;
  metadata?: Record<string, any> | null;
}

export interface CreateSyncQueueItemDto {
  userId: string;
  operation: SyncOperation;
  entity: string;
  entityId?: string | null;
  data: any;
  priority?: SyncPriority;
  maxRetries?: number;
  conflictResolution?: 'overwrite' | 'merge' | 'skip';
  metadata?: Record<string, any> | null;
}

export interface SyncResult {
  successful: string[];
  failed: string[];
  conflicts: Array<{
    id: string;
    reason: string;
    resolution: 'overwrite' | 'merge' | 'skip';
  }>;
}

export class OfflineSyncQueueRepository {
  private readonly MAX_BATCH_SIZE = 50;
  private readonly DEFAULT_MAX_RETRIES = 3;

  /**
   * Add item to sync queue
   */
  async enqueue(
    data: CreateSyncQueueItemDto,
    tenantId: string
  ): Promise<SyncQueueItem> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: item, error } = await supabase
        .from('offline_sync_queue')
        .insert({
          tenant_id: tenantId,
          user_id: data.userId,
          operation: data.operation,
          entity: data.entity,
          entity_id: data.entityId,
          data: data.data,
          priority: data.priority || 'medium',
          status: 'pending',
          retry_count: 0,
          max_retries: data.maxRetries || this.DEFAULT_MAX_RETRIES,
          conflict_resolution: data.conflictResolution,
          metadata: data.metadata
        })
        .select()
        .single();

      if (error) {
        throw new AppError('Failed to enqueue sync item', {
          code: 'SYNC_ENQUEUE_ERROR',
          details: error
        });
      }

      return this.mapToModel(item);
    } catch (error) {
      throw new AppError('Failed to enqueue sync item', {
        code: 'SYNC_ENQUEUE_ERROR',
        details: error
      });
    }
  }

  /**
   * Get pending items for sync
   */
  async getPendingItems(
    tenantId: string,
    limit?: number
  ): Promise<SyncQueueItem[]> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { data: items, error } = await supabase
        .from('offline_sync_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'failed'])
        .lt('retry_count', supabase.sql`max_retries`)
        .order('priority', { ascending: true }) // critical first
        .order('created_at', { ascending: true })
        .limit(limit || this.MAX_BATCH_SIZE);

      if (error) {
        throw new AppError('Failed to fetch pending items', {
          code: 'SYNC_FETCH_ERROR',
          details: error
        });
      }

      return items.map(this.mapToModel);
    } catch (error) {
      throw new AppError('Failed to fetch pending items', {
        code: 'SYNC_FETCH_ERROR',
        details: error
      });
    }
  }

  /**
   * Mark item as syncing
   */
  async markAsSyncing(
    id: string,
    tenantId: string
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { error } = await supabase
        .from('offline_sync_queue')
        .update({
          status: 'syncing',
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new AppError('Failed to update sync status', {
          code: 'SYNC_UPDATE_ERROR',
          details: error
        });
      }
    } catch (error) {
      throw new AppError('Failed to update sync status', {
        code: 'SYNC_UPDATE_ERROR',
        details: error
      });
    }
  }

  /**
   * Mark item as completed
   */
  async markAsCompleted(
    id: string,
    tenantId: string
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { error } = await supabase
        .from('offline_sync_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new AppError('Failed to mark as completed', {
          code: 'SYNC_UPDATE_ERROR',
          details: error
        });
      }
    } catch (error) {
      throw new AppError('Failed to mark as completed', {
        code: 'SYNC_UPDATE_ERROR',
        details: error
      });
    }
  }

  /**
   * Mark item as failed with error
   */
  async markAsFailed(
    id: string,
    tenantId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const { error } = await supabase
        .from('offline_sync_queue')
        .update({
          status: 'failed',
          error: errorMessage,
          retry_count: supabase.sql`retry_count + 1`
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new AppError('Failed to mark as failed', {
          code: 'SYNC_UPDATE_ERROR',
          details: error
        });
      }

      // Check if max retries reached and mark as expired
      const { data: item } = await supabase
        .from('offline_sync_queue')
        .select('retry_count, max_retries')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (item && item.retry_count >= item.max_retries) {
        await supabase
          .from('offline_sync_queue')
          .update({ status: 'expired' })
          .eq('id', id)
          .eq('tenant_id', tenantId);
      }
    } catch (error) {
      throw new AppError('Failed to mark as failed', {
        code: 'SYNC_UPDATE_ERROR',
        details: error
      });
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(tenantId: string): Promise<{
    pending: number;
    syncing: number;
    completed: number;
    failed: number;
    expired: number;
    oldestPending?: Date;
  }> {
    try {
      const supabase = await createServerSupabaseClient();
      
      // Get counts by status
      const { data: counts, error } = await supabase
        .from('offline_sync_queue')
        .select('status, count')
        .eq('tenant_id', tenantId)
        .groupBy('status');

      if (error) {
        throw new AppError('Failed to fetch sync stats', {
          code: 'SYNC_STATS_ERROR',
          details: error
        });
      }

      const stats = {
        pending: 0,
        syncing: 0,
        completed: 0,
        failed: 0,
        expired: 0,
        oldestPending: undefined as Date | undefined
      };

      // Aggregate counts
      counts.forEach((row: any) => {
        stats[row.status as keyof typeof stats] = parseInt(row.count);
      });

      // Get oldest pending item
      if (stats.pending > 0) {
        const { data: oldest } = await supabase
          .from('offline_sync_queue')
          .select('created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (oldest) {
          stats.oldestPending = new Date(oldest.created_at);
        }
      }

      return stats;
    } catch (error) {
      throw new AppError('Failed to fetch sync stats', {
        code: 'SYNC_STATS_ERROR',
        details: error
      });
    }
  }

  /**
   * Clear completed items older than specified days
   */
  async clearCompleted(
    tenantId: string,
    olderThanDays: number = 7
  ): Promise<number> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await supabase
        .from('offline_sync_queue')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .lt('completed_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new AppError('Failed to clear completed items', {
          code: 'SYNC_CLEAR_ERROR',
          details: error
        });
      }

      return data?.length || 0;
    } catch (error) {
      throw new AppError('Failed to clear completed items', {
        code: 'SYNC_CLEAR_ERROR',
        details: error
      });
    }
  }

  /**
   * Get items by entity type
   */
  async getByEntity(
    tenantId: string,
    entity: string,
    status?: SyncStatus
  ): Promise<SyncQueueItem[]> {
    try {
      const supabase = await createServerSupabaseClient();
      
      let query = supabase
        .from('offline_sync_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity', entity)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: items, error } = await query;

      if (error) {
        throw new AppError('Failed to fetch items by entity', {
          code: 'SYNC_FETCH_ERROR',
          details: error
        });
      }

      return items.map(this.mapToModel);
    } catch (error) {
      throw new AppError('Failed to fetch items by entity', {
        code: 'SYNC_FETCH_ERROR',
        details: error
      });
    }
  }

  /**
   * Batch update status for multiple items
   */
  async batchUpdateStatus(
    tenantId: string,
    itemIds: string[],
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      
      const updates: any = { status };
      
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
      
      if (error) {
        updates.error = error;
      }

      const { error: updateError } = await supabase
        .from('offline_sync_queue')
        .update(updates)
        .eq('tenant_id', tenantId)
        .in('id', itemIds);

      if (updateError) {
        throw new AppError('Failed to batch update status', {
          code: 'SYNC_BATCH_UPDATE_ERROR',
          details: updateError
        });
      }
    } catch (error) {
      throw new AppError('Failed to batch update status', {
        code: 'SYNC_BATCH_UPDATE_ERROR',
        details: error
      });
    }
  }

  /**
   * Map database row to model
   */
  private mapToModel(row: any): SyncQueueItem {
    const priorityMap: Record<string, SyncPriority> = {
      '1': 'critical',
      '2': 'high',
      '3': 'medium',
      '4': 'low'
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      operation: row.operation as SyncOperation,
      entity: row.entity,
      entityId: row.entity_id,
      data: row.data,
      priority: priorityMap[row.priority] || row.priority as SyncPriority,
      status: row.status as SyncStatus,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      error: row.error,
      conflictResolution: row.conflict_resolution,
      metadata: row.metadata
    };
  }
}