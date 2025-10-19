/**
 * @fileoverview Unit tests for TaskDefinitionRepository
 * @module tests/unit/task-definition/repository
 *
 * @ai-context
 * Purpose: Test repository layer for task definitions
 * Pattern: Unit testing with Jest, mocking Supabase client
 * Dependencies: Repository (TO BE IMPLEMENTED)
 * Status: TDD - These tests WILL FAIL until repository is implemented
 */

import { TaskDefinitionRepository } from '@/domains/task-definition/repositories/TaskDefinitionRepository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Mock Supabase client
const createMockSupabaseClient = (): jest.Mocked<SupabaseClient<Database>> => {
  return {
    from: jest.fn(),
  } as unknown as jest.Mocked<SupabaseClient<Database>>;
};

describe('TaskDefinitionRepository', () => {
  let mockClient: jest.Mocked<SupabaseClient<Database>>;
  let repository: TaskDefinitionRepository;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    repository = new TaskDefinitionRepository(mockClient);
  });

  describe('findAll', () => {
    it('should return all active task definitions', async () => {
      const mockData = [
        {
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
        },
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await repository.findAll();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(mockData);
        expect(result.value).toHaveLength(1);
      }
    });

    it('should include deleted definitions when include_deleted=true', async () => {
      const mockData = [
        {
          id: '123',
          tenant_id: 'tenant-1',
          name: 'Deleted task',
          description: 'Test description',
          acceptance_criteria: null,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          is_required: true,
          created_by: 'user-1',
          created_at: '2025-10-19T00:00:00Z',
          updated_at: '2025-10-19T00:00:00Z',
          deleted_at: '2025-10-19T12:00:00Z',
        },
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockData,
            error: null,
          }),
        }),
      } as any);

      const result = await repository.findAll(true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(mockData);
      }
    });

    it('should return error on database failure', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error', code: 'DB_ERROR' },
            }),
          }),
        }),
      } as any);

      const result = await repository.findAll();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  describe('findById', () => {
    it('should return task definition by id', async () => {
      const mockData = {
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

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await repository.findById('123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(mockData);
      }
    });

    it('should return NOT_FOUND error when task does not exist', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      } as any);

      const result = await repository.findById('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('create', () => {
    it('should create a new task definition', async () => {
      const input = {
        name: 'New task',
        description: 'New description',
        acceptance_criteria: 'Criteria',
        requires_photo_verification: true,
        requires_supervisor_approval: false,
        is_required: true,
      };

      const mockCreated = {
        id: '456',
        tenant_id: 'tenant-1',
        ...input,
        created_by: 'user-1',
        created_at: '2025-10-19T00:00:00Z',
        updated_at: '2025-10-19T00:00:00Z',
        deleted_at: null,
      };

      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreated,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await repository.create(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('456');
        expect(result.value.name).toBe(input.name);
      }
    });

    it('should return validation error on constraint violation', async () => {
      const input = {
        name: '',
        description: 'Test',
      };

      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23514', message: 'Check constraint violation' },
            }),
          }),
        }),
      } as any);

      const result = await repository.create(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('update', () => {
    it('should update task definition', async () => {
      const update = {
        name: 'Updated name',
        description: 'Updated description',
      };

      const mockUpdated = {
        id: '123',
        tenant_id: 'tenant-1',
        name: 'Updated name',
        description: 'Updated description',
        acceptance_criteria: null,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        is_required: true,
        created_by: 'user-1',
        created_at: '2025-10-19T00:00:00Z',
        updated_at: '2025-10-19T12:00:00Z',
        deleted_at: null,
      };

      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdated,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const result = await repository.update('123', update);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Updated name');
        expect(result.value.updated_at).not.toBe(result.value.created_at);
      }
    });

    it('should return NOT_FOUND when updating non-existent task', async () => {
      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
              }),
            }),
          }),
        }),
      } as any);

      const result = await repository.update('non-existent', { name: 'Test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('delete', () => {
    it('should soft delete task definition when not in use', async () => {
      // Mock usage check - not in use
      mockClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      } as any);

      // Mock update for soft delete
      mockClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      } as any);

      const result = await repository.delete('123');

      expect(result.ok).toBe(true);
    });

    it('should return IN_USE error when task is in templates', async () => {
      const mockTemplates = [
        {
          template_id: 'template-1',
          template_name: 'Daily Inspection',
        },
      ];

      mockClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockTemplates,
            error: null,
          }),
        }),
      } as any);

      const result = await repository.delete('123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('IN_USE');
        expect(result.error.details).toHaveProperty('templateCount', 1);
        expect(result.error.details).toHaveProperty('templateNames');
      }
    });
  });

  describe('checkUsage', () => {
    it('should return usage statistics', async () => {
      const mockTemplates = [
        {
          template_id: 'template-1',
          template_name: 'Daily Inspection',
        },
        {
          template_id: 'template-2',
          template_name: 'Weekly Check',
        },
      ];

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockTemplates,
            error: null,
          }),
        }),
      } as any);

      const result = await repository.checkUsage('123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.templateCount).toBe(2);
        expect(result.value.templateIds).toHaveLength(2);
        expect(result.value.templateNames).toContain('Daily Inspection');
      }
    });

    it('should return zero usage when not in any templates', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      } as any);

      const result = await repository.checkUsage('123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.templateCount).toBe(0);
        expect(result.value.templateIds).toHaveLength(0);
        expect(result.value.templateNames).toHaveLength(0);
      }
    });
  });
});
