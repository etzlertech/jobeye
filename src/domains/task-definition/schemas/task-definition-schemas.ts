/**
 * @fileoverview Task Definition Zod validation schemas
 * @module domains/task-definition/schemas
 *
 * @ai-context
 * Purpose: Zod schemas for validating task definition inputs
 * Pattern: Validation layer using Zod
 * Dependencies: zod
 * Usage: Import in API routes and services for input validation
 *
 * @ai-rules
 * - All validation rules must match data-model.md specifications
 * - Provide clear error messages for validation failures
 * - Use Zod's built-in validators (min, max, trim, etc.)
 * - Keep schemas DRY by reusing base schemas
 */

import { z } from 'zod';

/**
 * Schema for creating a new task definition
 * Validates POST /api/task-definitions input
 *
 * Validation rules from data-model.md:
 * - name: required, 1-255 chars (after trim)
 * - description: required, 1-2000 chars
 * - acceptance_criteria: optional, max 2000 chars
 * - boolean flags have defaults
 */
export const CreateTaskDefinitionSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less')
    .trim()
    .refine((val) => val.length > 0, {
      message: 'Name cannot be empty or whitespace only',
    }),

  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description must be 2000 characters or less')
    .refine((val) => val.trim().length > 0, {
      message: 'Description cannot be empty or whitespace only',
    }),

  acceptance_criteria: z
    .string()
    .max(2000, 'Acceptance criteria must be 2000 characters or less')
    .nullable()
    .optional(),

  requires_photo_verification: z.boolean().default(false),

  requires_supervisor_approval: z.boolean().default(false),

  is_required: z.boolean().default(true),
});

/**
 * Schema for updating an existing task definition
 * Validates PATCH /api/task-definitions/:id input
 * All fields are optional (partial update)
 */
export const UpdateTaskDefinitionSchema = CreateTaskDefinitionSchema.partial();

/**
 * Inferred TypeScript types from Zod schemas
 * These match the types in task-definition-types.ts
 */
export type CreateTaskDefinitionInput = z.infer<typeof CreateTaskDefinitionSchema>;
export type UpdateTaskDefinitionInput = z.infer<typeof UpdateTaskDefinitionSchema>;
