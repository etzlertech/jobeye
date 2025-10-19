// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository.ts
// phase: 3.3
// domain: workflow-task
// purpose: Workflow task item association data access with status tracking
// spec_ref: specs/015-task-item-association/spec.md
// version: 2025-10-19
// complexity_budget: 300 LoC
// offline_capability: NOT_REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/workflow-task/types/workflow-task-association-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - WorkflowTaskItemAssociationRepository: class - Association data access
//   - findByWorkflowTaskId: function - Get all associations for a workflow task
//   - findById: function - Get association by ID
//   - create: function - Create association
//   - update: function - Update association with status tracking
//   - delete: function - Delete association
//   - markAsLoaded: function - Convenience method to mark item as loaded
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/workflow-task/WorkflowTaskItemAssociationRepository.test.ts
//
// tasks:
//   1. Implement CRUD with tenant isolation via RLS
//   2. Add findByWorkflowTaskId for loading task equipment
//   3. Add status filtering (e.g., pending, loaded)
//   4. Add markAsLoaded convenience method
//   5. Handle loaded_at/loaded_by constraints
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import {
  TaskItemStatus,
  WorkflowTaskItemAssociation,
  WorkflowTaskItemAssociationWithDetails,
  CreateWorkflowTaskItemAssociationInput,
  UpdateWorkflowTaskItemAssociationInput,
  CreateWorkflowTaskItemAssociationSchema,
  UpdateWorkflowTaskItemAssociationSchema,
  WorkflowTaskAssociationRepositoryError,
  Result,
  Ok,
  Err,
  isErr,
} from '../types/workflow-task-association-types';

export class WorkflowTaskItemAssociationRepository {
  constructor(private client: SupabaseClient) {}

  /**
   * Find all associations for a workflow task
   */
  async findByWorkflowTaskId(
    workflowTaskId: string,
    status?: TaskItemStatus
  ): Promise<Result<WorkflowTaskItemAssociation[], WorkflowTaskAssociationRepositoryError>> {
    try {
      let query = this.client
        .from('workflow_task_item_associations')
        .select('*')
        .eq('workflow_task_id', workflowTaskId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch workflow task associations: ${error.message}`,
          details: error,
        });
      }

      return Ok((data || []) as WorkflowTaskItemAssociation[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find all associations for a workflow task with joined item/kit/user details
   */
  async findByWorkflowTaskIdWithDetails(
    workflowTaskId: string,
    status?: TaskItemStatus
  ): Promise<Result<WorkflowTaskItemAssociationWithDetails[], WorkflowTaskAssociationRepositoryError>> {
    try {
      let query = this.client
        .from('workflow_task_item_associations')
        .select(`
          *,
          items:item_id (
            name,
            description
          ),
          kits:kit_id (
            name,
            description
          ),
          loaded_by_user:loaded_by (
            id,
            email
          )
        `)
        .eq('workflow_task_id', workflowTaskId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch workflow task associations with details: ${error.message}`,
          details: error,
        });
      }

      // Transform the joined data structure
      const transformed = (data || []).map((row: any) => ({
        ...row,
        item_name: row.items?.name || null,
        item_description: row.items?.description || null,
        kit_name: row.kits?.name || null,
        kit_description: row.kits?.description || null,
        loaded_by_email: row.loaded_by_user?.email || null,
        items: undefined,
        kits: undefined,
        loaded_by_user: undefined,
      }));

      return Ok(transformed as WorkflowTaskItemAssociationWithDetails[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find association by ID
   */
  async findById(
    id: string
  ): Promise<Result<WorkflowTaskItemAssociation | null, WorkflowTaskAssociationRepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('workflow_task_item_associations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Ok(null); // Not found
        }
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch association: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTaskItemAssociation);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Create workflow task item association
   */
  async create(
    workflowTaskId: string,
    tenantId: string,
    input: CreateWorkflowTaskItemAssociationInput
  ): Promise<Result<WorkflowTaskItemAssociation, WorkflowTaskAssociationRepositoryError>> {
    try {
      // Validate input
      const validated = CreateWorkflowTaskItemAssociationSchema.parse(input);

      const { data, error } = await this.client
        .from('workflow_task_item_associations')
        .insert({
          tenant_id: tenantId,
          workflow_task_id: workflowTaskId,
          item_id: validated.item_id || null,
          kit_id: validated.kit_id || null,
          quantity: validated.quantity,
          is_required: validated.is_required,
          status: validated.status,
          notes: validated.notes || null,
          source_template_association_id: validated.source_template_association_id || null,
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          const isItem = validated.item_id;
          return Err({
            code: 'DUPLICATE_ASSOCIATION',
            message: `This ${isItem ? 'item' : 'kit'} is already associated with this workflow task`,
            details: error,
          });
        }

        // Handle foreign key constraint violation
        if (error.code === '23503') {
          return Err({
            code: 'INVALID_REFERENCE',
            message: 'Invalid workflow task, item, kit, or template association reference',
            details: error,
          });
        }

        // Handle check constraint violation (XOR)
        if (error.code === '23514') {
          return Err({
            code: 'VALIDATION_ERROR',
            message: 'Must specify exactly one of item_id or kit_id, and loaded_at/loaded_by must be set together',
            details: error,
          });
        }

        return Err({
          code: 'INSERT_FAILED',
          message: `Failed to create association: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTaskItemAssociation);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid association data',
          details: err.errors,
        });
      }
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Update workflow task item association
   */
  async update(
    id: string,
    input: UpdateWorkflowTaskItemAssociationInput
  ): Promise<Result<WorkflowTaskItemAssociation, WorkflowTaskAssociationRepositoryError>> {
    try {
      // Validate input
      const validated = UpdateWorkflowTaskItemAssociationSchema.parse(input);

      const { data, error } = await this.client
        .from('workflow_task_item_associations')
        .update({
          ...validated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Association not found',
            details: error,
          });
        }

        // Handle check constraint violation
        if (error.code === '23514') {
          return Err({
            code: 'VALIDATION_ERROR',
            message: 'loaded_at and loaded_by must be set together',
            details: error,
          });
        }

        return Err({
          code: 'UPDATE_FAILED',
          message: `Failed to update association: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTaskItemAssociation);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid association data',
          details: err.errors,
        });
      }
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Convenience method to mark an item association as loaded
   */
  async markAsLoaded(
    id: string,
    loadedBy: string
  ): Promise<Result<WorkflowTaskItemAssociation, WorkflowTaskAssociationRepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('workflow_task_item_associations')
        .update({
          status: TaskItemStatus.LOADED,
          loaded_at: new Date().toISOString(),
          loaded_by: loadedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Association not found',
            details: error,
          });
        }

        return Err({
          code: 'UPDATE_FAILED',
          message: `Failed to mark item as loaded: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTaskItemAssociation);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Delete workflow task item association
   */
  async delete(id: string): Promise<Result<void, WorkflowTaskAssociationRepositoryError>> {
    try {
      const { error } = await this.client
        .from('workflow_task_item_associations')
        .delete()
        .eq('id', id);

      if (error) {
        return Err({
          code: 'DELETE_FAILED',
          message: `Failed to delete association: ${error.message}`,
          details: error,
        });
      }

      return Ok(undefined);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Delete all associations for a workflow task (used when task is deleted)
   */
  async deleteByWorkflowTaskId(
    workflowTaskId: string
  ): Promise<Result<void, WorkflowTaskAssociationRepositoryError>> {
    try {
      const { error } = await this.client
        .from('workflow_task_item_associations')
        .delete()
        .eq('workflow_task_id', workflowTaskId);

      if (error) {
        return Err({
          code: 'DELETE_FAILED',
          message: `Failed to delete associations for workflow task: ${error.message}`,
          details: error,
        });
      }

      return Ok(undefined);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Get count of required items that are not yet loaded for a workflow task
   */
  async countPendingRequiredItems(
    workflowTaskId: string
  ): Promise<Result<number, WorkflowTaskAssociationRepositoryError>> {
    try {
      const { data, error, count } = await this.client
        .from('workflow_task_item_associations')
        .select('id', { count: 'exact', head: true })
        .eq('workflow_task_id', workflowTaskId)
        .eq('is_required', true)
        .eq('status', TaskItemStatus.PENDING);

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to count pending required items: ${error.message}`,
          details: error,
        });
      }

      return Ok(count || 0);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find all associations for a job (across all workflow tasks in the job)
   * Used for dual-write sync to job_checklist_items
   */
  async findByJobIdWithDetails(
    jobId: string
  ): Promise<Result<WorkflowTaskItemAssociationWithDetails[], WorkflowTaskAssociationRepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('workflow_task_item_associations')
        .select(`
          *,
          item:items!item_id (
            id,
            name,
            description,
            item_type
          ),
          kit:kits!kit_id (
            id,
            name,
            description
          ),
          workflow_task:workflow_tasks!workflow_task_id (
            id,
            job_id
          ),
          loaded_by_user:loaded_by (
            id,
            email
          )
        `)
        .eq('workflow_tasks.job_id', jobId)
        .order('created_at', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch job associations with details: ${error.message}`,
          details: error,
        });
      }

      // Filter out rows where the join didn't match (job_id mismatch)
      const filtered = (data || []).filter((row: any) => row.workflow_task?.job_id === jobId);

      // Transform the joined data structure
      const transformed = filtered.map((row: any) => ({
        ...row,
        item: row.item || undefined,
        kit: row.kit || undefined,
        workflow_task: undefined,
        loaded_by_user: undefined,
      }));

      return Ok(transformed as WorkflowTaskItemAssociationWithDetails[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Sync workflow task item associations to job_checklist_items
   * Maintains backward compatibility with legacy BOM system
   *
   * This is a dual-write operation that should be called after
   * associations are created/updated to keep job_checklist_items in sync.
   */
  async syncToJobChecklist(
    jobId: string
  ): Promise<Result<void, WorkflowTaskAssociationRepositoryError>> {
    try {
      // Import the sync helper function
      const { syncWorkflowAssociationsToJobChecklist } = await import('@/domains/jobs/services/job-bom-sync.service');

      // Fetch all associations for this job
      const associationsResult = await this.findByJobIdWithDetails(jobId);

      if (isErr(associationsResult)) {
        return Err({
          code: 'SYNC_FAILED',
          message: `Failed to fetch associations for sync: ${associationsResult.error.message}`,
          details: associationsResult.error,
        });
      }

      // Perform the sync
      await syncWorkflowAssociationsToJobChecklist(
        this.client,
        jobId,
        associationsResult.value
      );

      return Ok(undefined);
    } catch (err: any) {
      return Err({
        code: 'SYNC_FAILED',
        message: `Failed to sync to job checklist: ${err.message}`,
        details: err,
      });
    }
  }
}

// Convenience export
export const createWorkflowTaskItemAssociationRepository = (
  client: SupabaseClient
): WorkflowTaskItemAssociationRepository => {
  return new WorkflowTaskItemAssociationRepository(client);
};
