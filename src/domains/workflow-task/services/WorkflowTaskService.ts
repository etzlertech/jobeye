// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/workflow-task/services/WorkflowTaskService.ts
// phase: 3.5
// domain: workflow-task
// purpose: Business logic for workflow task operations and job completion validation
// spec_ref: specs/013-lets-plan-to/spec.md
// version: 2025-10-20
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/workflow-task/repositories/WorkflowTaskRepository
//     - /src/domains/workflow-task/types/workflow-task-types
//
// exports:
//   - WorkflowTaskService: class - Task business logic
//   - validateJobCompletion: function - Check if all required tasks complete
//   - completeTask: function - Mark task complete with validation
//
// voice_considerations: |
//   Support voice-driven task completion.
//   Validate photo verification requirements.
//   Provide clear error messages for voice feedback.
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/workflow-task/WorkflowTaskService.test.ts
//
// tasks:
//   1. Implement job completion validation
//   2. Implement task completion with photo validation
//   3. Add error handling and validation
// --- END DIRECTIVE BLOCK ---

import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkflowTaskRepository } from '../repositories/WorkflowTaskRepository';
import {
  WorkflowTask,
  TaskStatus,
  UpdateTaskInput,
  VerificationMethod,
  ServiceError,
  Result,
  Ok,
  Err,
  isErr,
  validateTaskCompletion,
  WorkflowTaskImageUrls,
} from '../types/workflow-task-types';
import type { ProcessedImages } from '@/utils/image-processor';
import {
  uploadImagesToStorage,
  deleteImagesFromStorage,
} from '@/lib/supabase/storage';

const TASK_IMAGE_BUCKET = 'task-images';
const getStoragePath = (url: string | null | undefined, bucket: string): string | null => {
  if (!url) return null;
  const marker = `${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.substring(index + marker.length);
};

export interface VerificationInput {
  photoUrl?: string;
  aiConfidence?: number;
  verificationMethod?: VerificationMethod;
  verificationData?: Record<string, any>;
}

export class WorkflowTaskService {
  constructor(private repo: WorkflowTaskRepository) {}

  /**
   * Validate if job can be completed (all required tasks complete)
   */
  async validateJobCompletion(jobId: string): Promise<Result<boolean, ServiceError>> {
    try {
      const result = await this.repo.findIncompleteRequired(jobId);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate job completion',
          details: repositoryError,
        });
      }

      const incompleteTasks = result.value;

      if (incompleteTasks.length > 0) {
        return Err({
          code: 'REQUIRED_TASKS_INCOMPLETE',
          message: `Cannot complete job: ${incompleteTasks.length} required task(s) incomplete`,
          details: {
            incompleteTasks: incompleteTasks.map(t => ({
              id: t.id,
              description: t.task_description,
              status: t.status,
            })),
          },
        });
      }

      return Ok(true);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Complete a task with validation
   */
  async completeTask(
    taskId: string,
    userId: string,
    verificationData?: VerificationInput
  ): Promise<Result<WorkflowTask, ServiceError>> {
    try {
      // Get current task
      const taskResult = await this.repo.findById(taskId);

      if (isErr(taskResult)) {
        const { error: repositoryError } = taskResult;
        return Err({
          code: 'TASK_FETCH_FAILED',
          message: 'Failed to fetch task',
          details: repositoryError,
        });
      }

      const task = taskResult.value;

      if (!task) {
        return Err({
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        });
      }

      // Validate photo verification if required
      if (task.requires_photo_verification && !verificationData?.photoUrl) {
        return Err({
          code: 'PHOTO_VERIFICATION_REQUIRED',
          message: 'Cannot complete task: photo verification required but not provided',
        });
      }

      // Build update data
      const updateData: UpdateTaskInput = {
        status: TaskStatus.COMPLETE,
        completed_at: new Date().toISOString(),
      };

      if (verificationData) {
        if (verificationData.photoUrl) {
          updateData.verification_photo_url = verificationData.photoUrl;
        }
        if (verificationData.aiConfidence !== undefined) {
          updateData.ai_confidence = verificationData.aiConfidence;
        }
        if (verificationData.verificationMethod) {
          updateData.verification_method = verificationData.verificationMethod;
        }
        if (verificationData.verificationData) {
          updateData.verification_data = verificationData.verificationData;
        }
      }

      // Validate task completion
      const validation = validateTaskCompletion({
        ...task,
        ...updateData,
      });

      if (!validation.valid) {
        return Err({
          code: 'VALIDATION_ERROR',
          message: validation.errors.join(', '),
          details: validation.errors,
        });
      }

      // Update task
      const updateResult = await this.repo.update(taskId, updateData);

      if (isErr(updateResult)) {
        const { error: repositoryError } = updateResult;
        return Err({
          code: 'TASK_UPDATE_FAILED',
          message: 'Failed to complete task',
          details: repositoryError,
        });
      }

      return Ok(updateResult.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Get task list for a job
   */
  async getTaskList(jobId: string): Promise<Result<WorkflowTask[], ServiceError>> {
    try {
      const result = await this.repo.findByJobId(jobId);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: 'TASK_FETCH_FAILED',
          message: 'Failed to fetch task list',
          details: repositoryError,
        });
      }

      return Ok(result.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Upload and persist workflow task images
   */
  async uploadTaskImage(
    supabaseClient: SupabaseClient,
    taskId: string,
    tenantId: string,
    processedImages: ProcessedImages,
    bucketName = TASK_IMAGE_BUCKET
  ): Promise<Result<WorkflowTask, ServiceError>> {
    try {
      const taskResult = await this.repo.findById(taskId);

      if (isErr(taskResult)) {
        const { error: repositoryError } = taskResult;
        return Err({
          code: 'TASK_FETCH_FAILED',
          message: 'Failed to fetch task',
          details: repositoryError,
        });
      }

      const task = taskResult.value;

      if (!task) {
        return Err({
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        });
      }

      if (task.tenant_id !== tenantId) {
        return Err({
          code: 'FORBIDDEN',
          message: 'Task does not belong to the current tenant',
        });
      }

      let uploadResult: { urls: WorkflowTaskImageUrls; paths: { thumbnail: string; medium: string; full: string } };

      try {
        uploadResult = await uploadImagesToStorage(
          supabaseClient,
          bucketName,
          taskId,
          tenantId,
          processedImages
        );
      } catch (uploadError: any) {
        return Err({
          code: 'IMAGE_UPLOAD_FAILED',
          message: uploadError.message || 'Failed to upload task images',
          details: uploadError,
        });
      }

      const updateResult = await this.repo.updateImageUrls(taskId, uploadResult.urls);

      if (isErr(updateResult)) {
        try {
          await deleteImagesFromStorage(
            supabaseClient,
            bucketName,
            Object.values(uploadResult.paths)
          );
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded task images', cleanupError);
        }

        const { error: repositoryError } = updateResult;
        return Err({
          code: 'IMAGE_UPDATE_FAILED',
          message: 'Failed to persist task image URLs',
          details: repositoryError,
        });
      }

      return Ok(updateResult.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Remove task image (clear URLs and delete stored files when possible)
   */
  async removeTaskImage(
    supabaseClient: SupabaseClient,
    taskId: string,
    tenantId: string,
    bucketName = TASK_IMAGE_BUCKET
  ): Promise<Result<WorkflowTask, ServiceError>> {
    try {
      const taskResult = await this.repo.findById(taskId);

      if (isErr(taskResult)) {
        const { error: repositoryError } = taskResult;
        return Err({
          code: 'TASK_FETCH_FAILED',
          message: 'Failed to fetch task',
          details: repositoryError,
        });
      }

      const task = taskResult.value;

      if (!task) {
        return Err({
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        });
      }

      if (task.tenant_id !== tenantId) {
        return Err({
          code: 'FORBIDDEN',
          message: 'Task does not belong to the current tenant',
        });
      }

      const storagePaths = [
        getStoragePath(task.thumbnail_url, bucketName),
        getStoragePath(task.medium_url, bucketName),
        getStoragePath(task.primary_image_url, bucketName),
      ].filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        try {
          await deleteImagesFromStorage(supabaseClient, bucketName, storagePaths);
        } catch (cleanupError) {
          console.error('Failed to delete task images from storage', cleanupError);
        }
      }

      const updateResult = await this.repo.updateImageUrls(taskId, {
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      });

      if (isErr(updateResult)) {
        const { error: repositoryError } = updateResult;
        return Err({
          code: 'IMAGE_UPDATE_FAILED',
          message: 'Failed to clear task image URLs',
          details: repositoryError,
        });
      }

      return Ok(updateResult.value);
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
export const createWorkflowTaskService = (repo: WorkflowTaskRepository): WorkflowTaskService => {
  return new WorkflowTaskService(repo);
};
