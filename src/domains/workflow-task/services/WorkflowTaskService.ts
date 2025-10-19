// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/workflow-task/services/WorkflowTaskService.ts
// phase: 3.4
// domain: workflow-task
// purpose: Business logic for workflow task operations and job completion validation
// spec_ref: specs/011-making-task-lists/spec.md
// version: 2025-10-18
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

import { WorkflowTaskRepository } from '../repositories/WorkflowTaskRepository';
import {
  WorkflowTask,
  TaskStatus,
  UpdateTaskInput,
  ServiceError,
  Result,
  Ok,
  Err,
  validateTaskCompletion,
} from '../types/workflow-task-types';

export interface VerificationInput {
  photoUrl?: string;
  aiConfidence?: number;
  verificationMethod?: 'manual' | 'vlm' | 'yolo';
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

      if (!result.ok) {
        return Err({
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate job completion',
          details: result.error,
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

      if (!taskResult.ok) {
        return Err({
          code: 'TASK_FETCH_FAILED',
          message: 'Failed to fetch task',
          details: taskResult.error,
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

      if (!updateResult.ok) {
        return Err({
          code: 'TASK_UPDATE_FAILED',
          message: 'Failed to complete task',
          details: updateResult.error,
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

      if (!result.ok) {
        return Err({
          code: 'TASK_FETCH_FAILED',
          message: 'Failed to fetch task list',
          details: result.error,
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
}

// Convenience export
export const createWorkflowTaskService = (repo: WorkflowTaskRepository): WorkflowTaskService => {
  return new WorkflowTaskService(repo);
};
