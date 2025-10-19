/**
 * @file tests/unit/task-template/TaskTemplateService.test.ts
 * @purpose Unit tests for TaskTemplateService
 * @coverage T016: instantiateTemplate, validateTemplateUsage, getAllTemplates, getTemplateDetails
 */

import { TaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { TaskStatus } from '@/domains/workflow-task/types/workflow-task-types';
import type { TemplateWithItems } from '@/domains/task-template/types/task-template-types';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';

// Mock the repositories
jest.mock('@/domains/task-template/repositories/TaskTemplateRepository');
jest.mock('@/domains/workflow-task/repositories/WorkflowTaskRepository');

describe('TaskTemplateService', () => {
  let service: TaskTemplateService;
  let mockTemplateRepo: jest.Mocked<TaskTemplateRepository>;
  let mockTaskRepo: jest.Mocked<WorkflowTaskRepository>;

  beforeEach(() => {
    mockTemplateRepo = new TaskTemplateRepository(null as any) as jest.Mocked<TaskTemplateRepository>;
    mockTaskRepo = new WorkflowTaskRepository(null as any) as jest.Mocked<WorkflowTaskRepository>;
    service = new TaskTemplateService(mockTemplateRepo, mockTaskRepo);
  });

  describe('instantiateTemplate', () => {
    const mockTemplate: TemplateWithItems = {
      id: 'template-1',
      name: 'Standard Inspection',
      description: 'Standard inspection template',
      job_type: 'inspection',
      is_active: true,
      created_at: new Date().toISOString(),
      tenant_id: 'tenant-1',
      items: [
        {
          id: 'item-1',
          template_id: 'template-1',
          task_order: 0,
          task_description: 'Check equipment',
          is_required: true,
          requires_photo_verification: true,
          requires_supervisor_approval: false,
          acceptance_criteria: 'All equipment operational',
          created_at: new Date().toISOString(),
        },
        {
          id: 'item-2',
          template_id: 'template-1',
          task_order: 1,
          task_description: 'Document findings',
          is_required: false,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          acceptance_criteria: null,
          created_at: new Date().toISOString(),
        },
      ],
    };

    it('should successfully instantiate template into job', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTemplate,
      });

      mockTaskRepo.findByJobId = jest.fn().mockResolvedValue({
        ok: true,
        value: [],
      });

      const createdTasks: WorkflowTask[] = [
        {
          id: 'task-1',
          job_id: 'job-1',
          task_description: 'Check equipment',
          task_order: 0,
          is_required: true,
          is_deleted: false,
          status: TaskStatus.PENDING,
          requires_photo_verification: true,
          requires_supervisor_approval: false,
          acceptance_criteria: 'All equipment operational',
          template_id: 'template-1',
          created_at: new Date().toISOString(),
          tenant_id: 'tenant-1',
        },
        {
          id: 'task-2',
          job_id: 'job-1',
          task_description: 'Document findings',
          task_order: 1,
          is_required: false,
          is_deleted: false,
          status: TaskStatus.PENDING,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          acceptance_criteria: null,
          template_id: 'template-1',
          created_at: new Date().toISOString(),
          tenant_id: 'tenant-1',
        },
      ];

      mockTaskRepo.createFromTemplate = jest.fn().mockResolvedValue({
        ok: true,
        value: createdTasks,
      });

      const result = await service.instantiateTemplate('template-1', 'job-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].job_id).toBe('job-1');
        expect(result.value[0].template_id).toBe('template-1');
        expect(result.value[0].task_description).toBe('Check equipment');
        expect(result.value[1].task_description).toBe('Document findings');
      }

      expect(mockTemplateRepo.findByIdWithItems).toHaveBeenCalledWith('template-1');
      expect(mockTaskRepo.createFromTemplate).toHaveBeenCalledWith('job-1', mockTemplate.items);
    });

    it('should warn but proceed when job already has tasks', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTemplate,
      });

      // Job already has 3 tasks
      mockTaskRepo.findByJobId = jest.fn().mockResolvedValue({
        ok: true,
        value: [{}, {}, {}] as any,
      });

      mockTaskRepo.createFromTemplate = jest.fn().mockResolvedValue({
        ok: true,
        value: [] as any,
      });

      await service.instantiateTemplate('template-1', 'job-1');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job job-1 already has 3 tasks')
      );

      // Still proceeds with creation
      expect(mockTaskRepo.createFromTemplate).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return error if template not found', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: null,
      });

      const result = await service.instantiateTemplate('template-1', 'job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_NOT_FOUND');
      }
    });

    it('should return error if template is inactive', async () => {
      const inactiveTemplate = {
        ...mockTemplate,
        is_active: false,
      };

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: inactiveTemplate,
      });

      const result = await service.instantiateTemplate('template-1', 'job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_INACTIVE');
        expect(result.error.message).toContain('Cannot instantiate inactive template');
      }
    });

    it('should return error if template has no items', async () => {
      const emptyTemplate = {
        ...mockTemplate,
        items: [],
      };

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: emptyTemplate,
      });

      const result = await service.instantiateTemplate('template-1', 'job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_EMPTY');
        expect(result.error.message).toContain('Template has no items to instantiate');
      }
    });

    it('should handle template fetch errors', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Database error',
        },
      });

      const result = await service.instantiateTemplate('template-1', 'job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_FETCH_FAILED');
      }
    });

    it('should handle task creation errors', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTemplate,
      });

      mockTaskRepo.findByJobId = jest.fn().mockResolvedValue({
        ok: true,
        value: [],
      });

      mockTaskRepo.createFromTemplate = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'INSERT_FAILED',
          message: 'Failed to insert tasks',
        },
      });

      const result = await service.instantiateTemplate('template-1', 'job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_CREATION_FAILED');
      }
    });

    it('should handle unexpected errors', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await service.instantiateTemplate('template-1', 'job-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNEXPECTED_ERROR');
      }
    });
  });

  describe('validateTemplateUsage', () => {
    it('should return canDelete=true when template is not in use', async () => {
      mockTemplateRepo.isTemplateInUse = jest.fn().mockResolvedValue({
        ok: true,
        value: false,
      });

      const result = await service.validateTemplateUsage('template-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.canDelete).toBe(true);
        expect(result.value.usageCount).toBe(0);
      }
    });

    it('should return canDelete=false when template is in use', async () => {
      mockTemplateRepo.isTemplateInUse = jest.fn().mockResolvedValue({
        ok: true,
        value: true,
      });

      const result = await service.validateTemplateUsage('template-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.canDelete).toBe(false);
        expect(result.value.usageCount).toBeUndefined();
      }
    });

    it('should handle repository errors', async () => {
      mockTemplateRepo.isTemplateInUse = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Database error',
        },
      });

      const result = await service.validateTemplateUsage('template-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('should handle unexpected errors', async () => {
      mockTemplateRepo.isTemplateInUse = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await service.validateTemplateUsage('template-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNEXPECTED_ERROR');
      }
    });
  });

  describe('getAllTemplates', () => {
    const mockTemplates = [
      {
        id: 'template-1',
        name: 'Template 1',
        description: 'First template',
        job_type: 'inspection',
        is_active: true,
        created_at: new Date().toISOString(),
        tenant_id: 'tenant-1',
      },
      {
        id: 'template-2',
        name: 'Template 2',
        description: 'Second template',
        job_type: 'maintenance',
        is_active: true,
        created_at: new Date().toISOString(),
        tenant_id: 'tenant-1',
      },
    ];

    it('should return all active templates by default', async () => {
      mockTemplateRepo.findAll = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTemplates,
      });

      const result = await service.getAllTemplates();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].items).toEqual([]);
        expect(result.value[1].items).toEqual([]);
      }

      expect(mockTemplateRepo.findAll).toHaveBeenCalledWith(false);
    });

    it('should include inactive templates when requested', async () => {
      mockTemplateRepo.findAll = jest.fn().mockResolvedValue({
        ok: true,
        value: [
          ...mockTemplates,
          {
            id: 'template-3',
            name: 'Inactive Template',
            description: null,
            job_type: null,
            is_active: false,
            created_at: new Date().toISOString(),
            tenant_id: 'tenant-1',
          },
        ],
      });

      const result = await service.getAllTemplates(true);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
      }

      expect(mockTemplateRepo.findAll).toHaveBeenCalledWith(true);
    });

    it('should return empty array when no templates exist', async () => {
      mockTemplateRepo.findAll = jest.fn().mockResolvedValue({
        ok: true,
        value: [],
      });

      const result = await service.getAllTemplates();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should handle repository errors', async () => {
      mockTemplateRepo.findAll = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Database error',
        },
      });

      const result = await service.getAllTemplates();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_FETCH_FAILED');
      }
    });

    it('should handle unexpected errors', async () => {
      mockTemplateRepo.findAll = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await service.getAllTemplates();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNEXPECTED_ERROR');
      }
    });
  });

  describe('getTemplateDetails', () => {
    const mockTemplateWithItems: TemplateWithItems = {
      id: 'template-1',
      name: 'Standard Inspection',
      description: 'Standard inspection template',
      job_type: 'inspection',
      is_active: true,
      created_at: new Date().toISOString(),
      tenant_id: 'tenant-1',
      items: [
        {
          id: 'item-1',
          template_id: 'template-1',
          task_order: 0,
          task_description: 'Check equipment',
          is_required: true,
          requires_photo_verification: true,
          requires_supervisor_approval: false,
          acceptance_criteria: 'All equipment operational',
          created_at: new Date().toISOString(),
        },
      ],
    };

    it('should return template with items', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: mockTemplateWithItems,
      });

      const result = await service.getTemplateDetails('template-1');

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.id).toBe('template-1');
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0].task_description).toBe('Check equipment');
      }

      expect(mockTemplateRepo.findByIdWithItems).toHaveBeenCalledWith('template-1');
    });

    it('should return null when template not found', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: null,
      });

      const result = await service.getTemplateDetails('template-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('should handle repository errors', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Database error',
        },
      });

      const result = await service.getTemplateDetails('template-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_FETCH_FAILED');
      }
    });

    it('should handle unexpected errors', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await service.getTemplateDetails('template-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNEXPECTED_ERROR');
      }
    });
  });
});
