/**
 * @fileoverview Task Definition Repository
 * @module domains/task-definition/repositories
 *
 * @ai-context
 * Purpose: Data access layer for task definitions
 * Pattern: Repository pattern with Result type for error handling
 * Dependencies: Supabase client, Zod schemas
 * Usage: Import in TaskDefinitionService
 *
 * @ai-rules
 * - All database access through Supabase client
 * - Return Result<T, RepositoryError> for all operations
 * - Handle Supabase error codes (PGRST116 = not found, 23514 = constraint violation)
 * - Validate inputs with Zod schemas
 * - RLS enforces tenant isolation automatically
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  TaskDefinition,
  CreateTaskDefinitionInput,
  UpdateTaskDefinitionInput,
  TaskDefinitionUsage,
  RepositoryError,
} from '../types/task-definition-types';
import {
  CreateTaskDefinitionSchema,
  UpdateTaskDefinitionSchema,
} from '../schemas/task-definition-schemas';

// Result type helpers
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export class TaskDefinitionRepository {
  constructor(private client: SupabaseClient<Database>) {}

  /**
   * Find all task definitions
   * @param includeDeleted - Include soft-deleted definitions
   * @returns Result with array of task definitions
   */
  async findAll(includeDeleted = false): Promise<Result<TaskDefinition[], RepositoryError>> {
    try {
      let query = this.client
        .from('task_definitions')
        .select('*');

      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        return Err({
          code: 'DATABASE_ERROR',
          message: `Failed to fetch task definitions: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskDefinition[]);
    } catch (err: any) {
      return Err({
        code: 'UNKNOWN',
        message: err.message || 'Unknown error occurred',
        details: err,
      });
    }
  }

  /**
   * Find task definition by ID
   * @param id - Task definition UUID
   * @returns Result with task definition or null if not found
   */
  async findById(id: string): Promise<Result<TaskDefinition, RepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('task_definitions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Task definition not found',
            details: error,
          });
        }
        return Err({
          code: 'DATABASE_ERROR',
          message: `Failed to fetch task definition: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskDefinition);
    } catch (err: any) {
      return Err({
        code: 'UNKNOWN',
        message: err.message || 'Unknown error occurred',
        details: err,
      });
    }
  }

  /**
   * Create new task definition
   * @param input - Task definition data
   * @returns Result with created task definition
   */
  async create(input: CreateTaskDefinitionInput): Promise<Result<TaskDefinition, RepositoryError>> {
    try {
      // Validate input
      const validated = CreateTaskDefinitionSchema.parse(input);

      const { data, error } = await this.client
        .from('task_definitions')
        .insert({
          name: validated.name,
          description: validated.description,
          acceptance_criteria: validated.acceptance_criteria || null,
          requires_photo_verification: validated.requires_photo_verification ?? false,
          requires_supervisor_approval: validated.requires_supervisor_approval ?? false,
          is_required: validated.is_required ?? true,
        } as any) // Type assertion needed due to generated types
        .select()
        .single();

      if (error) {
        // Check constraint violation (validation error)
        if (error.code === '23514') {
          return Err({
            code: 'VALIDATION_ERROR',
            message: 'Validation constraint violation',
            details: error,
          });
        }
        return Err({
          code: 'DATABASE_ERROR',
          message: `Failed to create task definition: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskDefinition);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid task definition data',
          details: err.errors,
        });
      }
      return Err({
        code: 'UNKNOWN',
        message: err.message || 'Unknown error occurred',
        details: err,
      });
    }
  }

  /**
   * Update task definition
   * @param id - Task definition UUID
   * @param input - Partial update data
   * @returns Result with updated task definition
   */
  async update(
    id: string,
    input: UpdateTaskDefinitionInput
  ): Promise<Result<TaskDefinition, RepositoryError>> {
    try {
      // Validate input
      const validated = UpdateTaskDefinitionSchema.parse(input);

      const updateData: any = {};
      if (validated.name !== undefined) updateData.name = validated.name;
      if (validated.description !== undefined) updateData.description = validated.description;
      if (validated.acceptance_criteria !== undefined) {
        updateData.acceptance_criteria = validated.acceptance_criteria;
      }
      if (validated.requires_photo_verification !== undefined) {
        updateData.requires_photo_verification = validated.requires_photo_verification;
      }
      if (validated.requires_supervisor_approval !== undefined) {
        updateData.requires_supervisor_approval = validated.requires_supervisor_approval;
      }
      if (validated.is_required !== undefined) updateData.is_required = validated.is_required;

      const { data, error } = await this.client
        .from('task_definitions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Task definition not found',
            details: error,
          });
        }
        if (error.code === '23514') {
          return Err({
            code: 'VALIDATION_ERROR',
            message: 'Validation constraint violation',
            details: error,
          });
        }
        return Err({
          code: 'DATABASE_ERROR',
          message: `Failed to update task definition: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskDefinition);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid task definition data',
          details: err.errors,
        });
      }
      return Err({
        code: 'UNKNOWN',
        message: err.message || 'Unknown error occurred',
        details: err,
      });
    }
  }

  /**
   * Soft delete task definition (with usage check)
   * @param id - Task definition UUID
   * @returns Result with void on success
   */
  async delete(id: string): Promise<Result<void, RepositoryError>> {
    try {
      // First, check if task definition is in use
      const usageResult = await this.checkUsage(id);
      if (!usageResult.ok) {
        return Err(usageResult.error);
      }

      if (usageResult.value.templateCount > 0) {
        return Err({
          code: 'IN_USE',
          message: `Task definition is used in ${usageResult.value.templateCount} template(s)`,
          details: {
            templateCount: usageResult.value.templateCount,
            templateNames: usageResult.value.templateNames,
          },
        });
      }

      // Perform soft delete
      const { error } = await this.client
        .from('task_definitions')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Task definition not found',
            details: error,
          });
        }
        return Err({
          code: 'DATABASE_ERROR',
          message: `Failed to delete task definition: ${error.message}`,
          details: error,
        });
      }

      return Ok(undefined);
    } catch (err: any) {
      return Err({
        code: 'UNKNOWN',
        message: err.message || 'Unknown error occurred',
        details: err,
      });
    }
  }

  /**
   * Check task definition usage in templates
   * @param id - Task definition UUID
   * @returns Result with usage statistics
   */
  async checkUsage(id: string): Promise<Result<TaskDefinitionUsage, RepositoryError>> {
    try {
      // Query task_template_items to find templates using this definition
      const { data, error } = await this.client
        .from('task_template_items')
        .select(`
          template_id,
          task_templates (
            id,
            name
          )
        `)
        .eq('source_definition_id', id);

      if (error) {
        return Err({
          code: 'DATABASE_ERROR',
          message: `Failed to check task definition usage: ${error.message}`,
          details: error,
        });
      }

      // Extract unique templates
      const templates = new Map<string, string>();
      (data || []).forEach((item: any) => {
        if (item.task_templates) {
          templates.set(item.task_templates.id, item.task_templates.name);
        }
      });

      const templateIds = Array.from(templates.keys());
      const templateNames = Array.from(templates.values());

      return Ok({
        templateCount: templates.size,
        templateIds,
        templateNames,
      });
    } catch (err: any) {
      return Err({
        code: 'UNKNOWN',
        message: err.message || 'Unknown error occurred',
        details: err,
      });
    }
  }
}

// Convenience export
export const createTaskDefinitionRepository = (
  client: SupabaseClient<Database>
): TaskDefinitionRepository => {
  return new TaskDefinitionRepository(client);
};
