// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/task-template/types/task-template-association-types.ts
// phase: 3.2
// domain: task-template
// purpose: Types for task template item associations (linking items/kits to template tasks)
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
//   - TaskTemplateItemAssociation: interface - Template item association entity
//   - TaskTemplateItemAssociationWithDetails: interface - Association with joined item/kit data
//   - CreateTaskTemplateItemAssociationInput: type - Association creation payload
//   - UpdateTaskTemplateItemAssociationInput: type - Association update payload
//   - CreateTaskTemplateItemAssociationSchema: schema - Validation for creation
//   - UpdateTaskTemplateItemAssociationSchema: schema - Validation for updates
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/task-template/task-template-association-types.test.ts
//
// tasks:
//   1. Define association entity interfaces
//   2. Create input/output types
//   3. Implement Zod validation schemas with XOR constraint
//   4. Add type guards and helpers
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

// Core Task Template Item Association Entity
export interface TaskTemplateItemAssociation {
  id: string;
  tenant_id: string;
  template_item_id: string;
  item_id: string | null;
  kit_id: string | null;
  quantity: number;
  is_required: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Association with joined item/kit details for display purposes
export interface TaskTemplateItemAssociationWithDetails extends TaskTemplateItemAssociation {
  item_name?: string | null;
  item_description?: string | null;
  kit_name?: string | null;
  kit_description?: string | null;
}

// Zod Schema for creating template item associations
// Enforces XOR constraint: exactly one of item_id OR kit_id must be provided
export const CreateTaskTemplateItemAssociationSchema = z
  .object({
    item_id: z.string().uuid().optional(),
    kit_id: z.string().uuid().optional(),
    quantity: z.number().positive().default(1),
    is_required: z.boolean().default(true),
    notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional(),
  })
  .refine(
    (data) => (data.item_id && !data.kit_id) || (!data.item_id && data.kit_id),
    {
      message: 'Exactly one of item_id or kit_id must be provided (XOR)',
      path: ['item_id'],
    }
  );

// Zod Schema for updating template item associations
export const UpdateTaskTemplateItemAssociationSchema = z.object({
  quantity: z.number().positive().optional(),
  is_required: z.boolean().optional(),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional().nullable(),
});

// Type Exports
export type CreateTaskTemplateItemAssociationInput = z.infer<typeof CreateTaskTemplateItemAssociationSchema>;
export type UpdateTaskTemplateItemAssociationInput = z.infer<typeof UpdateTaskTemplateItemAssociationSchema>;

// Type guards
export const isItemAssociation = (assoc: TaskTemplateItemAssociation): boolean => {
  return assoc.item_id !== null && assoc.kit_id === null;
};

export const isKitAssociation = (assoc: TaskTemplateItemAssociation): boolean => {
  return assoc.kit_id !== null && assoc.item_id === null;
};

// Validation helper for XOR constraint at runtime
export const validateAssociationXOR = (
  input: CreateTaskTemplateItemAssociationInput
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

// Repository error types
export interface TaskTemplateAssociationRepositoryError {
  code: string;
  message: string;
  details?: any;
}

// Service error types
export interface TaskTemplateAssociationServiceError {
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
