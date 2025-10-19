/**
 * @file tests/unit/task-template/TaskTemplateRepository.test.ts
 * @purpose Unit tests for TaskTemplateRepository
 * @coverage T012: findAll, findByIdWithItems, create, delete
 */

import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';

const buildCreateClientMocks = () => {
  const templateInsertSelectSingle = jest.fn();
  const templateInsertSelect = jest.fn(() => ({
    single: templateInsertSelectSingle,
  }));
  const templateInsert = jest.fn(() => ({
    select: templateInsertSelect,
  }));
  const templateDeleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
  const templateDelete = jest.fn(() => ({
    eq: templateDeleteEq,
  }));
  const templateSelectOrder = jest.fn().mockResolvedValue({ data: [], error: null });
  const templateSelectEq = jest.fn(() => ({
    order: templateSelectOrder,
  }));
  const templateSelect = jest.fn(() => ({
    eq: templateSelectEq,
  }));

  const itemInsertSelect = jest.fn();
  const itemInsert = jest.fn(() => ({
    select: itemInsertSelect,
  }));
  const itemSelectOrder = jest.fn().mockResolvedValue({ data: [], error: null });
  const itemSelectEq = jest.fn(() => ({
    order: itemSelectOrder,
  }));
  const itemSelect = jest.fn(() => ({
    eq: itemSelectEq,
  }));

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'task_templates') {
        return {
          insert: templateInsert,
          select: templateSelect,
          delete: templateDelete,
          update: jest.fn(),
        };
      }
      if (table === 'task_template_items') {
        return {
          insert: itemInsert,
          select: itemSelect,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    client,
    templateInsert,
    templateInsertSelect,
    templateInsertSelectSingle,
    templateDeleteEq,
    itemInsert,
    itemInsertSelect,
  };
};

// Mock Supabase client
const mockSupabaseClient = () => {
  const mockFrom = jest.fn();
  const mockSelect = jest.fn();
  const mockInsert = jest.fn();
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn();
  const mockEq = jest.fn();
  const mockOrder = jest.fn();
  const mockSingle = jest.fn();

  // Chain mocking setup
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  });

  // Create a separate mock select for insert chains
  // Template insert uses: .insert().select().single()
  // Items insert uses: .insert().select()
  const mockSelectAfterInsert = jest.fn();
  const mockSelectAfterUpdate = jest.fn();
  const mockSingleAfterInsert = jest.fn();

  mockSelect.mockReturnValue({
    eq: mockEq,
    order: mockOrder,
  });

  mockInsert.mockReturnValue({
    select: mockSelectAfterInsert,
  });

  // mockSelectAfterInsert can return either a promise directly or an object with .single()
  // Default to returning an object with .single() for template inserts
  mockSelectAfterInsert.mockReturnValue({
    single: mockSingleAfterInsert,
    then: (resolve: any) => resolve({ data: [], error: null }), // For items insert
  });

  mockSingleAfterInsert.mockReturnValue({
    then: (resolve: any) => resolve({ data: null, error: null }),
  });

  mockUpdate.mockReturnValue({
    eq: mockEq,
  });

  mockSelectAfterUpdate.mockReturnValue({
    single: mockSingle,
  });

  mockDelete.mockReturnValue({
    eq: mockEq,
  });

  const mockLimit = jest.fn();
  mockLimit.mockReturnValue({
    then: (resolve: any) => resolve({ data: 0, error: null }),
  });

  mockEq.mockReturnValue({
    eq: mockEq,
    single: mockSingle,
    select: mockSelectAfterUpdate,
    order: mockOrder,
    limit: mockLimit,
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
      selectAfterUpdate: mockSelectAfterUpdate,
      singleAfterInsert: mockSingleAfterInsert,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      limit: mockLimit,
    },
  };
};

describe('TaskTemplateRepository', () => {
  describe('findAll', () => {
    it('should return only active templates by default', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const mockTemplates = [
        {
          id: 'template-1',
          tenant_id: 'tenant-1',
          name: 'HVAC Maintenance',
          description: 'Standard HVAC checklist',
          job_type: 'HVAC',
          is_active: true,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: mockTemplates, error: null })
      );

      const result = await repo.findAll(false);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].name).toBe('HVAC Maintenance');
      }

      // Verify query filtered by is_active
      expect(client._mocks.from).toHaveBeenCalledWith('task_templates');
      expect(client._mocks.select).toHaveBeenCalledWith('*');
      expect(client._mocks.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should include inactive templates when requested', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const mockTemplates = [
        {
          id: 'template-1',
          tenant_id: 'tenant-1',
          name: 'Active Template',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'template-2',
          tenant_id: 'tenant-1',
          name: 'Inactive Template',
          is_active: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: mockTemplates, error: null })
      );

      const result = await repo.findAll(true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }

      // Should NOT filter by is_active
      expect(client._mocks.eq).not.toHaveBeenCalledWith('is_active', true);
    });

    it('should handle database errors', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const mockError = { message: 'Connection lost', code: 'DB_ERROR' };
      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: null, error: mockError })
      );

      const result = await repo.findAll();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('QUERY_FAILED');
        expect(result.error.message).toContain('Failed to fetch templates');
      }
    });
  });

  describe('findByIdWithItems', () => {
    it('should return template with nested items', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const mockTemplate = {
        id: 'template-1',
        tenant_id: 'tenant-1',
        name: 'HVAC Maintenance',
        description: 'Standard checklist',
        job_type: 'HVAC',
        is_active: true,
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockItems = [
        {
          id: 'item-1',
          template_id: 'template-1',
          task_order: 0,
          task_description: 'Check refrigerant levels',
          is_required: true,
          requires_photo_verification: true,
          requires_supervisor_approval: false,
          acceptance_criteria: 'Within spec',
          created_at: new Date().toISOString(),
        },
        {
          id: 'item-2',
          template_id: 'template-1',
          task_order: 1,
          task_description: 'Inspect electrical connections',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          acceptance_criteria: null,
          created_at: new Date().toISOString(),
        },
      ];

      // Mock template query
      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: mockTemplate, error: null })
      );

      // Mock items query
      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: mockItems, error: null })
      );

      const result = await repo.findByIdWithItems('template-1');

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.id).toBe('template-1');
        expect(result.value.items).toHaveLength(2);
        expect(result.value.items[0].task_description).toBe('Check refrigerant levels');
        expect(result.value.items[1].task_description).toBe('Inspect electrical connections');
      }

      // Verify both queries were made
      expect(client._mocks.from).toHaveBeenCalledWith('task_templates');
      expect(client._mocks.from).toHaveBeenCalledWith('task_template_items');
    });

    it('should return null for non-existent template', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: null, error: { code: 'PGRST116' } })
      );

      const result = await repo.findByIdWithItems('non-existent');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('should handle errors fetching template items', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const mockTemplate = {
        id: 'template-1',
        tenant_id: 'tenant-1',
        name: 'Test Template',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Template query succeeds
      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: mockTemplate, error: null })
      );

      // Items query fails
      const mockError = { message: 'Items fetch failed', code: 'DB_ERROR' };
      client._mocks.order.mockReturnValueOnce(
        Promise.resolve({ data: null, error: mockError })
      );

      const result = await repo.findByIdWithItems('template-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('QUERY_FAILED');
        expect(result.error.message).toContain('Failed to fetch template items');
      }
    });
  });

  describe('create', () => {
    it('should create template with items atomically', async () => {
      const mocks = buildCreateClientMocks();
      const repo = new TaskTemplateRepository(mocks.client as any);

      const templateInput = {
        name: 'New Template',
        description: 'Test template',
        job_type: 'Electrical',
      };

      const itemsInput = [
        {
          task_order: 0,
          task_description: 'Test GFCI outlets',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
        },
      ];

      const createdTemplate = {
        id: 'template-1',
        tenant_id: 'tenant-1',
        ...templateInput,
        is_active: true,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createdItems = [
        {
          id: 'item-1',
          template_id: 'template-1',
          ...itemsInput[0],
          acceptance_criteria: null,
          created_at: new Date().toISOString(),
        },
      ];

      mocks.templateInsertSelectSingle.mockResolvedValueOnce({
        data: createdTemplate,
        error: null,
      });
      mocks.itemInsertSelect.mockResolvedValueOnce({
        data: createdItems,
        error: null,
      });

      const result = await repo.create(templateInput, itemsInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('template-1');
        expect(result.value.name).toBe('New Template');
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0].task_description).toBe('Test GFCI outlets');
      }

      // Verify insert calls
      expect(mocks.templateInsert).toHaveBeenCalledTimes(1);
      expect(mocks.itemInsert).toHaveBeenCalledTimes(1);
    });

    it('should handle unique constraint violations', async () => {
      const mocks = buildCreateClientMocks();
      const repo = new TaskTemplateRepository(mocks.client as any);

      const templateInput = {
        name: 'Duplicate Name',
        description: 'Test',
      };

      const mockError = {
        message: 'duplicate key value violates unique constraint',
        code: '23505',
      };

      mocks.templateInsertSelectSingle.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      const result = await repo.create(templateInput, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_NAME_EXISTS');
        expect(result.error.message).toContain('already exists');
      }
    });

    it('should rollback template when items creation fails', async () => {
      const mocks = buildCreateClientMocks();
      const repo = new TaskTemplateRepository(mocks.client as any);

      const templateInput = { name: 'Test', description: 'Test' };
      const itemsInput = [{
        task_order: 0,
        task_description: 'Task',
        is_required: true,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
      }];

      const createdTemplate = {
        id: 'template-1',
        tenant_id: 'tenant-1',
        ...templateInput,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Template creation succeeds
      mocks.templateInsertSelectSingle.mockResolvedValueOnce({
        data: createdTemplate,
        error: null,
      });

      // Items creation fails
      const mockError = { message: 'Items insert failed', code: 'INSERT_ERROR' };
      mocks.itemInsertSelect.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      // Mock delete for rollback
      mocks.templateDeleteEq.mockResolvedValueOnce({ data: null, error: null });

      const result = await repo.create(templateInput, itemsInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INSERT_FAILED');
      }

      // Verify rollback occurred
      expect(mocks.templateDeleteEq).toHaveBeenCalled();
    });

    it('should validate input with Zod', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const invalidInput = { name: '' } as any; // Empty name

      const result = await repo.create(invalidInput, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('delete', () => {
    it('should delete template and cascade items', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      client._mocks.eq.mockReturnValueOnce(
        Promise.resolve({ data: null, error: null })
      );

      const result = await repo.delete('template-1');

      expect(result.ok).toBe(true);

      // Verify delete was called
      expect(client._mocks.from).toHaveBeenCalledWith('task_templates');
      expect(client._mocks.delete).toHaveBeenCalled();
      expect(client._mocks.eq).toHaveBeenCalledWith('id', 'template-1');
    });

    it('should handle delete errors', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const mockError = { message: 'Delete failed', code: 'DELETE_ERROR' };
      client._mocks.eq.mockReturnValueOnce(
        Promise.resolve({ data: null, error: mockError })
      );

      const result = await repo.delete('template-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DELETE_FAILED');
        expect(result.error.message).toContain('Failed to delete template');
      }
    });
  });

  describe('update', () => {
    it('should update template metadata', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const updateInput = {
        name: 'Updated Name',
        is_active: false,
      };

      const updatedTemplate = {
        id: 'template-1',
        tenant_id: 'tenant-1',
        ...updateInput,
        description: null,
        job_type: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: updatedTemplate, error: null })
      );

      const result = await repo.update('template-1', updateInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Updated Name');
        expect(result.value.is_active).toBe(false);
      }

      // Verify update call
      expect(client._mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          is_active: false,
        })
      );
    });

    it('should return NOT_FOUND for non-existent template', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: null, error: { code: 'PGRST116' } })
      );

      const result = await repo.update('non-existent', { name: 'Test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateImageUrls', () => {
    it('should update template image URLs', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      const imageUrls = {
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
        medium_url: 'https://cdn.example.com/medium.jpg',
        primary_image_url: 'https://cdn.example.com/full.jpg',
      };

      const updatedTemplate = {
        id: 'template-1',
        tenant_id: 'tenant-1',
        name: 'Template',
        description: null,
        job_type: null,
        is_active: true,
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...imageUrls,
      };

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: updatedTemplate, error: null })
      );

      const result = await repo.updateImageUrls('template-1', imageUrls);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primary_image_url).toBe(imageUrls.primary_image_url);
      }

      expect(client._mocks.update).toHaveBeenCalledWith(expect.objectContaining(imageUrls));
      expect(client._mocks.eq).toHaveBeenCalledWith('id', 'template-1');
    });

    it('should return NOT_FOUND when template is missing', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
      );

      const result = await repo.updateImageUrls('missing-template', {
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
      const repo = new TaskTemplateRepository(client as any);

      const dbError = { code: '23514', message: 'constraint violation' };
      client._mocks.single.mockReturnValueOnce(
        Promise.resolve({ data: null, error: dbError })
      );

      const result = await repo.updateImageUrls('template-1', {
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UPDATE_FAILED');
        expect(result.error.message).toContain('Failed to update template images');
      }
    });
  });

  describe('isTemplateInUse', () => {
    it('should return true when template is referenced by tasks', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      // Mock count > 0 - the .limit() returns the promise
      client._mocks.limit.mockReturnValueOnce(
        Promise.resolve({ data: 1, error: null })
      );

      const result = await repo.isTemplateInUse('template-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('should return false when template is not in use', async () => {
      const client = mockSupabaseClient();
      const repo = new TaskTemplateRepository(client as any);

      // Mock count = 0 - the .limit() returns the promise
      client._mocks.limit.mockReturnValueOnce(
        Promise.resolve({ data: 0, error: null })
      );

      const result = await repo.isTemplateInUse('template-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });
});
