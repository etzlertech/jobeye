// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/workflow-task/repositories/WorkflowTaskRepository.ts
// phase: 3.3
// domain: workflow-task
// purpose: Workflow task data access with tenant isolation and task management
// spec_ref: specs/011-making-task-lists/spec.md
// version: 2025-10-18
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/workflow-task/types/workflow-task-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - WorkflowTaskRepository: class - Workflow task data access
//   - findByJobId: function - Get tasks for a job
//   - findIncompleteRequired: function - Get incomplete required tasks
//   - create: function - Create new task
//   - update: function - Update task
//   - softDelete: function - Soft delete task
//   - createFromTemplate: function - Create tasks from template
//
// voice_considerations: |
//   Support voice-driven task operations.
//   Store voice confirmation metadata.
//   Enable task list queries via voice.
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/workflow-task/WorkflowTaskRepository.test.ts
//
// tasks:
//   1. Implement CRUD with tenant isolation
//   2. Add findIncompleteRequired method
//   3. Add softDelete method
//   4. Add createFromTemplate method
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import {
  WorkflowTask,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskStatus,
  RepositoryError,
  Result,
  Ok,
  Err,
} from '../types/workflow-task-types';
import type { TaskTemplateItem } from '@/domains/task-template/types/task-template-types';

export class WorkflowTaskRepository {
  constructor(private client: SupabaseClient) {}

  /**
   * Find all non-deleted tasks for a job
   */
  async findByJobId(jobId: string): Promise<Result<WorkflowTask[], RepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('workflow_tasks')
        .select('*')
        .eq('job_id', jobId)
        .eq('is_deleted', false)
        .order('task_order', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch tasks for job: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTask[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find all incomplete required tasks for a job
   * Used for job completion validation
   */
  async findIncompleteRequired(jobId: string): Promise<Result<WorkflowTask[], RepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('workflow_tasks')
        .select('*')
        .eq('job_id', jobId)
        .eq('is_deleted', false)
        .eq('is_required', true)
        .not('status', 'in', `(complete,skipped)`)
        .order('task_order', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch incomplete required tasks: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTask[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Result<WorkflowTask | null, RepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('workflow_tasks')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Ok(null); // Not found
        }
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch task: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTask);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Create new task
   */
  async create(input: CreateTaskInput): Promise<Result<WorkflowTask, RepositoryError>> {
    try {
      // Validate input
      const validated = CreateTaskSchema.parse(input);

      const task = {
        job_id: validated.job_id,
        task_description: validated.task_description,
        task_order: validated.task_order,
        is_required: validated.is_required,
        requires_photo_verification: validated.requires_photo_verification,
        requires_supervisor_approval: validated.requires_supervisor_approval,
        acceptance_criteria: validated.acceptance_criteria || null,
        status: TaskStatus.PENDING,
        is_deleted: false,
        verification_method: 'manual',
      };

      const { data, error } = await this.client
        .from('workflow_tasks')
        .insert(task)
        .select()
        .single();

      if (error) {
        return Err({
          code: 'INSERT_FAILED',
          message: `Failed to create task: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTask);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid task data',
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
   * Update task
   */
  async update(id: string, input: UpdateTaskInput): Promise<Result<WorkflowTask, RepositoryError>> {
    try {
      // Validate input
      const validated = UpdateTaskSchema.parse(input);

      const { data, error } = await this.client
        .from('workflow_tasks')
        .update({
          ...validated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('is_deleted', false)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Task not found or already deleted',
          });
        }
        return Err({
          code: 'UPDATE_FAILED',
          message: `Failed to update task: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTask);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid task data',
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
   * Soft delete task (set is_deleted=true)
   */
  async softDelete(id: string): Promise<Result<void, RepositoryError>> {
    try {
      const { error } = await this.client
        .from('workflow_tasks')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return Err({
          code: 'UPDATE_FAILED',
          message: `Failed to soft delete task: ${error.message}`,
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
   * Create tasks from template items
   */
  async createFromTemplate(
    jobId: string,
    templateItems: TaskTemplateItem[]
  ): Promise<Result<WorkflowTask[], RepositoryError>> {
    try {
      const tasks = templateItems.map(item => ({
        job_id: jobId,
        task_description: item.task_description,
        task_order: item.task_order,
        is_required: item.is_required,
        requires_photo_verification: item.requires_photo_verification,
        requires_supervisor_approval: item.requires_supervisor_approval,
        acceptance_criteria: item.acceptance_criteria,
        template_id: item.template_id,
        status: TaskStatus.PENDING,
        is_deleted: false,
        verification_method: 'manual',
      }));

      const { data, error } = await this.client
        .from('workflow_tasks')
        .insert(tasks)
        .select();

      if (error) {
        return Err({
          code: 'INSERT_FAILED',
          message: `Failed to create tasks from template: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as WorkflowTask[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }
}

// Convenience export
export const createWorkflowTaskRepository = (client: SupabaseClient): WorkflowTaskRepository => {
  return new WorkflowTaskRepository(client);
};
