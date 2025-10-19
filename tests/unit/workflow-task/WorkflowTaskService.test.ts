/**
 * @file tests/unit/workflow-task/WorkflowTaskService.test.ts
 * @purpose Unit tests for WorkflowTaskService
 * @coverage T015: validateJobCompletion, completeTask, getTaskList
 */

import { WorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { TaskStatus, VerificationMethod } from '@/domains/workflow-task/types/workflow-task-types';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';

// Mock the repository
jest.mock('@/domains/workflow-task/repositories/WorkflowTaskRepository');

const baseTimestamp = new Date().toISOString();

const createWorkflowTaskMock = (overrides: Partial<WorkflowTask>): WorkflowTask => ({
  id: 'task-base',
  tenant_id: 'tenant-1',
  job_id: 'job-1',
  task_description: 'Base task',
  task_order: 0,
  status: TaskStatus.PENDING,
  is_required: true,
  is_deleted: false,
  template_id: null,
  requires_photo_verification: false,
  requires_supervisor_approval: false,
  verification_photo_url: null,
  ai_confidence: null,
  verification_method: VerificationMethod.MANUAL,
  verification_data: null,
  acceptance_criteria: null,
  requires_supervisor_review: null,
  supervisor_approved: null,
  supervisor_notes: null,
  completed_by: null,
  completed_at: null,
  user_id: null,
  created_at: baseTimestamp,
  updated_at: baseTimestamp,
  ...overrides,
});

describe('WorkflowTaskService', () => {
  let service: WorkflowTaskService;
  let mockRepo: jest.Mocked<WorkflowTaskRepository>;

  beforeEach(() => {
    mockRepo = new WorkflowTaskRepository(null as any) as jest.Mocked<WorkflowTaskRepository>;
    service = new WorkflowTaskService(mockRepo);
  });

  describe('validateJobCompletion', () => {
    it('should return Ok(true) when all required tasks are complete', async () => {
      // No incomplete required tasks
      mockRepo.findIncompleteRequired = jest.fn().mockResolvedValue({
        ok: true,
        value: [],
      });

      const result = await service.validateJobCompletion('job-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
      expect(mockRepo.findIncompleteRequired).toHaveBeenCalledWith('job-1');
    });

    it('should return error when required tasks are incomplete', async () => {
      const incompleteTasks: WorkflowTask[] = [
        createWorkflowTaskMock({
          id: 'task-1',
          task_description: 'Incomplete required task',
          task_order: 0,
          status: TaskStatus.PENDING,
        }),
        createWorkflowTaskMock({
          id: 'task-2',
          task_description: 'Another incomplete',
          task_order: 1,
          status: TaskStatus.IN_PROGRESS,
        }),
      ];

      mockRepo.findIncompleteRequired = jest.fn().mockResolvedValue({
        ok: true,
        value: incompleteTasks,
      });

      const result = await service.validateJobCompletion('job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('REQUIRED_TASKS_INCOMPLETE');
        expect(result.error.message).toContain('2 required task(s) incomplete');
        expect(result.error.details?.incompleteTasks).toHaveLength(2);
      }
    });

    it('should handle repository errors', async () => {
      mockRepo.findIncompleteRequired = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Database error',
        },
      });

      const result = await service.validateJobCompletion('job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Failed to validate job completion');
      }
    });

    it('should handle unexpected errors', async () => {
      mockRepo.findIncompleteRequired = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await service.validateJobCompletion('job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNEXPECTED_ERROR');
      }
    });
  });

  describe('completeTask', () => {
    const mockTask: WorkflowTask = createWorkflowTaskMock({
      id: 'task-1',
      task_description: 'Task to complete',
      status: TaskStatus.IN_PROGRESS,
      requires_photo_verification: true,
      requires_supervisor_approval: false,
    });

    it('should successfully complete task with verification data', async () => {
      mockRepo.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTask,
      });

      const completedTask: WorkflowTask = {
        ...mockTask,
        status: TaskStatus.COMPLETE,
        completed_at: baseTimestamp,
        verification_photo_url: 'https://storage.example.com/photo.jpg',
        ai_confidence: 0.95,
        verification_method: VerificationMethod.VLM,
      };

      mockRepo.update = jest.fn().mockResolvedValue({
        ok: true,
        value: completedTask,
      });

      const result = await service.completeTask('task-1', 'user-1', {
        photoUrl: 'https://storage.example.com/photo.jpg',
        aiConfidence: 0.95,
        verificationMethod: VerificationMethod.VLM,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(TaskStatus.COMPLETE);
        expect(result.value.verification_photo_url).toBe('https://storage.example.com/photo.jpg');
        expect(result.value.ai_confidence).toBe(0.95);
      }

      expect(mockRepo.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: TaskStatus.COMPLETE,
          verification_photo_url: 'https://storage.example.com/photo.jpg',
          ai_confidence: 0.95,
          verification_method: VerificationMethod.VLM,
        })
      );
    });

    it('should enforce photo verification requirement', async () => {
      // Task requires photo verification
      mockRepo.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTask,
      });

      // But no photo provided
      const result = await service.completeTask('task-1', 'user-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PHOTO_VERIFICATION_REQUIRED');
        expect(result.error.message).toContain('photo verification required but not provided');
      }

      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should allow completion without photo if not required', async () => {
      const taskNoPhoto = {
        ...mockTask,
        requires_photo_verification: false,
      };

      mockRepo.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: taskNoPhoto,
      });

      const completedTask = {
        ...taskNoPhoto,
        status: TaskStatus.COMPLETE,
        completed_at: new Date().toISOString(),
      };

      mockRepo.update = jest.fn().mockResolvedValue({
        ok: true,
        value: completedTask,
      });

      const result = await service.completeTask('task-1', 'user-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(TaskStatus.COMPLETE);
      }
    });

    it('should return error if task not found', async () => {
      mockRepo.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: null,
      });

      const result = await service.completeTask('task-1', 'user-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_NOT_FOUND');
      }
    });

    it('should handle repository fetch errors', async () => {
      mockRepo.findById = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Database error',
        },
      });

      const result = await service.completeTask('task-1', 'user-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_FETCH_FAILED');
      }
    });

    it('should handle repository update errors', async () => {
      mockRepo.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: { ...mockTask, requires_photo_verification: false },
      });

      mockRepo.update = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Update failed',
        },
      });

      const result = await service.completeTask('task-1', 'user-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_UPDATE_FAILED');
      }
    });

    it('should set completed_at timestamp', async () => {
      const taskNoPhoto = {
        ...mockTask,
        requires_photo_verification: false,
      };

      mockRepo.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: taskNoPhoto,
      });

      mockRepo.update = jest.fn().mockResolvedValue({
        ok: true,
        value: {
          ...taskNoPhoto,
          status: TaskStatus.COMPLETE,
          completed_at: new Date().toISOString(),
        },
      });

      const result = await service.completeTask('task-1', 'user-1');

      expect(mockRepo.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: TaskStatus.COMPLETE,
          completed_at: expect.any(String),
        })
      );
    });
  });

  describe('getTaskList', () => {
    it('should return task list for a job', async () => {
      const mockTasks: WorkflowTask[] = [
        createWorkflowTaskMock({
          id: 'task-1',
          task_description: 'Task 1',
          task_order: 0,
          is_required: true,
          status: TaskStatus.PENDING,
          requires_photo_verification: false,
        }),
        createWorkflowTaskMock({
          id: 'task-2',
          task_description: 'Task 2',
          task_order: 1,
          is_required: false,
          status: TaskStatus.COMPLETE,
          requires_photo_verification: true,
        }),
      ];

      mockRepo.findByJobId = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTasks,
      });

      const result = await service.getTaskList('job-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].id).toBe('task-1');
        expect(result.value[1].id).toBe('task-2');
      }

      expect(mockRepo.findByJobId).toHaveBeenCalledWith('job-1');
    });

    it('should return empty array when no tasks exist', async () => {
      mockRepo.findByJobId = jest.fn().mockResolvedValue({
        ok: true,
        value: [],
      });

      const result = await service.getTaskList('job-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should handle repository errors', async () => {
      mockRepo.findByJobId = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Database error',
        },
      });

      const result = await service.getTaskList('job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_FETCH_FAILED');
      }
    });

    it('should handle unexpected errors', async () => {
      mockRepo.findByJobId = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await service.getTaskList('job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNEXPECTED_ERROR');
      }
    });
  });
});
