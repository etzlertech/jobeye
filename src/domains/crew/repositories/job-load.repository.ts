/**
 * JobLoadRepository
 *
 * Handles dual-read/dual-write for job load verification during migration from
 * checklist_items (JSONB) to workflow_task_item_associations (normalized table).
 *
 * Migration Strategy:
 * - Read from both sources, merge results
 * - Write to both sources for backward compatibility
 * - Prefer table data when conflicts exist
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
   * Dual-reads from both workflow_task_item_associations and checklist_items
   */
  async getRequiredItems(jobId: string): Promise<JobLoadItem[]> {
    // Read from normalized table
    const { data: tableItems, error: tableError } = await this.supabase
      .from('workflow_task_item_associations')
      .select(`
        id,
        quantity,
        is_required,
        status,
        workflow_task:workflow_tasks!inner (
          id,
          task_description
        ),
        item:items!inner (
          id,
          name,
          item_type
        )
      `)
      .eq('workflow_task.job_id', jobId)
      .eq('is_required', true);

    if (tableError) {
      console.error('[JobLoadRepository] Error fetching table items:', tableError);
    }

    // Read from JSONB fallback
    const { data: job, error: jobError } = await this.supabase
      .from('jobs')
      .select('id, checklist_items')
      .eq('id', jobId)
      .single();

    if (jobError) {
      console.error('[JobLoadRepository] Error fetching job:', jobError);
    }

    // Merge results
    const items: JobLoadItem[] = [];

    // Add table items (preferred source)
    if (tableItems) {
      for (const item of tableItems) {
        items.push({
          id: item.item.id,
          name: item.item.name,
          item_type: item.item.item_type,
          quantity: item.quantity,
          is_required: item.is_required,
          status: item.status,
          task_id: item.workflow_task.id,
          task_title: item.workflow_task.task_description,
          source: 'table',
        });
      }
    }

    // Add JSONB items (fallback for legacy data)
    if (job?.checklist_items) {
      const checklistItems = job.checklist_items as any[];
      for (const item of checklistItems) {
        // Skip if already in table items
        if (items.some((i) => i.id === item.id)) {
          continue;
        }

        items.push({
          id: item.id,
          name: item.name,
          item_type: item.type || 'equipment',
          quantity: item.quantity || 1,
          is_required: true,
          status: item.loaded ? 'loaded' : 'pending',
          task_id: null,
          task_title: null,
          source: 'jsonb',
        });
      }
    }

    return items;
  }

  /**
   * Mark an item as loaded
   * Dual-writes to both sources
   */
  async markItemLoaded(
    jobId: string,
    itemId: string,
    taskId?: string
  ): Promise<void> {
    // Write to table
    if (taskId) {
      // Direct update when task_id is known
      const { error } = await this.supabase
        .from('workflow_task_item_associations')
        .update({ status: 'loaded' })
        .eq('workflow_task_id', taskId)
        .eq('item_id', itemId);

      if (error) {
        console.error('[JobLoadRepository] Error updating table:', error);
      }
    } else {
      // Find all associations for this job + item when task_id not provided
      const { data: tasks, error: taskError } = await this.supabase
        .from('workflow_tasks')
        .select('id')
        .eq('job_id', jobId);

      if (taskError) {
        console.error('[JobLoadRepository] Error finding tasks:', taskError);
      } else if (tasks && tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);

        const { error } = await this.supabase
          .from('workflow_task_item_associations')
          .update({ status: 'loaded' })
          .in('workflow_task_id', taskIds)
          .eq('item_id', itemId);

        if (error) {
          console.error('[JobLoadRepository] Error updating table:', error);
        }
      }
    }

    // Write to JSONB (backward compatibility)
    const { data: job, error: fetchError } = await this.supabase
      .from('jobs')
      .select('checklist_items')
      .eq('id', jobId)
      .single();

    if (fetchError || !job?.checklist_items) {
      return;
    }

    const checklistItems = job.checklist_items as any[];
    const updatedItems = checklistItems.map((item) =>
      item.id === itemId ? { ...item, loaded: true } : item
    );

    const { error: updateError } = await this.supabase
      .from('jobs')
      .update({ checklist_items: updatedItems })
      .eq('id', jobId);

    if (updateError) {
      console.error('[JobLoadRepository] Error updating JSONB:', updateError);
    }
  }

  /**
   * Mark an item as verified (after VLM confirmation)
   * Dual-writes to both sources
   */
  async markItemVerified(
    jobId: string,
    itemId: string,
    taskId?: string
  ): Promise<void> {
    // Write to table
    if (taskId) {
      // Direct update when task_id is known
      const { error } = await this.supabase
        .from('workflow_task_item_associations')
        .update({ status: 'verified' })
        .eq('workflow_task_id', taskId)
        .eq('item_id', itemId);

      if (error) {
        console.error('[JobLoadRepository] Error updating table:', error);
      }
    } else {
      // Find all associations for this job + item when task_id not provided
      const { data: tasks, error: taskError } = await this.supabase
        .from('workflow_tasks')
        .select('id')
        .eq('job_id', jobId);

      if (taskError) {
        console.error('[JobLoadRepository] Error finding tasks:', taskError);
      } else if (tasks && tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);

        const { error } = await this.supabase
          .from('workflow_task_item_associations')
          .update({ status: 'verified' })
          .in('workflow_task_id', taskIds)
          .eq('item_id', itemId);

        if (error) {
          console.error('[JobLoadRepository] Error updating table:', error);
        }
      }
    }

    // Write to JSONB (backward compatibility)
    const { data: job, error: fetchError } = await this.supabase
      .from('jobs')
      .select('checklist_items')
      .eq('id', jobId)
      .single();

    if (fetchError || !job?.checklist_items) {
      return;
    }

    const checklistItems = job.checklist_items as any[];
    const updatedItems = checklistItems.map((item) =>
      item.id === itemId ? { ...item, verified: true, loaded: true } : item
    );

    const { error: updateError } = await this.supabase
      .from('jobs')
      .update({ checklist_items: updatedItems })
      .eq('id', jobId);

    if (updateError) {
      console.error('[JobLoadRepository] Error updating JSONB:', updateError);
    }
  }

  /**
   * Mark an item as missing
   * Dual-writes to both sources
   */
  async markItemMissing(
    jobId: string,
    itemId: string,
    taskId?: string
  ): Promise<void> {
    // Write to table
    if (taskId) {
      // Direct update when task_id is known
      const { error } = await this.supabase
        .from('workflow_task_item_associations')
        .update({ status: 'missing' })
        .eq('workflow_task_id', taskId)
        .eq('item_id', itemId);

      if (error) {
        console.error('[JobLoadRepository] Error updating table:', error);
      }
    } else {
      // Find all associations for this job + item when task_id not provided
      const { data: tasks, error: taskError } = await this.supabase
        .from('workflow_tasks')
        .select('id')
        .eq('job_id', jobId);

      if (taskError) {
        console.error('[JobLoadRepository] Error finding tasks:', taskError);
      } else if (tasks && tasks.length > 0) {
        const taskIds = tasks.map((t) => t.id);

        const { error } = await this.supabase
          .from('workflow_task_item_associations')
          .update({ status: 'missing' })
          .in('workflow_task_id', taskIds)
          .eq('item_id', itemId);

        if (error) {
          console.error('[JobLoadRepository] Error updating table:', error);
        }
      }
    }

    // Write to JSONB (backward compatibility)
    const { data: job, error: fetchError } = await this.supabase
      .from('jobs')
      .select('checklist_items')
      .eq('id', jobId)
      .single();

    if (fetchError || !job?.checklist_items) {
      return;
    }

    const checklistItems = job.checklist_items as any[];
    const updatedItems = checklistItems.map((item) =>
      item.id === itemId ? { ...item, loaded: false, missing: true } : item
    );

    const { error: updateError } = await this.supabase
      .from('jobs')
      .update({ checklist_items: updatedItems })
      .eq('id', jobId);

    if (updateError) {
      console.error('[JobLoadRepository] Error updating JSONB:', updateError);
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
