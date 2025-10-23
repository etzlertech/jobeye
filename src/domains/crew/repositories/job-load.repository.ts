/**
 * JobLoadRepository
 *
 * Handles job load verification by managing item assignments and status tracking.
 *
 * Data Source:
 * - Primary: item_transactions (check_out/check_in transactions)
 * - Status tracking: Inferred from latest transaction type per item
 *
 * @see JOB_LOAD_REFACTOR_PLAN.md for architecture details
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type TaskItemStatus = Database['public']['Enums']['task_item_status'];
type ItemType = Database['public']['Enums']['item_type'];

export interface JobLoadItem {
  id: string;
  name: string;
  item_type: ItemType;
  quantity: number;
  is_required: boolean;
  status: TaskItemStatus;
  task_id: string | null;
  task_title: string | null;
  source: 'table' | 'jsonb';
}

export interface LoadVerificationSummary {
  total_required: number;
  loaded_count: number;
  verified_count: number;
  missing_count: number;
  is_ready_to_verify: boolean;
  is_fully_verified: boolean;
}

export class JobLoadRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get all required items for a job
   * Reads from item_transactions (primary source of truth)
   */
  async getRequiredItems(jobId: string): Promise<JobLoadItem[]> {
    // Read from item_transactions (primary source)
    const { data: transactions, error: txError } = await this.supabase
      .from('item_transactions')
      .select(`
        id,
        item_id,
        transaction_type,
        quantity,
        created_at,
        items!inner(
          id,
          name,
          item_type,
          category
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('[JobLoadRepository] Error fetching item transactions:', txError);
      return [];
    }

    // Group by item_id to get latest status per item
    const itemsMap = new Map<string, any>();
    (transactions || []).forEach((tx: any) => {
      if (!itemsMap.has(tx.item_id)) {
        itemsMap.set(tx.item_id, {
          id: tx.items.id,
          name: tx.items.name,
          item_type: tx.items.item_type,
          quantity: tx.quantity,
          is_required: true, // All items in transactions are required
          status: tx.transaction_type === 'check_in' ? 'pending' : 'loaded',
          task_id: null,
          task_title: null,
          source: 'table' as const,
        });
      }
    });

    // Filter to only show currently assigned items (not returned)
    const items: JobLoadItem[] = Array.from(itemsMap.values())
      .filter(item => item.status === 'loaded');

    console.log(`[JobLoadRepository] Found ${items.length} items from item_transactions for job ${jobId}`);

    return items;
  }

  /**
   * Mark an item as loaded
   * Updates status in workflow_task_item_associations if exists
   */
  async markItemLoaded(
    jobId: string,
    itemId: string,
    taskId?: string
  ): Promise<void> {
    console.log(`[JobLoadRepository] Marking item ${itemId} as loaded for job ${jobId}`);

    // Try to update workflow_task_item_associations for status tracking
    if (taskId) {
      const { error } = await this.supabase
        .from('workflow_task_item_associations')
        .update({ status: 'loaded' })
        .eq('workflow_task_id', taskId)
        .eq('item_id', itemId);

      if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
        console.error('[JobLoadRepository] Error updating status:', error);
      }
    } else {
      // Find workflow tasks for this job
      const { data: tasks } = await this.supabase
        .from('workflow_tasks')
        .select('id')
        .eq('job_id', jobId);

      if (tasks && tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);
        const { error } = await this.supabase
          .from('workflow_task_item_associations')
          .update({ status: 'loaded' })
          .in('workflow_task_id', taskIds)
          .eq('item_id', itemId);

        if (error && error.code !== 'PGRST116') {
          console.error('[JobLoadRepository] Error updating status:', error);
        }
      }
    }
  }

  /**
   * Mark an item as verified (after VLM confirmation)
   * Updates status in workflow_task_item_associations if exists
   */
  async markItemVerified(
    jobId: string,
    itemId: string,
    taskId?: string
  ): Promise<void> {
    console.log(`[JobLoadRepository] Marking item ${itemId} as verified for job ${jobId}`);

    // Try to update workflow_task_item_associations for status tracking
    if (taskId) {
      const { error } = await this.supabase
        .from('workflow_task_item_associations')
        .update({ status: 'verified' })
        .eq('workflow_task_id', taskId)
        .eq('item_id', itemId);

      if (error && error.code !== 'PGRST116') {
        console.error('[JobLoadRepository] Error updating status:', error);
      }
    } else {
      const { data: tasks } = await this.supabase
        .from('workflow_tasks')
        .select('id')
        .eq('job_id', jobId);

      if (tasks && tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);
        const { error } = await this.supabase
          .from('workflow_task_item_associations')
          .update({ status: 'verified' })
          .in('workflow_task_id', taskIds)
          .eq('item_id', itemId);

        if (error && error.code !== 'PGRST116') {
          console.error('[JobLoadRepository] Error updating status:', error);
        }
      }
    }
  }

  /**
   * Mark an item as missing
   * Updates status in workflow_task_item_associations if exists
   */
  async markItemMissing(
    jobId: string,
    itemId: string,
    taskId?: string
  ): Promise<void> {
    console.log(`[JobLoadRepository] Marking item ${itemId} as missing for job ${jobId}`);

    // Try to update workflow_task_item_associations for status tracking
    if (taskId) {
      const { error } = await this.supabase
        .from('workflow_task_item_associations')
        .update({ status: 'missing' })
        .eq('workflow_task_id', taskId)
        .eq('item_id', itemId);

      if (error && error.code !== 'PGRST116') {
        console.error('[JobLoadRepository] Error updating status:', error);
      }
    } else {
      const { data: tasks } = await this.supabase
        .from('workflow_tasks')
        .select('id')
        .eq('job_id', jobId);

      if (tasks && tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);
        const { error } = await this.supabase
          .from('workflow_task_item_associations')
          .update({ status: 'missing' })
          .in('workflow_task_id', taskIds)
          .eq('item_id', itemId);

        if (error && error.code !== 'PGRST116') {
          console.error('[JobLoadRepository] Error updating status:', error);
        }
      }
    }
  }

  /**
   * Get load verification summary for a job
   */
  async getLoadSummary(jobId: string): Promise<LoadVerificationSummary> {
    const items = await this.getRequiredItems(jobId);

    const total_required = items.length;
    const loaded_count = items.filter((i) => i.status === 'loaded').length;
    const verified_count = items.filter((i) => i.status === 'verified').length;
    const missing_count = items.filter((i) => i.status === 'missing').length;

    return {
      total_required,
      loaded_count,
      verified_count,
      missing_count,
      is_ready_to_verify: loaded_count === total_required && total_required > 0,
      is_fully_verified:
        verified_count === total_required && total_required > 0,
    };
  }

  /**
   * Update job load verification status
   */
  async updateLoadVerificationStatus(
    jobId: string,
    verified: boolean,
    method: 'ai_vision' | 'manual' | 'voice'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('jobs')
      .update({
        load_verified: verified,
        load_verified_at: verified ? new Date().toISOString() : null,
        load_verification_method: verified ? method : null,
      })
      .eq('id', jobId);

    if (error) {
      console.error(
        '[JobLoadRepository] Error updating verification status:',
        error
      );
      throw error;
    }

    // Also update legacy tool_reload_verified for backward compatibility
    await this.supabase
      .from('jobs')
      .update({ tool_reload_verified: verified })
      .eq('id', jobId);
  }
}
