// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/workflow-task/types/workflow-task-association-types.ts
// phase: 3.2
// domain: workflow-task
// purpose: Types for workflow task item associations (runtime equipment tracking)
// spec_ref: specs/015-task-item-association/spec.md
// version: 2025-10-19
// complexity_budget: 300 LoC
// offline_capability: NOT_REQUIRED
//
// dependencies:
//   external:
//     - zod: ^3.23.0
//
// exports:
//   - TaskItemStatus: enum - Equipment loading status
//   - WorkflowTaskItemAssociation: interface - Workflow task association entity
//   - WorkflowTaskItemAssociationWithDetails: interface - Association with joined data
//   - CreateWorkflowTaskItemAssociationInput: type - Association creation payload
//   - UpdateWorkflowTaskItemAssociationInput: type - Association update payload
//   - CreateWorkflowTaskItemAssociationSchema: schema - Validation for creation
//   - UpdateWorkflowTaskItemAssociationSchema: schema - Validation for updates
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/workflow-task/workflow-task-association-types.test.ts
//
// tasks:
//   1. Define task item status enum
//   2. Define association entity interfaces
//   3. Create input/output types
//   4. Implement Zod validation schemas with XOR and status constraints
//   5. Add type guards and helpers
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

// Task Item Status Enum (matches database ENUM)
export enum TaskItemStatus {
  PENDING = 'pending',
  LOADED = 'loaded',
  VERIFIED = 'verified',
  MISSING = 'missing',
  RETURNED = 'returned',
}

// Core Workflow Task Item Association Entity
export interface WorkflowTaskItemAssociation {
  id: string;
  tenant_id: string;
  workflow_task_id: string;
  item_id: string | null;
  kit_id: string | null;
  quantity: number;
  is_required: boolean;
  status: TaskItemStatus;
  loaded_at: string | null;
  loaded_by: string | null;
  notes: string | null;
  source_template_association_id: string | null;
  created_at: string;
  updated_at: string;
}

// Association with joined item/kit/user details for display purposes
export interface WorkflowTaskItemAssociationWithDetails extends WorkflowTaskItemAssociation {
  item_name?: string | null;
  item_description?: string | null;
  kit_name?: string | null;
  kit_description?: string | null;
  loaded_by_name?: string | null;
  loaded_by_email?: string | null;
  // Joined item/kit objects for dual-write sync
  item?: { id: string; name: string; description?: string | null; item_type?: string } | undefined;
  kit?: { id: string; name: string; description?: string | null } | undefined;
}

// Zod Schemas

// Task Item Status Schema
export const TaskItemStatusSchema = z.nativeEnum(TaskItemStatus);

// Zod Schema for creating workflow task item associations
// Enforces XOR constraint: exactly one of item_id OR kit_id must be provided
export const CreateWorkflowTaskItemAssociationSchema = z
  .object({
    item_id: z.string().uuid().optional(),
    kit_id: z.string().uuid().optional(),
    quantity: z.number().positive().default(1),
    is_required: z.boolean().default(true),
    status: TaskItemStatusSchema.default(TaskItemStatus.PENDING),
    notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional(),
    source_template_association_id: z.string().uuid().optional().nullable(),
  })
  .refine(
    (data) => (data.item_id && !data.kit_id) || (!data.item_id && data.kit_id),
    {
      message: 'Exactly one of item_id or kit_id must be provided (XOR)',
      path: ['item_id'],
    }
  );

// Zod Schema for updating workflow task item associations
export const UpdateWorkflowTaskItemAssociationSchema = z.object({
  quantity: z.number().positive().optional(),
  is_required: z.boolean().optional(),
  status: TaskItemStatusSchema.optional(),
  loaded_by: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional().nullable(),
});

// Type Exports
export type CreateWorkflowTaskItemAssociationInput = z.infer<typeof CreateWorkflowTaskItemAssociationSchema>;
export type UpdateWorkflowTaskItemAssociationInput = z.infer<typeof UpdateWorkflowTaskItemAssociationSchema>;

// Type Guards
export const isTaskItemStatus = (value: string): value is TaskItemStatus => {
  return Object.values(TaskItemStatus).includes(value as TaskItemStatus);
};

export const isItemAssociation = (assoc: WorkflowTaskItemAssociation): boolean => {
  return assoc.item_id !== null && assoc.kit_id === null;
};

export const isKitAssociation = (assoc: WorkflowTaskItemAssociation): boolean => {
  return assoc.kit_id !== null && assoc.item_id === null;
};

export const isLoadedAssociation = (assoc: WorkflowTaskItemAssociation): boolean => {
  return assoc.status === TaskItemStatus.LOADED || assoc.status === TaskItemStatus.VERIFIED;
};

// Validation helper for XOR constraint at runtime
export const validateAssociationXOR = (
  input: CreateWorkflowTaskItemAssociationInput
): { valid: boolean; error?: string } => {
  const hasItemId = !!input.item_id;
  const hasKitId = !!input.kit_id;

  if (hasItemId && hasKitId) {
    return {
      valid: false,
      error: 'Cannot specify both item_id and kit_id. Only one is allowed.',
    };
  }

  if (!hasItemId && !hasKitId) {
    return {
      valid: false,
      error: 'Must specify either item_id or kit_id.',
    };
  }

  return { valid: true };
};

// Validation helper for status transitions
export const validateStatusTransition = (
  currentStatus: TaskItemStatus,
  newStatus: TaskItemStatus
): { valid: boolean; error?: string } => {
  // Define valid status transitions
  const validTransitions: Record<TaskItemStatus, TaskItemStatus[]> = {
    [TaskItemStatus.PENDING]: [TaskItemStatus.LOADED, TaskItemStatus.MISSING],
    [TaskItemStatus.LOADED]: [TaskItemStatus.VERIFIED, TaskItemStatus.PENDING, TaskItemStatus.MISSING],
    [TaskItemStatus.VERIFIED]: [TaskItemStatus.RETURNED, TaskItemStatus.MISSING],
    [TaskItemStatus.MISSING]: [TaskItemStatus.LOADED, TaskItemStatus.PENDING],
    [TaskItemStatus.RETURNED]: [TaskItemStatus.PENDING],
  };

  if (currentStatus === newStatus) {
    return { valid: true };
  }

  const allowedTransitions = validTransitions[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
};

// Validation helper for task completion requirements
export const validateRequiredItemsLoaded = (
  associations: WorkflowTaskItemAssociation[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  const requiredPending = associations.filter(
    (assoc) => assoc.is_required && assoc.status === TaskItemStatus.PENDING
  );

  if (requiredPending.length > 0) {
    errors.push(
      `${requiredPending.length} required item(s) not loaded. Task cannot be completed.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Repository error types
export interface WorkflowTaskAssociationRepositoryError {
  code: string;
  message: string;
  details?: any;
}

// Service error types
export interface WorkflowTaskAssociationServiceError {
  code: string;
  message: string;
  details?: any;
}

// Result type for functional error handling
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  result.ok === false;

export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok === true;
