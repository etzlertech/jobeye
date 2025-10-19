/**
 * @file tests/unit/workflow-task/WorkflowTaskRepository.test.ts
 * @purpose Unit tests for WorkflowTaskRepository
 * @coverage T011: findIncompleteRequired, softDelete, createFromTemplate
 */

import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { TaskStatus, VerificationMethod } from '@/domains/workflow-task/types/workflow-task-types';
import type { TaskTemplateItem } from '@/domains/task-template/types/task-template-types';

// Mock Supabase client
const mockSupabaseClient = () => {
  const mockFrom = jest.fn();
  const mockSelect = jest.fn();
  const mockInsert = jest.fn();
  const mockUpdate = jest.fn();
  const mockEq = jest.fn();
  const mockNot = jest.fn();
  const mockOrder = jest.fn();
  const mockSingle = jest.fn();

  // Chain mocking setup
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  });

  // Create separate mocks for different chain paths
  // Single task insert uses: .insert().select().single()
  // Batch task insert uses: .insert().select()
  const mockSelectAfterInsert = jest.fn();
  const mockSingleAfterInsert = jest.fn();

  mockSelect.mockReturnValue({
    eq: mockEq,
    single: mockSingle,
  });

  mockInsert.mockReturnValue({
    select: mockSelectAfterInsert,
  });

  mockSelectAfterInsert.mockReturnValue({
    single: mockSingleAfterInsert,
    then: (resolve: any) => resolve({ data: [], error: null }), // For batch insert
  });

  mockSingleAfterInsert.mockReturnValue({
    then: (resolve: any) => resolve({ data: null, error: null }),
  });

  mockUpdate.mockReturnValue({
    eq: mockEq,
  });

  mockEq.mockReturnValue({
    eq: mockEq,
    not: mockNot,
    order: mockOrder,
    single: mockSingle,
    select: mockSelect,
  });

  mockNot.mockReturnValue({
    order: mockOrder,
  });

  mockOrder.mockReturnValue({
    // Return promise for data
    then: (resolve: any) => resolve({ data: [], error: null }),
  });

  mockSingle.mockReturnValue({
    // Return promise for single record
    then: (resolve: any) => resolve({ data: null, error: null }),
  });

  return {
    from: mockFrom,
    _mocks: {
      from: mockFrom,
      select: mockSelect,
      selectAfterInsert: mockSelectAfterInsert,
      singleAfterInsert: mockSingleAfterInsert,
      insert: mockInsert,
      update: mockUpdate,
      eq: mockEq,
      not: mockNot,
      order: mockOrder,
      single: mockSingle,
    },
  };
};

const buildWorkflowTaskCreateMocks = () => {
  const insertSelectSingle = jest.fn();
  const insertSelect = jest.fn(() => ({
    single: insertSelectSingle,
  }));
  const insert = jest.fn(() => ({
    select: insertSelect,
  }));

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'workflow_tasks') {
        return {
          insert,
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          })),
          delete: jest.fn(),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    client,
    insert,
    insertSelectSingle,
  };
};

describe('WorkflowTaskRepository', () => {
  describe('findIncompleteRequired', () => {
    it('should return only incomplete required tasks', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const mockTasks = [
        {
          id: 'task-1',
          job_id: 'job-1',
          task_description: 'Required incomplete task',
          is_required: true,
          is_deleted: false,
          status: 'pending',
          task_order: 0,
        },
        {
          id: 'task-2',
          job_id: 'job-1',
          task_description: 'Another required incomplete',
          is_required: true,
          is_deleted: false,
          status: 'in-progress',
          task_order: 1,
        },
      ];

      // Mock the chain to return our test data
      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: mockTasks, error: null })
      );

      const result = await repo.findIncompleteRequired('job-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].id).toBe('task-1');
        expect(result.value[1].id).toBe('task-2');
      }

      // Verify the query was built correctly
      expect(client._mocks.from).toHaveBeenCalledWith('workflow_tasks');
      expect(client._mocks.select).toHaveBeenCalledWith('*');
      expect(client._mocks.eq).toHaveBeenCalledWith('job_id', 'job-1');
      expect(client._mocks.eq).toHaveBeenCalledWith('is_deleted', false);
      expect(client._mocks.eq).toHaveBeenCalledWith('is_required', true);
      expect(client._mocks.not).toHaveBeenCalledWith('status', 'in', '(complete,skipped)');
    });

    it('should return empty array when no incomplete required tasks', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );

      const result = await repo.findIncompleteRequired('job-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should handle database errors', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const mockError = { message: 'Database connection failed', code: 'DB_ERROR' };
      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: null, error: mockError })
      );

      const result = await repo.findIncompleteRequired('job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('QUERY_FAILED');
        expect(result.error.message).toContain('Failed to fetch incomplete required tasks');
      }
    });
  });

  describe('softDelete', () => {
    it('should set is_deleted to true', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      client._mocks.eq.mockReturnValueOnce(
        Promise.resolve({ data: null, error: null })
      );

      const result = await repo.softDelete('task-1');

      expect(result.ok).toBe(true);

      // Verify update was called with correct data
      expect(client._mocks.from).toHaveBeenCalledWith('workflow_tasks');
      expect(client._mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_deleted: true,
        })
      );
      expect(client._mocks.eq).toHaveBeenCalledWith('id', 'task-1');
    });

    it('should handle errors during soft delete', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const mockError = { message: 'Update failed', code: 'UPDATE_ERROR' };
      client._mocks.eq.mockReturnValueOnce(
        Promise.resolve({ data: null, error: mockError })
      );

      const result = await repo.softDelete('task-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UPDATE_FAILED');
        expect(result.error.message).toContain('Failed to soft delete task');
      }
    });
  });

  describe('createFromTemplate', () => {
    it('should create tasks from template items', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const templateItems: TaskTemplateItem[] = [
        {
          id: 'item-1',
          template_id: 'template-1',
          task_order: 0,
          task_description: 'First task from template',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          acceptance_criteria: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'item-2',
          template_id: 'template-1',
          task_order: 1,
          task_description: 'Second task from template',
          is_required: false,
          requires_photo_verification: true,
          requires_supervisor_approval: false,
          acceptance_criteria: 'Photo must show completed work',
          created_at: new Date().toISOString(),
        },
      ];

      const createdTasks = [
        {
          id: 'task-1',
          job_id: 'job-1',
          task_description: 'First task from template',
          task_order: 0,
          is_required: true,
          template_id: 'template-1',
          status: 'pending',
        },
        {
          id: 'task-2',
          job_id: 'job-1',
          task_description: 'Second task from template',
          task_order: 1,
          is_required: false,
          template_id: 'template-1',
          status: 'pending',
        },
      ];

      client._mocks.selectAfterInsert.mockReturnValueOnce(
        Promise.resolve({ data: createdTasks, error: null })
      );

      const templateImages = {
        thumbnail_url: 'thumb-url',
        medium_url: 'medium-url',
        primary_image_url: 'primary-url',
      };

      const result = await repo.createFromTemplate('job-1', templateItems, templateImages);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].task_description).toBe('First task from template');
        expect(result.value[1].task_description).toBe('Second task from template');
        expect(result.value[0].template_id).toBe('template-1');
      }

      // Verify insert was called with correct structure
      expect(client._mocks.from).toHaveBeenCalledWith('workflow_tasks');
      expect(client._mocks.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            job_id: 'job-1',
            task_description: 'First task from template',
            task_order: 0,
            is_required: true,
            template_id: 'template-1',
            status: TaskStatus.PENDING,
            is_deleted: false,
            thumbnail_url: templateImages.thumbnail_url,
            medium_url: templateImages.medium_url,
            primary_image_url: templateImages.primary_image_url,
          }),
        ])
      );
    });

    it('should handle empty template items', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      client._mocks.selectAfterInsert.mockReturnValueOnce(
        Promise.resolve({ data: [], error: null })
      );

      const result = await repo.createFromTemplate('job-1', []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should handle database errors during batch insert', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const templateItems: TaskTemplateItem[] = [
        {
          id: 'item-1',
          template_id: 'template-1',
          task_order: 0,
          task_description: 'Task',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          acceptance_criteria: null,
          created_at: new Date().toISOString(),
        },
      ];

      const mockError = { message: 'Batch insert failed', code: 'INSERT_ERROR' };
      client._mocks.selectAfterInsert.mockReturnValueOnce(
        Promise.resolve({ data: null, error: mockError })
      );

      const result = await repo.createFromTemplate('job-1', templateItems);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INSERT_FAILED');
        expect(result.error.message).toContain('Failed to create tasks from template');
      }
    });
  });

  describe('updateImageUrls', () => {
    it('should update task image URLs', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const imageUrls = {
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
        medium_url: 'https://cdn.example.com/medium.jpg',
        primary_image_url: 'https://cdn.example.com/full.jpg',
      };

      const updatedTask = {
        id: 'task-1',
        tenant_id: 'tenant-1',
        job_id: 'job-1',
        task_description: 'Test task',
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...imageUrls,
      };

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: updatedTask, error: null })
      );

      const result = await repo.updateImageUrls('task-1', imageUrls);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primary_image_url).toBe(imageUrls.primary_image_url);
      }

      expect(client._mocks.update).toHaveBeenCalledWith(expect.objectContaining(imageUrls));
      expect(client._mocks.eq).toHaveBeenCalledWith('id', 'task-1');
    });

    it('should return NOT_FOUND when task is missing', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
      );

      const result = await repo.updateImageUrls('missing-task', {
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should handle update errors', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const dbError = { code: '23514', message: 'constraint violation' };
      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: null, error: dbError })
      );

      const result = await repo.updateImageUrls('task-1', {
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UPDATE_FAILED');
        expect(result.error.message).toContain('Failed to update task images');
      }
    });
  });

  describe('create', () => {
    it('should create a new task with validation', async () => {
      const mocks = buildWorkflowTaskCreateMocks();
      const repo = new WorkflowTaskRepository(mocks.client as any);

      const input = {
        job_id: '11111111-1111-1111-1111-111111111111',
        task_description: 'New task',
        task_order: 0,
        is_required: true,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        task_type: 'verification',
      };

      const createdTask = {
        id: '22222222-2222-2222-2222-222222222222',
        ...input,
        status: 'pending',
        is_deleted: false,
      };

      mocks.insertSelectSingle.mockResolvedValueOnce({
        data: createdTask,
        error: null,
      });

      const result = await repo.create(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('22222222-2222-2222-2222-222222222222');
        expect(result.value.task_description).toBe('New task');
      }
    });

    it('should reject invalid input data', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      const invalidInput = {
        job_id: 'not-a-uuid',
        task_description: '',
        task_order: -1,
      } as any;

      const result = await repo.create(invalidInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('findById', () => {
    it('should return null for non-existent task', async () => {
      const client = mockSupabaseClient();
      const repo = new WorkflowTaskRepository(client as any);

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: null, error: { code: 'PGRST116' } })
      );

      const result = await repo.findById('non-existent');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });
});
