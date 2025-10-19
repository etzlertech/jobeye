/**
 * @file tests/unit/task-template/TaskTemplateService.test.ts
 * @purpose Unit tests for TaskTemplateService
 * @coverage T016: instantiateTemplate, validateTemplateUsage, getAllTemplates, getTemplateDetails
 */

import { TaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { TaskStatus, VerificationMethod } from '@/domains/workflow-task/types/workflow-task-types';
import type { TaskTemplate, TemplateWithItems } from '@/domains/task-template/types/task-template-types';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';
import type { ProcessedImages } from '@/utils/image-processor';
import { uploadImagesToStorage, deleteImagesFromStorage } from '@/lib/supabase/storage';

// Mock the repositories
jest.mock('@/domains/task-template/repositories/TaskTemplateRepository');
jest.mock('@/domains/workflow-task/repositories/WorkflowTaskRepository');
jest.mock('@/lib/supabase/storage', () => ({
  uploadImagesToStorage: jest.fn(),
  deleteImagesFromStorage: jest.fn(),
}));

describe('TaskTemplateService', () => {
  let service: TaskTemplateService;
  let mockTemplateRepo: jest.Mocked<TaskTemplateRepository>;
  let mockTaskRepo: jest.Mocked<WorkflowTaskRepository>;

  beforeEach(() => {
    mockTemplateRepo = new TaskTemplateRepository(null as any) as jest.Mocked<TaskTemplateRepository>;
    mockTaskRepo = new WorkflowTaskRepository(null as any) as jest.Mocked<WorkflowTaskRepository>;
    service = new TaskTemplateService(mockTemplateRepo, mockTaskRepo);
  });

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
    thumbnail_url: null,
    medium_url: null,
    primary_image_url: null,
    ...overrides,
  });

const createTemplateWithItemsMock = (overrides?: Partial<TemplateWithItems>): TemplateWithItems => ({
  id: 'template-1',
  tenant_id: 'tenant-1',
  name: 'Standard Inspection',
  description: 'Standard inspection template',
  job_type: 'inspection',
  is_active: true,
  created_by: 'supervisor-1',
  created_at: baseTimestamp,
  updated_at: baseTimestamp,
  thumbnail_url: null,
  medium_url: null,
  primary_image_url: null,
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
          created_at: baseTimestamp,
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
          created_at: baseTimestamp,
        },
  ],
  ...overrides,
});

const createTaskTemplateMock = (overrides?: Partial<TemplateWithItems>): TaskTemplate => {
  const template = createTemplateWithItemsMock(overrides);
  const { items, ...taskTemplate } = template;
  return taskTemplate;
};

const processedImages: ProcessedImages = {
  thumbnail: 'data:image/jpeg;base64,AAA',
  medium: 'data:image/jpeg;base64,BBB',
  full: 'data:image/jpeg;base64,CCC',
};

const uploadImagesToStorageMock = uploadImagesToStorage as jest.Mock;
const deleteImagesFromStorageMock = deleteImagesFromStorage as jest.Mock;

const supabaseClientMock = {} as any;

  describe('instantiateTemplate', () => {
    const mockTemplate = createTemplateWithItemsMock({
      thumbnail_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/thumb.jpg',
      medium_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/medium.jpg',
      primary_image_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/full.jpg',
    });

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
        createWorkflowTaskMock({
          id: 'task-1',
          job_id: 'job-1',
          task_description: 'Check equipment',
          task_order: 0,
          is_required: true,
          requires_photo_verification: true,
          acceptance_criteria: 'All equipment operational',
          template_id: 'template-1',
        }),
        createWorkflowTaskMock({
          id: 'task-2',
          job_id: 'job-1',
          task_description: 'Document findings',
          task_order: 1,
          is_required: false,
          requires_photo_verification: false,
          acceptance_criteria: null,
          template_id: 'template-1',
        }),
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
      expect(mockTaskRepo.createFromTemplate).toHaveBeenCalledWith(
        'job-1',
        mockTemplate.items,
        {
          thumbnail_url: mockTemplate.thumbnail_url,
          medium_url: mockTemplate.medium_url,
          primary_image_url: mockTemplate.primary_image_url,
        }
      );
    });

    it('should warn but proceed when job already has tasks', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const template = createTemplateWithItemsMock();

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
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

  describe('uploadTemplateImage', () => {
    beforeEach(() => {
      uploadImagesToStorageMock.mockReset();
      deleteImagesFromStorageMock.mockReset();
    });

    it('should upload images and update template URLs', async () => {
      const template = createTemplateWithItemsMock();

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
      });

      uploadImagesToStorageMock.mockResolvedValue({
        urls: {
          thumbnail_url: 'thumb-url',
          medium_url: 'medium-url',
          primary_image_url: 'primary-url',
        },
        paths: {
          thumbnail: 'tenant-1/template-1/thumb.jpg',
          medium: 'tenant-1/template-1/medium.jpg',
          full: 'tenant-1/template-1/full.jpg',
        },
      });

      const updatedTemplate = createTaskTemplateMock({
        thumbnail_url: 'thumb-url',
        medium_url: 'medium-url',
        primary_image_url: 'primary-url',
      });

      mockTemplateRepo.updateImageUrls = jest.fn().mockResolvedValue({
        ok: true,
        value: updatedTemplate,
      });

      const result = await service.uploadTemplateImage(
        supabaseClientMock,
        'template-1',
        'tenant-1',
        processedImages
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primary_image_url).toBe('primary-url');
      }

      expect(uploadImagesToStorageMock).toHaveBeenCalledWith(
        supabaseClientMock,
        'task-template-images',
        'template-1',
        'tenant-1',
        processedImages
      );
      expect(mockTemplateRepo.updateImageUrls).toHaveBeenCalledWith('template-1', {
        thumbnail_url: 'thumb-url',
        medium_url: 'medium-url',
        primary_image_url: 'primary-url',
      });
      expect(deleteImagesFromStorageMock).not.toHaveBeenCalled();
    });

    it('should return error when template not found', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: null,
      });

      const result = await service.uploadTemplateImage(
        supabaseClientMock,
        'missing-template',
        'tenant-1',
        processedImages
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_NOT_FOUND');
      }
      expect(uploadImagesToStorageMock).not.toHaveBeenCalled();
    });

    it('should prevent cross-tenant access', async () => {
      const template = createTemplateWithItemsMock({ tenant_id: 'other-tenant' });

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
      });

      const result = await service.uploadTemplateImage(
        supabaseClientMock,
        'template-1',
        'tenant-1',
        processedImages
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
      expect(uploadImagesToStorageMock).not.toHaveBeenCalled();
    });

    it('should handle upload failures gracefully', async () => {
      const template = createTemplateWithItemsMock();

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
      });

      uploadImagesToStorageMock.mockRejectedValue(new Error('Upload failed'));

      const result = await service.uploadTemplateImage(
        supabaseClientMock,
        'template-1',
        'tenant-1',
        processedImages
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('IMAGE_UPLOAD_FAILED');
        expect(result.error.message).toContain('Upload failed');
      }

      expect(deleteImagesFromStorageMock).not.toHaveBeenCalled();
    });

    it('should cleanup uploaded files when DB update fails', async () => {
      const template = createTemplateWithItemsMock();

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
      });

      uploadImagesToStorageMock.mockResolvedValue({
        urls: {
          thumbnail_url: 'thumb-url',
          medium_url: 'medium-url',
          primary_image_url: 'primary-url',
        },
        paths: {
          thumbnail: 'tenant-1/template-1/thumb.jpg',
          medium: 'tenant-1/template-1/medium.jpg',
          full: 'tenant-1/template-1/full.jpg',
        },
      });

      const repoError = { code: 'UPDATE_FAILED', message: 'DB error' };

      mockTemplateRepo.updateImageUrls = jest.fn().mockResolvedValue({
        ok: false,
        error: repoError,
      });

      deleteImagesFromStorageMock.mockResolvedValue(undefined);

      const result = await service.uploadTemplateImage(
        supabaseClientMock,
        'template-1',
        'tenant-1',
        processedImages
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('IMAGE_UPDATE_FAILED');
        expect(result.error.details).toBe(repoError);
      }

      expect(deleteImagesFromStorageMock).toHaveBeenCalledWith(
        supabaseClientMock,
        'task-template-images',
        [
          'tenant-1/template-1/thumb.jpg',
          'tenant-1/template-1/medium.jpg',
          'tenant-1/template-1/full.jpg',
        ]
      );
    });
  });

  describe('removeTemplateImage', () => {
    it('should clear template image URLs and delete storage objects', async () => {
      const template = createTemplateWithItemsMock({
        tenant_id: 'tenant-1',
        thumbnail_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/thumb.jpg',
        medium_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/medium.jpg',
        primary_image_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/full.jpg',
      });

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
      });

      const updated = createTaskTemplateMock({
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      });

      mockTemplateRepo.updateImageUrls = jest.fn().mockResolvedValue({
        ok: true,
        value: updated,
      });

      const result = await service.removeTemplateImage(
        supabaseClientMock,
        'template-1',
        'tenant-1'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.thumbnail_url).toBeNull();
      }

      expect(deleteImagesFromStorageMock).toHaveBeenCalledWith(
        supabaseClientMock,
        'task-template-images',
        [
          'tenant-1/template-1/thumb.jpg',
          'tenant-1/template-1/medium.jpg',
          'tenant-1/template-1/full.jpg',
        ]
      );
      expect(mockTemplateRepo.updateImageUrls).toHaveBeenCalledWith('template-1', {
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      });
    });

    it('should return error when template not found', async () => {
      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: null,
      });

      const result = await service.removeTemplateImage(
        supabaseClientMock,
        'missing',
        'tenant-1'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TEMPLATE_NOT_FOUND');
      }
    });

    it('should prevent cross-tenant removal', async () => {
      const template = createTemplateWithItemsMock({ tenant_id: 'other-tenant' });

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
      });

      const result = await service.removeTemplateImage(
        supabaseClientMock,
        'template-1',
        'tenant-1'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }

      expect(deleteImagesFromStorageMock).not.toHaveBeenCalled();
    });

    it('should handle update failures', async () => {
      const template = createTemplateWithItemsMock({
        thumbnail_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/thumb.jpg',
      });

      mockTemplateRepo.findByIdWithItems = jest.fn().mockResolvedValue({
        ok: true,
        value: template,
      });

      const repoError = { code: 'UPDATE_FAILED', message: 'DB error' };

      mockTemplateRepo.updateImageUrls = jest.fn().mockResolvedValue({
        ok: false,
        error: repoError,
      });

      const result = await service.removeTemplateImage(
        supabaseClientMock,
        'template-1',
        'tenant-1'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('IMAGE_UPDATE_FAILED');
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
    const mockTemplates: TaskTemplate[] = [
      createTaskTemplateMock({
        id: 'template-1',
        name: 'Template 1',
        description: 'First template',
        job_type: 'inspection',
        is_active: true,
      }),
      createTaskTemplateMock({
        id: 'template-2',
        name: 'Template 2',
        description: 'Second template',
        job_type: 'maintenance',
        is_active: true,
      }),
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
          createTaskTemplateMock({
            id: 'template-3',
            name: 'Inactive Template',
            description: null,
            job_type: null,
            is_active: false,
          }),
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
    const mockTemplateWithItems = createTemplateWithItemsMock({
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
          created_at: baseTimestamp,
        },
      ],
    });

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
