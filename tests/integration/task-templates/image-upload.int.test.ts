import { TaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import type {
  TemplateWithItems,
  TaskTemplate,
  TemplateImageUrls,
  ServiceError,
} from '@/domains/task-template/types/task-template-types';
import { Ok, Err } from '@/domains/task-template/types/task-template-types';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';
import { TaskStatus, VerificationMethod } from '@/domains/workflow-task/types/workflow-task-types';
import type { ProcessedImages } from '@/utils/image-processor';
import { uploadImagesToStorage, deleteImagesFromStorage } from '@/lib/supabase/storage';

jest.mock('@/lib/supabase/storage', () => ({
  uploadImagesToStorage: jest.fn(),
  deleteImagesFromStorage: jest.fn(),
}));

const uploadImagesToStorageMock = uploadImagesToStorage as jest.MockedFunction<typeof uploadImagesToStorage>;
const deleteImagesFromStorageMock = deleteImagesFromStorage as jest.MockedFunction<typeof deleteImagesFromStorage>;

type TemplateMap = Map<string, TemplateWithItems>;

function createTemplate(overrides: Partial<TemplateWithItems> = {}): TemplateWithItems {
  return {
    id: 'template-1',
    tenant_id: 'tenant-1',
    name: 'Demo Template',
    description: 'Demo description',
    job_type: 'demo',
    is_active: true,
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    thumbnail_url: null,
    medium_url: null,
    primary_image_url: null,
    items: [
      {
        id: 'item-1',
        template_id: 'template-1',
        task_order: 0,
        task_description: 'Check item',
        is_required: true,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        acceptance_criteria: null,
        created_at: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

describe('Integration: TaskTemplateService image management', () => {
  let templates: TemplateMap;
  let templateRepo: any;
  let taskRepo: any;
  let service: TaskTemplateService;

  beforeEach(() => {
    templates = new Map<string, TemplateWithItems>();
    templates.set('template-1', createTemplate());

    templateRepo = {
      findByIdWithItems: jest.fn(async (id: string) => {
        const template = templates.get(id);
        return template ? Ok(template) : Ok(null);
      }),
      updateImageUrls: jest.fn(async (id: string, urls: TemplateImageUrls) => {
        const template = templates.get(id);
        if (!template) {
          return Err({
            code: 'NOT_FOUND',
            message: 'Template not found',
          });
        }
        const updated: TemplateWithItems = {
          ...template,
          ...urls,
          updated_at: new Date().toISOString(),
        };
        templates.set(id, updated);
        return Ok(updated as unknown as TaskTemplate);
      }),
      isTemplateInUse: jest.fn(async () => Ok(false)),
    };

    taskRepo = {
      findByJobId: jest.fn(async () => Ok<WorkflowTask[], ServiceError>([])),
      createFromTemplate: jest.fn(async () => Ok<WorkflowTask[], ServiceError>([])),
    };

    service = new TaskTemplateService(templateRepo, taskRepo);
    uploadImagesToStorageMock.mockReset();
    deleteImagesFromStorageMock.mockReset();
  });

  const processedImages: ProcessedImages = {
    thumbnail: 'data:image/jpeg;base64,AAA',
    medium: 'data:image/jpeg;base64,BBB',
    full: 'data:image/jpeg;base64,CCC',
  };

  it('uploads images to storage and updates template URLs', async () => {
    uploadImagesToStorageMock.mockResolvedValue({
      urls: {
        thumbnail_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/thumb.jpg',
        medium_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/medium.jpg',
        primary_image_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/full.jpg',
      },
      paths: {
        thumbnail: 'tenant-1/template-1/thumb.jpg',
        medium: 'tenant-1/template-1/medium.jpg',
        full: 'tenant-1/template-1/full.jpg',
      },
    });

    const result = await service.uploadTemplateImage(
      {} as any,
      'template-1',
      'tenant-1',
      processedImages
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.thumbnail_url).toContain('thumb.jpg');
      expect(result.value.medium_url).toContain('medium.jpg');
      expect(result.value.primary_image_url).toContain('full.jpg');
    }

    const stored = templates.get('template-1');
    expect(stored?.thumbnail_url).toContain('thumb.jpg');
    expect(uploadImagesToStorageMock).toHaveBeenCalledWith(
      expect.any(Object),
      'task-template-images',
      'template-1',
      'tenant-1',
      processedImages
    );
  });

  it('cleans up uploaded files when repository update fails', async () => {
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

    templateRepo.updateImageUrls.mockResolvedValueOnce(
      Err({
        code: 'UPDATE_FAILED',
        message: 'DB error',
      })
    );

    const result = await service.uploadTemplateImage(
      {} as any,
      'template-1',
      'tenant-1',
      processedImages
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IMAGE_UPDATE_FAILED');
    }

    expect(deleteImagesFromStorageMock).toHaveBeenCalledWith(
      expect.any(Object),
      'task-template-images',
      ['tenant-1/template-1/thumb.jpg', 'tenant-1/template-1/medium.jpg', 'tenant-1/template-1/full.jpg']
    );
  });

  it('prevents cross-tenant access when template belongs to another tenant', async () => {
    templates.set('template-1', createTemplate({ tenant_id: 'other-tenant' }));

    const result = await service.uploadTemplateImage(
      {} as any,
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

  it('removes template image and clears storage paths', async () => {
    templates.set('template-1', createTemplate({
      thumbnail_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/thumb.jpg',
      medium_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/medium.jpg',
      primary_image_url: 'https://cdn.supabase.co/storage/v1/object/public/task-template-images/tenant-1/template-1/full.jpg',
    }));

    const result = await service.removeTemplateImage(
      {} as any,
      'template-1',
      'tenant-1'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.thumbnail_url).toBeNull();
    }

    expect(deleteImagesFromStorageMock).toHaveBeenCalledWith(
      expect.any(Object),
      'task-template-images',
      ['tenant-1/template-1/thumb.jpg', 'tenant-1/template-1/medium.jpg', 'tenant-1/template-1/full.jpg']
    );
  });
});
