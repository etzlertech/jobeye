/**
 * @fileoverview Task Definition domain types
 * @module domains/task-definition/types
 *
 * @ai-context
 * Purpose: Type definitions for task-definition domain
 * Pattern: Domain types following repository pattern
 * Dependencies: Database types from src/types/database.ts
 * Usage: Import these types in repositories, services, and API routes
 *
 * @ai-rules
 * - Keep types in sync with database schema
 * - Use strict TypeScript (no any types)
 * - Document all interfaces with JSDoc
 * - Follow naming convention: Entity, EntityInsert, EntityUpdate
 */

/**
 * Task Definition entity
 * Represents a reusable task definition in the task library
 */
export interface TaskDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  acceptance_criteria: string | null;
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  is_required: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Input for creating a new task definition
 * Used in POST /api/task-definitions
 */
export interface CreateTaskDefinitionInput {
  name: string;
  description: string;
  acceptance_criteria?: string | null;
  requires_photo_verification?: boolean;
  requires_supervisor_approval?: boolean;
  is_required?: boolean;
}

/**
 * Input for updating an existing task definition
 * Used in PATCH /api/task-definitions/:id
 * All fields are optional (partial update)
 */
export interface UpdateTaskDefinitionInput {
  name?: string;
  description?: string;
  acceptance_criteria?: string | null;
  requires_photo_verification?: boolean;
  requires_supervisor_approval?: boolean;
  is_required?: boolean;
}

/**
 * Task definition usage information
 * Shows which templates are using this definition
 */
export interface TaskDefinitionUsage {
  templateCount: number;
  templateIds: string[];
  templateNames: string[];
}

/**
 * Task definition with usage information
 * Used for detailed views and deletion guards
 */
export type TaskDefinitionWithUsage = TaskDefinition & {
  usage: TaskDefinitionUsage;
};

/**
 * Repository error types
 */
export interface RepositoryError {
  code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'IN_USE' | 'UNKNOWN';
  message: string;
  details?: unknown;
}

/**
 * Service error types
 */
export interface ServiceError {
  code: 'NOT_FOUND' | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'IN_USE' | 'UNKNOWN';
  message: string;
  details?: unknown;
}
