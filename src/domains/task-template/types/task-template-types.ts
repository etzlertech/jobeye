// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/task-template/types/task-template-types.ts
// phase: 3.4
// domain: task-template
// purpose: Task template types and Zod schemas for reusable task templates
// spec_ref: specs/013-lets-plan-to/spec.md
// version: 2025-10-20
// complexity_budget: 300 LoC
// offline_capability: NOT_REQUIRED
//
// dependencies:
//   external:
//     - zod: ^3.23.0
//
// exports:
//   - TaskTemplate: interface - Template entity
//   - TaskTemplateItem: interface - Template item entity
//   - TemplateWithItems: interface - Template with nested items
//   - CreateTemplateInput: type - Template creation payload
//   - CreateTemplateItemInput: type - Template item creation payload
//   - CreateTemplateSchema: schema - Validation for template creation
//   - CreateTemplateItemSchema: schema - Validation for template item creation
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/task-template/task-template-types.test.ts
//
// tasks:
//   1. Define template entities
//   2. Create template item entities
//   3. Implement Zod validation schemas
//   4. Add type guards
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

// Core Task Template Entity
export interface TaskTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  job_type: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_url: string | null;
  medium_url: string | null;
  primary_image_url: string | null;
}

// Task Template Item Entity
export interface TaskTemplateItem {
  id: string;
  template_id: string;
  task_order: number;
  task_description: string;
  is_required: boolean;
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  acceptance_criteria: string | null;
  source_definition_id?: string | null; // Reference to task_definition if created from library (optional for backward compatibility)
  created_at: string;
}

// Template with nested items
export interface TemplateWithItems extends TaskTemplate {
  items: TaskTemplateItem[];
}
// Template image URL bundle used for repository/service updates
export interface TemplateImageUrls {
  thumbnail_url: string | null;
  medium_url: string | null;
  primary_image_url: string | null;
}

// Zod Schemas
export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255, 'Template name must be 255 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  job_type: z.string().max(100, 'Job type must be 100 characters or less').optional(),
});

export const CreateTemplateItemSchema = z.object({
  task_order: z.number().int().min(0, 'Task order must be >= 0'),
  task_description: z.string().min(1, 'Task description is required').max(500, 'Task description must be 500 characters or less'),
  is_required: z.boolean().default(true),
  requires_photo_verification: z.boolean().default(false),
  requires_supervisor_approval: z.boolean().default(false),
  acceptance_criteria: z.string().max(1000, 'Acceptance criteria must be 1000 characters or less').optional(),
  source_definition_id: z.string().uuid().nullable().optional(), // Link to task_definition if from library
});

export const CreateTemplateWithItemsSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  job_type: z.string().max(100).optional(),
  items: z.array(CreateTemplateItemSchema).min(1, 'Template must have at least 1 item'),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  job_type: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
});

// Type Exports
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type CreateTemplateItemInput = z.infer<typeof CreateTemplateItemSchema>;
export type CreateTemplateWithItemsInput = z.infer<typeof CreateTemplateWithItemsSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type TemplateImageUrlsInput = TemplateImageUrls;

// Validation helpers
export const validateTemplateItems = (items: CreateTemplateItemInput[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check for duplicate task_order values
  const orders = items.map(item => item.task_order);
  const duplicates = orders.filter((order, index) => orders.indexOf(order) !== index);

  if (duplicates.length > 0) {
    errors.push(`Duplicate task_order values found: ${duplicates.join(', ')}`);
  }

  // Validate at least one item exists
  if (items.length === 0) {
    errors.push('Template must have at least one item');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Repository error types (shared with workflow-task)
export interface RepositoryError {
  code: string;
  message: string;
  details?: any;
}

// Service error types (shared with workflow-task)
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

// Result type for functional error handling (shared with workflow-task)
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  result.ok === false;

export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok === true;
