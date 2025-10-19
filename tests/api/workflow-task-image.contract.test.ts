import { POST, DELETE as deleteTaskImage } from '@/app/api/workflow-tasks/[id]/image/route';

const mockGetRequestContext = jest.fn();
jest.mock('@/lib/auth/context', () => ({
  getRequestContext: (req: Request) => mockGetRequestContext(req),
}));

const mockCreateServiceClient = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

const mockTaskRepoConstructor = jest.fn();
jest.mock('@/domains/workflow-task/repositories/WorkflowTaskRepository', () => ({
  WorkflowTaskRepository: function (...args: unknown[]) {
    mockTaskRepoConstructor(...args);
    return {};
  },
}));

const uploadTaskImageMock = jest.fn();
const removeTaskImageMock = jest.fn();
jest.mock('@/domains/workflow-task/services/WorkflowTaskService', () => ({
  WorkflowTaskService: function () {
    return {
      uploadTaskImage: uploadTaskImageMock,
      removeTaskImage: removeTaskImageMock,
    };
  },
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number } = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateServiceClient.mockReturnValue({} as any);
});

const supervisorContext = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  isSupervisor: true,
};

const workerContext = {
  tenantId: 'tenant-1',
  userId: 'user-2',
  isSupervisor: false,
};

function createRequest(body: unknown) {
  return {
    json: async () => body,
  } as Request;
}

describe('POST /api/workflow-tasks/[id]/image', () => {
  it('returns 200 with task payload on success', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);
    const task = {
      id: 'task-1',
      tenant_id: 'tenant-1',
      thumbnail_url: 'thumb-url',
      medium_url: 'medium-url',
      primary_image_url: 'primary-url',
    };

    uploadTaskImageMock.mockResolvedValue({
      ok: true,
      value: task,
    });

    const response = await POST(
      createRequest({
        images: {
          thumbnail: 'data:image/jpeg;base64,AAA',
          medium: 'data:image/jpeg;base64,BBB',
          full: 'data:image/jpeg;base64,CCC',
        },
      }),
      { params: { id: 'task-1' } }
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      task,
    });

    expect(uploadTaskImageMock).toHaveBeenCalledWith(
      expect.anything(),
      'task-1',
      'tenant-1',
      expect.objectContaining({
        thumbnail: expect.any(String),
        medium: expect.any(String),
        full: expect.any(String),
      })
    );
  });

  it('returns 403 when user is not supervisor', async () => {
    mockGetRequestContext.mockResolvedValue(workerContext);

    const response = await POST(createRequest({ images: {} }), { params: { id: 'task-1' } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(uploadTaskImageMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);

    const response = await POST(createRequest({ images: { thumbnail: '' } }), {
      params: { id: 'task-1' },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_INPUT');
    expect(uploadTaskImageMock).not.toHaveBeenCalled();
  });

  it('maps service errors to appropriate status codes', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);

    uploadTaskImageMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      },
    });

    const response = await POST(
      createRequest({
        images: {
          thumbnail: 'data:image/jpeg;base64,AAA',
          medium: 'data:image/jpeg;base64,BBB',
          full: 'data:image/jpeg;base64,CCC',
        },
      }),
      { params: { id: 'missing-task' } }
    );

    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.error).toBe('TASK_NOT_FOUND');
  });

  it('handles DELETE to remove task image', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);
    removeTaskImageMock.mockResolvedValue({
      ok: true,
      value: {
        id: 'task-1',
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      },
    });

    const response = await deleteTaskImage({} as any, { params: { id: 'task-1' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.task.primary_image_url).toBeNull();
    expect(removeTaskImageMock).toHaveBeenCalledWith(
      expect.anything(),
      'task-1',
      'tenant-1'
    );
  });
});
