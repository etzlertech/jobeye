// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/workflow-task/types/workflow-task-types.ts
// phase: 3.4
// domain: workflow-task
// purpose: Workflow task types and Zod schemas for task list feature
// spec_ref: specs/013-lets-plan-to/spec.md
// version: 2025-10-20
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   external:
//     - zod: ^3.23.0
//
// exports:
//   - WorkflowTask: interface - Core workflow task entity
//   - TaskStatus: enum - Task lifecycle states
//   - VerificationMethod: enum - Task verification methods
//   - CreateTaskInput: type - Task creation payload
//   - UpdateTaskInput: type - Task update payload
//   - CreateTaskSchema: schema - Validation for task creation
//   - UpdateTaskSchema: schema - Validation for task updates
//
// voice_considerations: |
//   Support voice task operations (list, complete, add, navigate).
//   Store voice confirmation metadata.
//   Target response time: <2 seconds
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/workflow-task/workflow-task-types.test.ts
//
// tasks:
//   1. Define task status enum
//   2. Create task entity interface
//   3. Implement Zod validation schemas
//   4. Add type guards and validators
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';

// Task Status Enum
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETE = 'complete',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

// Verification Method Enum
export enum VerificationMethod {
  MANUAL = 'manual',
  VLM = 'vlm',
  YOLO = 'yolo',
}

// Core Workflow Task Entity
export interface WorkflowTask {
  id: string;
  tenant_id: string;
  job_id: string;
  task_description: string;
  task_order: number;
  status: TaskStatus;
  is_required: boolean;
  is_deleted: boolean;
  template_id: string | null;

  // Verification fields
  requires_photo_verification: boolean;
  requires_supervisor_approval: boolean;
  verification_photo_url: string | null;
  ai_confidence: number | null;
  verification_method: VerificationMethod;
  verification_data: Record<string, any> | null;
  acceptance_criteria: string | null;

  // Supervisor review
  requires_supervisor_review: boolean | null;
  supervisor_approved: boolean | null;
  supervisor_notes: string | null;

  // Completion tracking
  completed_by: string | null;
  completed_at: string | null;
  user_id: string | null;

  // Image references
  thumbnail_url: string | null;
  medium_url: string | null;
  primary_image_url: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Bundle type for task image URLs
export interface WorkflowTaskImageUrls {
  thumbnail_url: string | null;
  medium_url: string | null;
  primary_image_url: string | null;
}

// Zod Schemas
export const TaskStatusSchema = z.nativeEnum(TaskStatus);

export const VerificationMethodSchema = z.nativeEnum(VerificationMethod);

export const CreateTaskSchema = z.object({
  job_id: z.string().uuid('Job ID must be a valid UUID'),
  task_description: z.string().min(1, 'Task description is required').max(500, 'Task description must be 500 characters or less'),
  task_order: z.number().int().min(0, 'Task order must be >= 0'),
  is_required: z.boolean().default(true),
  requires_photo_verification: z.boolean().default(false),
  requires_supervisor_approval: z.boolean().default(false),
  acceptance_criteria: z.string().max(1000, 'Acceptance criteria must be 1000 characters or less').optional(),
  task_type: z.string().max(50).default('verification'),
});

export const UpdateTaskSchema = z.object({
  task_description: z.string().min(1).max(500).optional(),
  task_order: z.number().int().min(0).optional(),
  status: TaskStatusSchema.optional(),
  completed_at: z.string().datetime().optional(),
  verification_photo_url: z.string().url('Verification photo must be a valid URL').optional(),
  ai_confidence: z.number().min(0).max(1, 'AI confidence must be between 0 and 1').optional(),
  verification_method: VerificationMethodSchema.optional(),
  verification_data: z.record(z.any()).optional(),
  supervisor_notes: z.string().max(1000).optional(),
});

// Type Exports
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type WorkflowTaskImageUrlsInput = WorkflowTaskImageUrls;

// Type Guards
export const isTaskStatus = (value: string): value is TaskStatus => {
  return Object.values(TaskStatus).includes(value as TaskStatus);
};

export const isVerificationMethod = (value: string): value is VerificationMethod => {
  return Object.values(VerificationMethod).includes(value as VerificationMethod);
};

// Validation helpers
export const validateTaskCompletion = (task: Partial<WorkflowTask>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // If marking complete and requires photo verification, photo must be provided
  if (task.status === TaskStatus.COMPLETE && task.requires_photo_verification && !task.verification_photo_url) {
    errors.push('Photo verification required but not provided');
  }

  // If marking complete, completed_at should be set
  if (task.status === TaskStatus.COMPLETE && !task.completed_at) {
    errors.push('Completion timestamp required when marking task complete');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Repository error types
export interface RepositoryError {
  code: string;
  message: string;
  details?: any;
}

// Service error types
export interface ServiceError {
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
