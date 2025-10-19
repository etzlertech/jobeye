/**
 * @fileoverview Task Definition Service
 * @module domains/task-definition/services
 *
 * @ai-context
 * Purpose: Business logic layer for task definitions
 * Pattern: Service pattern with repository dependency injection
 * Dependencies: TaskDefinitionRepository
 * Usage: Import in API routes
 *
 * @ai-rules
 * - All database access through repository
 * - Return Result<T, ServiceError> for all operations
 * - Implement business logic (usage guards, validation, deleted checks)
 * - Map repository errors to service errors
 * - Add userId tracking for audit trail
 */

import { TaskDefinitionRepository } from '../repositories/TaskDefinitionRepository';
import type {
  TaskDefinition,
  CreateTaskDefinitionInput,
  UpdateTaskDefinitionInput,
  TaskDefinitionUsage,
  ServiceError,
} from '../types/task-definition-types';

// Result type helpers
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export class TaskDefinitionService {
  constructor(private repository: TaskDefinitionRepository) {}

  /**
   * List all task definitions
   * @param includeDeleted - Include soft-deleted definitions
   * @returns Result with array of task definitions
   */
  async listTaskDefinitions(
    includeDeleted = false
  ): Promise<Result<TaskDefinition[], ServiceError>> {
    const result = await this.repository.findAll(includeDeleted);

    if (!result.ok) {
      return Err({
        code: 'UNKNOWN',
        message: 'Failed to list task definitions',
        details: result.error,
      });
    }

    return Ok(result.value);
  }

  /**
   * Get task definition by ID
   * @param id - Task definition UUID
   * @returns Result with task definition
   */
  async getTaskDefinitionById(id: string): Promise<Result<TaskDefinition, ServiceError>> {
    const result = await this.repository.findById(id);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return Err({
          code: 'NOT_FOUND',
          message: 'Task definition not found',
          details: result.error,
        });
      }
      return Err({
        code: 'UNKNOWN',
        message: 'Failed to get task definition',
        details: result.error,
      });
    }

    return Ok(result.value);
  }

  /**
   * Create new task definition
   * @param input - Task definition data
   * @param tenantId - Tenant ID for the definition
   * @param userId - ID of user creating the definition
   * @returns Result with created task definition
   */
  async createTaskDefinition(
    input: CreateTaskDefinitionInput,
    tenantId: string,
    userId: string
  ): Promise<Result<TaskDefinition, ServiceError>> {
    // Add tenant_id and created_by to input
    const inputWithMetadata = {
      ...input,
      tenant_id: tenantId,
      created_by: userId,
    };

    const result = await this.repository.create(inputWithMetadata);

    if (!result.ok) {
      if (result.error.code === 'VALIDATION_ERROR') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: result.error.message,
          details: result.error.details,
        });
      }
      return Err({
        code: 'UNKNOWN',
        message: 'Failed to create task definition - database error',
        details: result.error,
      });
    }

    return Ok(result.value);
  }

  /**
   * Update task definition
   * @param id - Task definition UUID
   * @param input - Partial update data
   * @returns Result with updated task definition
   */
  async updateTaskDefinition(
    id: string,
    input: UpdateTaskDefinitionInput
  ): Promise<Result<TaskDefinition, ServiceError>> {
    // First check if definition exists and is not deleted
    const existingResult = await this.repository.findById(id);
    if (!existingResult.ok) {
      if (existingResult.error.code === 'NOT_FOUND') {
        return Err({
          code: 'NOT_FOUND',
          message: 'Task definition not found',
          details: existingResult.error,
        });
      }
      return Err({
        code: 'UNKNOWN',
        message: 'Failed to check task definition',
        details: existingResult.error,
      });
    }

    // Check if deleted
    if (existingResult.value.deleted_at !== null) {
      return Err({
        code: 'VALIDATION_ERROR',
        message: 'Cannot update deleted task definition',
        details: { deleted_at: existingResult.value.deleted_at },
      });
    }

    // Perform update
    const result = await this.repository.update(id, input);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return Err({
          code: 'NOT_FOUND',
          message: 'Task definition not found',
          details: result.error,
        });
      }
      if (result.error.code === 'VALIDATION_ERROR') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: result.error.message,
          details: result.error.details,
        });
      }
      return Err({
        code: 'UNKNOWN',
        message: 'Failed to update task definition',
        details: result.error,
      });
    }

    return Ok(result.value);
  }

  /**
   * Delete task definition (soft delete with usage guard)
   * @param id - Task definition UUID
   * @returns Result with void on success
   */
  async deleteTaskDefinition(id: string): Promise<Result<void, ServiceError>> {
    const result = await this.repository.delete(id);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return Err({
          code: 'NOT_FOUND',
          message: 'Task definition not found',
          details: result.error,
        });
      }
      if (result.error.code === 'IN_USE') {
        return Err({
          code: 'IN_USE',
          message: result.error.message,
          details: result.error.details,
        });
      }
      return Err({
        code: 'UNKNOWN',
        message: 'Failed to delete task definition',
        details: result.error,
      });
    }

    return Ok(undefined);
  }

  /**
   * Get task definition usage in templates
   * @param id - Task definition UUID
   * @returns Result with usage statistics
   */
  async getTaskDefinitionUsage(
    id: string
  ): Promise<Result<TaskDefinitionUsage, ServiceError>> {
    const result = await this.repository.checkUsage(id);

    if (!result.ok) {
      return Err({
        code: 'UNKNOWN',
        message: 'Failed to check task definition usage',
        details: result.error,
      });
    }

    return Ok(result.value);
  }
}

// Convenience export
export const createTaskDefinitionService = (
  repository: TaskDefinitionRepository
): TaskDefinitionService => {
  return new TaskDefinitionService(repository);
};
