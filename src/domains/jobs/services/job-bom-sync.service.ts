/**
 * Job BOM Sync Service
 *
 * Maintains synchronization between workflow_task_item_associations (new system)
 * and job_checklist_items (legacy system) during the migration period.
 *
 * This dual-write strategy ensures backward compatibility with existing
 * supervisor and crew workflows that rely on job_checklist_items.
 *
 * @phase 3.5
 * @domain jobs
 * @spec_ref specs/015-task-item-association
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkflowTaskItemAssociationWithDetails } from '@/domains/workflow-task/types/workflow-task-association-types';

export interface JobChecklistItem {
  id?: string;
  job_id: string;
  sequence_number: number;
  item_type: 'equipment' | 'material';
  item_id: string;
  item_name: string;
  quantity: number;
  status: 'pending' | 'loaded' | 'verified' | 'missing';
  notes?: string;
}

/**
 * Sync workflow task item associations to job_checklist_items
 *
 * This function performs a dual-write to maintain backward compatibility.
 * It maps workflow_task_item_associations (relational, task-specific) to
 * job_checklist_items (flat, job-level BOM list).
 *
 * @param supabase - Supabase client with appropriate permissions
 * @param jobId - The job ID to sync checklist items for
 * @param workflowAssociations - Workflow task item associations with item/kit details
 * @returns void (throws on error)
 */
export async function syncWorkflowAssociationsToJobChecklist(
  supabase: SupabaseClient,
  jobId: string,
  workflowAssociations: WorkflowTaskItemAssociationWithDetails[]
): Promise<void> {
  try {
    // Step 1: Fetch existing job_checklist_items for this job
    const { data: existingItems, error: fetchError } = await supabase
      .from('job_checklist_items')
      .select('*')
      .eq('job_id', jobId);

    if (fetchError) {
      console.error('[job-bom-sync] Failed to fetch existing checklist items:', fetchError);
      throw fetchError;
    }

    // Step 2: Build checklist items from workflow associations
    const checklistItems: JobChecklistItem[] = [];
    let sequenceNumber = 1;

    for (const assoc of workflowAssociations) {
      // Handle item associations
      if (assoc.item_id && assoc.item) {
        checklistItems.push({
          job_id: jobId,
          sequence_number: sequenceNumber++,
          item_type: (assoc.item as any).item_type === 'equipment' ? 'equipment' : 'material',
          item_id: assoc.item_id,
          item_name: (assoc.item as any).name,
          quantity: Number(assoc.quantity),
          status: mapAssociationStatusToChecklistStatus(assoc.status),
          notes: assoc.notes || undefined,
        });
      }

      // Handle kit associations (expand kit items)
      if (assoc.kit_id && assoc.kit) {
        // TODO: Fetch kit items and expand them
        // For now, create a single checklist entry for the kit
        // In production, you'd query kit_items table and create entries for each item
        checklistItems.push({
          job_id: jobId,
          sequence_number: sequenceNumber++,
          item_type: 'equipment', // Kits are typically equipment
          item_id: assoc.kit_id,
          item_name: `${(assoc.kit as any).name} (Kit)`,
          quantity: Number(assoc.quantity),
          status: mapAssociationStatusToChecklistStatus(assoc.status),
          notes: assoc.notes || `Kit: ${(assoc.kit as any).description || ''}`,
        });
      }
    }

    // Step 3: Determine items to insert/update/delete
    const existingItemIds = new Set((existingItems || []).map((item: any) => item.id));

    // For simplicity during migration, we'll delete all existing and re-insert
    // In production with real data, you'd want smarter diff logic
    if (existingItems && existingItems.length > 0) {
      const { error: deleteError } = await supabase
        .from('job_checklist_items')
        .delete()
        .eq('job_id', jobId);

      if (deleteError) {
        console.error('[job-bom-sync] Failed to delete existing checklist items:', deleteError);
        throw deleteError;
      }
    }

    // Step 4: Insert new checklist items
    if (checklistItems.length > 0) {
      const { error: insertError } = await supabase
        .from('job_checklist_items')
        .insert(checklistItems);

      if (insertError) {
        console.error('[job-bom-sync] Failed to insert checklist items:', insertError);
        throw insertError;
      }

      console.log(`[job-bom-sync] Synced ${checklistItems.length} items to job_checklist_items for job ${jobId}`);
    }

  } catch (error) {
    console.error('[job-bom-sync] Sync failed:', error);
    throw error;
  }
}

/**
 * Map workflow association status to job_checklist_items status
 *
 * workflow_task_item_associations uses: pending, loaded, verified, missing, returned
 * job_checklist_items uses: pending, loaded, verified, missing
 * Note: 'returned' status is not supported in job_checklist_items, map to 'pending'
 */
function mapAssociationStatusToChecklistStatus(
  status: string
): 'pending' | 'loaded' | 'verified' | 'missing' {
  // Handle the returned status by mapping it back to pending
  if (status === 'returned') {
    return 'pending';
  }
  // All other statuses align (pending, loaded, verified, missing)
  return status as 'pending' | 'loaded' | 'verified' | 'missing';
}

/**
 * Remove job checklist items when workflow tasks are deleted
 *
 * This ensures cleanup when jobs are removed or templates are re-instantiated.
 *
 * @param supabase - Supabase client
 * @param jobId - The job ID to clear checklist items for
 */
export async function clearJobChecklistItems(
  supabase: SupabaseClient,
  jobId: string
): Promise<void> {
  const { error } = await supabase
    .from('job_checklist_items')
    .delete()
    .eq('job_id', jobId);

  if (error) {
    console.error('[job-bom-sync] Failed to clear checklist items:', error);
    throw error;
  }

  console.log(`[job-bom-sync] Cleared checklist items for job ${jobId}`);
}

/**
 * Sync a single workflow task's associations to job checklist
 *
 * Use this when individual associations are added/updated/removed
 * instead of doing a full job sync.
 *
 * @param supabase - Supabase client
 * @param jobId - The job ID
 * @param workflowTaskId - The workflow task ID
 */
export async function syncSingleTaskAssociationsToJobChecklist(
  supabase: SupabaseClient,
  jobId: string,
  workflowTaskId: string
): Promise<void> {
  // Fetch all associations for this job (across all tasks)
  const { data: allAssociations, error: fetchError } = await supabase
    .from('workflow_task_item_associations')
    .select(`
      *,
      item:items(*),
      kit:kits(*)
    `)
    .eq('workflow_task_id', workflowTaskId);

  if (fetchError) {
    console.error('[job-bom-sync] Failed to fetch task associations:', fetchError);
    throw fetchError;
  }

  // Re-sync the entire job's checklist
  // (Easier than trying to update individual items)
  await syncWorkflowAssociationsToJobChecklist(
    supabase,
    jobId,
    (allAssociations || []) as WorkflowTaskItemAssociationWithDetails[]
  );
}
