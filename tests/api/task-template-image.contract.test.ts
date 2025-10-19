import { POST, DELETE as deleteTemplateImage } from '@/app/api/task-templates/[id]/image/route';

const mockGetRequestContext = jest.fn();
jest.mock('@/lib/auth/context', () => ({
  getRequestContext: (req: Request) => mockGetRequestContext(req),
}));

const mockCreateServiceClient = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

const mockTemplateRepoConstructor = jest.fn();
jest.mock('@/domains/task-template/repositories/TaskTemplateRepository', () => ({
  TaskTemplateRepository: function (...args: unknown[]) {
    mockTemplateRepoConstructor(...args);
    return {};
  },
}));

const mockTaskRepoConstructor = jest.fn();
jest.mock('@/domains/workflow-task/repositories/WorkflowTaskRepository', () => ({
  WorkflowTaskRepository: function (...args: unknown[]) {
    mockTaskRepoConstructor(...args);
    return {};
  },
}));

const uploadTemplateImageMock = jest.fn();
const removeTemplateImageMock = jest.fn();
jest.mock('@/domains/task-template/services/TaskTemplateService', () => ({
  TaskTemplateService: function () {
    return {
      uploadTemplateImage: uploadTemplateImageMock,
      removeTemplateImage: removeTemplateImageMock,
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

describe('POST /api/task-templates/[id]/image', () => {
  it('returns 200 with template payload on success', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);
    const template = {
      id: 'template-1',
      tenant_id: 'tenant-1',
      thumbnail_url: 'thumb-url',
      medium_url: 'medium-url',
      primary_image_url: 'primary-url',
    };

    uploadTemplateImageMock.mockResolvedValue({
      ok: true,
      value: template,
    });

    const request = createRequest({
      images: {
        thumbnail: 'data:image/jpeg;base64,AAA',
        medium: 'data:image/jpeg;base64,BBB',
        full: 'data:image/jpeg;base64,CCC',
      },
    });

    const response = await POST(request, { params: { id: 'template-1' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      template,
    });

    expect(uploadTemplateImageMock).toHaveBeenCalledWith(
      expect.anything(),
      'template-1',
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

    const response = await POST(createRequest({ images: {} }), { params: { id: 'template-1' } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(uploadTemplateImageMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);

    const response = await POST(createRequest({ images: { thumbnail: '' } }), {
      params: { id: 'template-1' },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_INPUT');
    expect(uploadTemplateImageMock).not.toHaveBeenCalled();
  });

  it('maps service errors to appropriate status codes', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);

    uploadTemplateImageMock.mockResolvedValue({
      ok: false,
      error: {
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Template not found',
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
      { params: { id: 'missing-template' } }
    );

    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.error).toBe('TEMPLATE_NOT_FOUND');
  });

  it('handles DELETE to remove template image', async () => {
    mockGetRequestContext.mockResolvedValue(supervisorContext);
    removeTemplateImageMock.mockResolvedValue({
      ok: true,
      value: {
        id: 'template-1',
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      },
    });

    const response = await deleteTemplateImage({} as any, { params: { id: 'template-1' } });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.template.primary_image_url).toBeNull();
    expect(removeTemplateImageMock).toHaveBeenCalledWith(
      expect.anything(),
      'template-1',
      'tenant-1'
    );
  });
});
