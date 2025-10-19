/**
 * @fileoverview Unit tests for TaskDefinitionService
 * @module tests/unit/task-definition/service
 *
 * @ai-context
 * Purpose: Test service layer business logic for task definitions
 * Pattern: Unit testing with Jest, mocking repository
 * Dependencies: Service (TO BE IMPLEMENTED), Repository
 * Status: TDD - These tests WILL FAIL until service is implemented
 */

import { TaskDefinitionService } from '@/domains/task-definition/services/TaskDefinitionService';
import { TaskDefinitionRepository } from '@/domains/task-definition/repositories/TaskDefinitionRepository';
import type { TaskDefinition } from '@/domains/task-definition/types/task-definition-types';

// Mock repository
jest.mock('@/domains/task-definition/repositories/TaskDefinitionRepository');

describe('TaskDefinitionService', () => {
  let service: TaskDefinitionService;
  let mockRepository: jest.Mocked<TaskDefinitionRepository>;

  beforeEach(() => {
    mockRepository = new TaskDefinitionRepository(null as any) as jest.Mocked<TaskDefinitionRepository>;
    service = new TaskDefinitionService(mockRepository);
  });

  describe('createTaskDefinition', () => {
    it('should create task definition with userId', async () => {
      const input = {
        name: 'Test task',
        description: 'Test description',
      };

      const mockCreated: TaskDefinition = {
        id: '123',
        tenant_id: 'tenant-1',
        name: input.name,
        description: input.description,
        acceptance_criteria: null,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        is_required: true,
        created_by: 'user-1',
        created_at: '2025-10-19T00:00:00Z',
        updated_at: '2025-10-19T00:00:00Z',
        deleted_at: null,
      };

      mockRepository.create = jest.fn().mockResolvedValue({
        ok: true,
        value: mockCreated,
      });

      const result = await service.createTaskDefinition(input, 'user-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.created_by).toBe('user-1');
        expect(result.value.name).toBe(input.name);
      }
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should return validation error from repository', async () => {
      const input = {
        name: '',
        description: 'Test',
      };

      mockRepository.create = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name is required',
        },
      });

      const result = await service.createTaskDefinition(input, 'user-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle database errors gracefully', async () => {
      const input = {
        name: 'Test',
        description: 'Test',
      };

      mockRepository.create = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Connection failed',
        },
      });

      const result = await service.createTaskDefinition(input, 'user-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNKNOWN');
        expect(result.error.message).toContain('database');
      }
    });
  });

  describe('updateTaskDefinition', () => {
    it('should update task definition', async () => {
      const update = {
        name: 'Updated name',
      };

      const mockUpdated: TaskDefinition = {
        id: '123',
        tenant_id: 'tenant-1',
        name: 'Updated name',
        description: 'Original description',
        acceptance_criteria: null,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        is_required: true,
        created_by: 'user-1',
        created_at: '2025-10-19T00:00:00Z',
        updated_at: '2025-10-19T12:00:00Z',
        deleted_at: null,
      };

      mockRepository.update = jest.fn().mockResolvedValue({
        ok: true,
        value: mockUpdated,
      });

      const result = await service.updateTaskDefinition('123', update);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Updated name');
      }
      expect(mockRepository.update).toHaveBeenCalledWith('123', update);
    });

    it('should prevent updating deleted task definition', async () => {
      const update = {
        name: 'Updated name',
      };

      const mockDeleted: TaskDefinition = {
        id: '123',
        tenant_id: 'tenant-1',
        name: 'Deleted task',
        description: 'Test',
        acceptance_criteria: null,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        is_required: true,
        created_by: 'user-1',
        created_at: '2025-10-19T00:00:00Z',
        updated_at: '2025-10-19T00:00:00Z',
        deleted_at: '2025-10-19T12:00:00Z',
      };

      mockRepository.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: mockDeleted,
      });

      const result = await service.updateTaskDefinition('123', update);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('deleted');
      }
    });

    it('should return NOT_FOUND when task does not exist', async () => {
      mockRepository.update = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task definition not found',
        },
      });

      const result = await service.updateTaskDefinition('non-existent', { name: 'Test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('deleteTaskDefinition', () => {
    it('should delete unused task definition', async () => {
      mockRepository.delete = jest.fn().mockResolvedValue({
        ok: true,
        value: undefined,
      });

      const result = await service.deleteTaskDefinition('123');

      expect(result.ok).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledWith('123');
    });

    it('should enforce usage guard and return IN_USE error', async () => {
      mockRepository.delete = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'IN_USE',
          message: 'Task definition is in use',
          details: {
            templateCount: 2,
            templateNames: ['Daily Inspection', 'Weekly Check'],
          },
        },
      });

      const result = await service.deleteTaskDefinition('123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('IN_USE');
        expect(result.error.details).toHaveProperty('templateCount', 2);
      }
    });

    it('should return NOT_FOUND when task does not exist', async () => {
      mockRepository.delete = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task definition not found',
        },
      });

      const result = await service.deleteTaskDefinition('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getTaskDefinitionUsage', () => {
    it('should return usage statistics', async () => {
      const mockUsage = {
        templateCount: 3,
        templateIds: ['t1', 't2', 't3'],
        templateNames: ['Template 1', 'Template 2', 'Template 3'],
      };

      mockRepository.checkUsage = jest.fn().mockResolvedValue({
        ok: true,
        value: mockUsage,
      });

      const result = await service.getTaskDefinitionUsage('123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.templateCount).toBe(3);
        expect(result.value.templateNames).toHaveLength(3);
      }
      expect(mockRepository.checkUsage).toHaveBeenCalledWith('123');
    });

    it('should return zero usage for unused task', async () => {
      const mockUsage = {
        templateCount: 0,
        templateIds: [],
        templateNames: [],
      };

      mockRepository.checkUsage = jest.fn().mockResolvedValue({
        ok: true,
        value: mockUsage,
      });

      const result = await service.getTaskDefinitionUsage('123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.templateCount).toBe(0);
      }
    });

    it('should handle repository errors', async () => {
      mockRepository.checkUsage = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Query failed',
        },
      });

      const result = await service.getTaskDefinitionUsage('123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNKNOWN');
      }
    });
  });

  describe('listTaskDefinitions', () => {
    it('should return all active task definitions', async () => {
      const mockDefinitions: TaskDefinition[] = [
        {
          id: '1',
          tenant_id: 'tenant-1',
          name: 'Task 1',
          description: 'Description 1',
          acceptance_criteria: null,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          is_required: true,
          created_by: 'user-1',
          created_at: '2025-10-19T00:00:00Z',
          updated_at: '2025-10-19T00:00:00Z',
          deleted_at: null,
        },
        {
          id: '2',
          tenant_id: 'tenant-1',
          name: 'Task 2',
          description: 'Description 2',
          acceptance_criteria: null,
          requires_photo_verification: true,
          requires_supervisor_approval: false,
          is_required: true,
          created_by: 'user-1',
          created_at: '2025-10-19T00:00:00Z',
          updated_at: '2025-10-19T00:00:00Z',
          deleted_at: null,
        },
      ];

      mockRepository.findAll = jest.fn().mockResolvedValue({
        ok: true,
        value: mockDefinitions,
      });

      const result = await service.listTaskDefinitions();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
      expect(mockRepository.findAll).toHaveBeenCalledWith(false);
    });

    it('should include deleted definitions when requested', async () => {
      mockRepository.findAll = jest.fn().mockResolvedValue({
        ok: true,
        value: [],
      });

      await service.listTaskDefinitions(true);

      expect(mockRepository.findAll).toHaveBeenCalledWith(true);
    });

    it('should handle empty results', async () => {
      mockRepository.findAll = jest.fn().mockResolvedValue({
        ok: true,
        value: [],
      });

      const result = await service.listTaskDefinitions();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });
  });

  describe('getTaskDefinitionById', () => {
    it('should return task definition by id', async () => {
      const mockDefinition: TaskDefinition = {
        id: '123',
        tenant_id: 'tenant-1',
        name: 'Test task',
        description: 'Test description',
        acceptance_criteria: null,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        is_required: true,
        created_by: 'user-1',
        created_at: '2025-10-19T00:00:00Z',
        updated_at: '2025-10-19T00:00:00Z',
        deleted_at: null,
      };

      mockRepository.findById = jest.fn().mockResolvedValue({
        ok: true,
        value: mockDefinition,
      });

      const result = await service.getTaskDefinitionById('123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('123');
      }
      expect(mockRepository.findById).toHaveBeenCalledWith('123');
    });

    it('should return NOT_FOUND for non-existent task', async () => {
      mockRepository.findById = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task definition not found',
        },
      });

      const result = await service.getTaskDefinitionById('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
