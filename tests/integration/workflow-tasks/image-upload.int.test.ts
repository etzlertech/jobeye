import { WorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import type {
  WorkflowTask,
  WorkflowTaskImageUrls,
  ServiceError,
} from '@/domains/workflow-task/types/workflow-task-types';
import { TaskStatus, VerificationMethod } from '@/domains/workflow-task/types/workflow-task-types';
import { Ok, Err } from '@/domains/task-template/types/task-template-types';
import type { ProcessedImages } from '@/utils/image-processor';
import { uploadImagesToStorage, deleteImagesFromStorage } from '@/lib/supabase/storage';

jest.mock('@/lib/supabase/storage', () => ({
  uploadImagesToStorage: jest.fn(),
  deleteImagesFromStorage: jest.fn(),
}));

const uploadImagesToStorageMock = uploadImagesToStorage as jest.MockedFunction<typeof uploadImagesToStorage>;
const deleteImagesFromStorageMock = deleteImagesFromStorage as jest.MockedFunction<typeof deleteImagesFromStorage>;

function createTask(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  const timestamp = new Date().toISOString();
  return {
    id: 'task-1',
    tenant_id: 'tenant-1',
    job_id: 'job-1',
    task_description: 'Inspect equipment',
    task_order: 0,
    status: TaskStatus.PENDING,
    is_required: true,
    is_deleted: false,
    template_id: 'template-1',
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
    created_at: timestamp,
    updated_at: timestamp,
    thumbnail_url: null,
    medium_url: null,
    primary_image_url: null,
    ...overrides,
  };
}

describe('Integration: WorkflowTaskService image management', () => {
  let taskStore: Map<string, WorkflowTask>;
  let taskRepo: any;
  let service: WorkflowTaskService;

  beforeEach(() => {
    taskStore = new Map<string, WorkflowTask>();
    taskStore.set('task-1', createTask());

    taskRepo = {
      findById: jest.fn(async (id: string) => {
        const task = taskStore.get(id);
        return task ? Ok(task) : Ok<WorkflowTask | null>(null);
      }),
      updateImageUrls: jest.fn(async (id: string, urls: WorkflowTaskImageUrls) => {
        const existing = taskStore.get(id);
        if (!existing) {
          return Err({
            code: 'NOT_FOUND',
            message: 'Task not found',
          });
        }
        const updated: WorkflowTask = {
          ...existing,
          ...urls,
          updated_at: new Date().toISOString(),
        };
        taskStore.set(id, updated);
        return Ok(updated);
      }),
      findByJobId: jest.fn(async () => Ok(Array.from(taskStore.values()))),
      create: jest.fn(),
      softDelete: jest.fn(),
    };

    service = new WorkflowTaskService(taskRepo);
    uploadImagesToStorageMock.mockReset();
    deleteImagesFromStorageMock.mockReset();
  });

  const processedImages: ProcessedImages = {
    thumbnail: 'data:image/jpeg;base64,AAA',
    medium: 'data:image/jpeg;base64,BBB',
    full: 'data:image/jpeg;base64,CCC',
  };

  it('uploads images and updates task record', async () => {
    uploadImagesToStorageMock.mockResolvedValue({
      urls: {
        thumbnail_url: 'https://cdn.supabase.co/storage/v1/object/public/task-images/tenant-1/task-1/thumb.jpg',
        medium_url: 'https://cdn.supabase.co/storage/v1/object/public/task-images/tenant-1/task-1/medium.jpg',
        primary_image_url: 'https://cdn.supabase.co/storage/v1/object/public/task-images/tenant-1/task-1/full.jpg',
      },
      paths: {
        thumbnail: 'tenant-1/task-1/thumb.jpg',
        medium: 'tenant-1/task-1/medium.jpg',
        full: 'tenant-1/task-1/full.jpg',
      },
    });

    const result = await service.uploadTaskImage(
      {} as any,
      'task-1',
      'tenant-1',
      processedImages
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.primary_image_url).toContain('full.jpg');
    }

    const stored = taskStore.get('task-1');
    expect(stored?.medium_url).toContain('medium.jpg');
    expect(uploadImagesToStorageMock).toHaveBeenCalledWith(
      expect.any(Object),
      'task-images',
      'task-1',
      'tenant-1',
      processedImages
    );
  });

  it('blocks cross-tenant uploads', async () => {
    taskStore.set('task-1', createTask({ tenant_id: 'other-tenant' }));

    const result = await service.uploadTaskImage(
      {} as any,
      'task-1',
      'tenant-1',
      processedImages
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
    expect(uploadImagesToStorageMock).not.toHaveBeenCalled();
  });

  it('cleans up uploaded files on repository failure', async () => {
    uploadImagesToStorageMock.mockResolvedValue({
      urls: {
        thumbnail_url: 'thumb-url',
        medium_url: 'medium-url',
        primary_image_url: 'primary-url',
      },
      paths: {
        thumbnail: 'tenant-1/task-1/thumb.jpg',
        medium: 'tenant-1/task-1/medium.jpg',
        full: 'tenant-1/task-1/full.jpg',
      },
    });

    taskRepo.updateImageUrls.mockResolvedValueOnce(
      Err({
        code: 'UPDATE_FAILED',
        message: 'DB error',
      })
    );

    const result = await service.uploadTaskImage(
      {} as any,
      'task-1',
      'tenant-1',
      processedImages
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IMAGE_UPDATE_FAILED');
    }

    expect(deleteImagesFromStorageMock).toHaveBeenCalledWith(
      expect.any(Object),
      'task-images',
      ['tenant-1/task-1/thumb.jpg', 'tenant-1/task-1/medium.jpg', 'tenant-1/task-1/full.jpg']
    );
  });

  it('removes task image and deletes storage objects', async () => {
    taskStore.set('task-1', createTask({
      thumbnail_url: 'https://cdn.supabase.co/storage/v1/object/public/task-images/tenant-1/task-1/thumb.jpg',
      medium_url: 'https://cdn.supabase.co/storage/v1/object/public/task-images/tenant-1/task-1/medium.jpg',
      primary_image_url: 'https://cdn.supabase.co/storage/v1/object/public/task-images/tenant-1/task-1/full.jpg',
    }));

    const result = await service.removeTaskImage(
      {} as any,
      'task-1',
      'tenant-1'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.thumbnail_url).toBeNull();
    }

    expect(deleteImagesFromStorageMock).toHaveBeenCalledWith(
      expect.any(Object),
      'task-images',
      ['tenant-1/task-1/thumb.jpg', 'tenant-1/task-1/medium.jpg', 'tenant-1/task-1/full.jpg']
    );
  });
});
