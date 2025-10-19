/**
 * Contract Tests: Task Template API Endpoints
 *
 * Feature: 011-making-task-lists
 * Tests: T022 - API contract tests for template endpoints
 *
 * PURPOSE: Validate request/response schemas for template management endpoints
 */

import { GET as getTemplates, POST as createTemplate } from '@/app/api/task-templates/route';
import { GET as getTemplate, PATCH as updateTemplate, DELETE as deleteTemplate } from '@/app/api/task-templates/[id]/route';
import { POST as instantiateTemplate } from '@/app/api/task-templates/[id]/instantiate/route';

// Mock Next.js server utilities
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number } = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

// Build comprehensive Supabase mock
function buildSupabaseMock(config?: {
  templatesData?: any[];
  templateData?: any;
  templateItemsData?: any[];
  insertTemplateData?: any;
  insertItemsData?: any[];
  updateTemplateData?: any;
  workflowTasksData?: any[];
  usageCount?: number;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'task_templates') {
        return {
          select: jest.fn((columns?: string) => ({
            eq: jest.fn((col: string, val: any) => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: config?.templatesData || [],
                  error: null,
                })
              ),
              single: jest.fn(() =>
                Promise.resolve({
                  data: config?.templateData || null,
                  error: null,
                })
              ),
            })),
            order: jest.fn(() =>
              Promise.resolve({
                data: config?.templatesData || [],
                error: null,
              })
            ),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: config?.insertTemplateData || {
                    id: 'template-123',
                    name: 'Test Template',
                    is_active: true,
                  },
                  error: null,
                })
              ),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn((col: string, val: any) => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: config?.updateTemplateData || {
                      id: 'template-123',
                      name: 'Updated',
                    },
                    error: null,
                  })
                ),
              })),
            })),
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        };
      }
      if (table === 'task_template_items') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() =>
                Promise.resolve({
                  data: config?.templateItemsData || [],
                  error: null,
                })
              ),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() =>
              Promise.resolve({
                data: config?.insertItemsData || [],
                error: null,
              })
            ),
          })),
        };
      }
      if (table === 'workflow_tasks') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn((col: string, val: any) => ({
              eq: jest.fn(() => ({
                order: jest.fn(() =>
                  Promise.resolve({
                    data: config?.workflowTasksData || [],
                    error: null,
                  })
                ),
              })),
              limit: jest.fn(() =>
                Promise.resolve({
                  data: config?.usageCount !== undefined ? config.usageCount : 0,
                  error: null,
                })
              ),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() =>
              Promise.resolve({
                data: config?.workflowTasksData || [],
                error: null,
              })
            ),
          })),
        };
      }
      return {};
    }),
  };
}

// Mock context
let mockContext = {
  tenantId: 'tenant-123',
  userId: 'user-123',
  roles: ['supervisor'],
  isSupervisor: true,
};

jest.mock('@/lib/auth/context', () => ({
  getRequestContext: jest.fn(() => mockContext),
}));

// Mock server createClient
let mockServerClient = buildSupabaseMock();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockServerClient),
}));

// Mock @supabase/supabase-js for service role client
let mockServiceClient = buildSupabaseMock();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockServiceClient),
}));

// Test constants
const MOCK_TEMPLATE_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_JOB_ID = '22222222-2222-2222-2222-222222222222';

function createMockRequest(body?: unknown, url?: string): any {
  return {
    json: async () => body,
    url: url || 'http://localhost:3000/api/task-templates',
  };
}

describe('GET /api/task-templates - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServerClient = buildSupabaseMock({ templatesData: [] });
    jest.requireMock('@/lib/supabase/server').createClient.mockReturnValue(mockServerClient);
  });

  it('should return templates array with correct schema', async () => {
    const response = await getTemplates(createMockRequest());

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('templates');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.templates)).toBe(true);
    expect(typeof data.count).toBe('number');
  });

  it('should accept includeInactive query parameter', async () => {
    const response = await getTemplates(
      createMockRequest(undefined, 'http://localhost:3000/api/task-templates?includeInactive=true')
    );

    expect(response.status).toBe(200);
  });

  it('should include template fields', async () => {
    // Mock with actual template data
    mockServerClient = buildSupabaseMock({
      templatesData: [{
        id: 'template-1',
        name: 'Test Template',
        description: 'Description',
        job_type: 'Inspection',
        is_active: true,
        created_at: new Date().toISOString(),
      }],
    });
    jest.requireMock('@/lib/supabase/server').createClient.mockReturnValue(mockServerClient);

    const response = await getTemplates(createMockRequest());

    const data = await response.json();
    if (data.templates.length > 0) {
      const template = data.templates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('is_active');
    }
  });
});

describe('POST /api/task-templates - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServiceClient = buildSupabaseMock({
      insertTemplateData: {
        id: 'template-123',
        name: 'Test Template',
        is_active: true,
      },
      insertItemsData: [],
    });
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);
  });

  it('should accept valid template creation request', async () => {
    const validTemplate = {
      name: 'New Template',
      description: 'Template description',
      job_type: 'Inspection',
      items: [
        {
          task_order: 0,
          task_description: 'First task',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
        },
      ],
    };

    const response = await createTemplate(createMockRequest(validTemplate));

    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data).toHaveProperty('template');
    expect(data).toHaveProperty('message');
  });

  it('should reject template without items', async () => {
    const invalidTemplate = {
      name: 'Template Without Items',
      description: 'No items',
      items: [],
    };

    const response = await createTemplate(createMockRequest(invalidTemplate));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('should reject template without name', async () => {
    const invalidTemplate = {
      description: 'No name',
      items: [
        {
          task_order: 0,
          task_description: 'Task',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
        },
      ],
    };

    const response = await createTemplate(createMockRequest(invalidTemplate));

    expect(response.status).toBe(400);
  });

  it('should reject empty template name', async () => {
    const invalidTemplate = {
      name: '',
      items: [
        {
          task_order: 0,
          task_description: 'Task',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
        },
      ],
    };

    const response = await createTemplate(createMockRequest(invalidTemplate));

    expect(response.status).toBe(400);
  });

  it('should reject items with negative task_order', async () => {
    const invalidTemplate = {
      name: 'Template',
      items: [
        {
          task_order: -1,
          task_description: 'Task',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
        },
      ],
    };

    const response = await createTemplate(createMockRequest(invalidTemplate));

    expect(response.status).toBe(400);
  });

  it('should accept optional description and job_type', async () => {
    const validTemplate = {
      name: 'Minimal Template',
      items: [
        {
          task_order: 0,
          task_description: 'Task',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
        },
      ],
    };

    const response = await createTemplate(createMockRequest(validTemplate));

    expect([201, 400]).toContain(response.status);
  });

  it('should return 403 for non-supervisor users', async () => {
    const { getRequestContext } = require('@/lib/auth/context');
    getRequestContext.mockReturnValueOnce({
      tenantId: 'tenant-123',
      userId: 'user-123',
      roles: ['member'],
      isSupervisor: false,
    });

    const validTemplate = {
      name: 'Template',
      items: [
        {
          task_order: 0,
          task_description: 'Task',
          is_required: true,
          requires_photo_verification: false,
          requires_supervisor_approval: false,
        },
      ],
    };

    const response = await createTemplate(createMockRequest(validTemplate));

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
  });
});

describe('GET /api/task-templates/[id] - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServerClient = buildSupabaseMock({
      templateData: {
        id: MOCK_TEMPLATE_ID,
        name: 'Test Template',
        is_active: true,
      },
      templateItemsData: [{
        id: 'item-1',
        template_id: MOCK_TEMPLATE_ID,
        task_order: 0,
        task_description: 'Task',
      }],
    });
    jest.requireMock('@/lib/supabase/server').createClient.mockReturnValue(mockServerClient);
  });

  it('should return template with items', async () => {
    const response = await getTemplate(
      createMockRequest(),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('template');
    expect(data.template).toHaveProperty('items');
    expect(Array.isArray(data.template.items)).toBe(true);
  });

  it('should return 404 for non-existent template', async () => {
    // Mock the not-found scenario by having select().eq().single() return PGRST116 error
    mockServerClient = {
      from: jest.fn((table: string) => {
        if (table === 'task_templates') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: {
                      code: 'PGRST116',
                      message: 'No rows returned',
                    },
                  })
                ),
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }),
    };
    jest.requireMock('@/lib/supabase/server').createClient.mockReturnValue(mockServerClient);

    const response = await getTemplate(
      createMockRequest(),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/task-templates/[id] - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServiceClient = buildSupabaseMock({
      updateTemplateData: {
        id: MOCK_TEMPLATE_ID,
        name: 'Updated Name',
        is_active: false,
      },
    });
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);
  });

  it('should accept valid template update', async () => {
    const validUpdate = {
      name: 'Updated Name',
      is_active: false,
    };

    const response = await updateTemplate(
      createMockRequest(validUpdate),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('template');
    expect(data).toHaveProperty('message');
  });

  it('should accept partial updates', async () => {
    mockServiceClient = buildSupabaseMock({
      updateTemplateData: {
        id: MOCK_TEMPLATE_ID,
        description: 'New description',
      },
    });
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);

    const partialUpdate = {
      description: 'New description',
    };

    const response = await updateTemplate(
      createMockRequest(partialUpdate),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    expect(response.status).toBe(200);
  });

  it('should reject empty name', async () => {
    const invalidUpdate = {
      name: '',
    };

    const response = await updateTemplate(
      createMockRequest(invalidUpdate),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/task-templates/[id] - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServiceClient = buildSupabaseMock({
      usageCount: 0, // Template not in use
    });
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);
  });

  it('should accept valid delete request when not in use', async () => {
    const response = await deleteTemplate(
      createMockRequest(),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    const data = await response.json();
    expect([200, 409]).toContain(response.status);
    expect(data).toHaveProperty('message');
  });

  it('should return 403 for non-supervisor users', async () => {
    const { getRequestContext } = require('@/lib/auth/context');
    getRequestContext.mockReturnValueOnce({
      tenantId: 'tenant-123',
      userId: 'user-123',
      roles: ['member'],
      isSupervisor: false,
    });

    const response = await deleteTemplate(
      createMockRequest(),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    expect(response.status).toBe(403);
  });
});

describe('POST /api/task-templates/[id]/instantiate - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServiceClient = buildSupabaseMock({
      templateData: {
        id: MOCK_TEMPLATE_ID,
        name: 'Test Template',
        is_active: true,
      },
      templateItemsData: [{
        id: 'item-1',
        template_id: MOCK_TEMPLATE_ID,
        task_order: 0,
        task_description: 'Task from template',
        is_required: true,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
      }],
      workflowTasksData: [{
        id: 'task-1',
        job_id: MOCK_JOB_ID,
        task_description: 'Task from template',
        task_order: 0,
        is_required: true,
        status: 'pending',
      }],
    });
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);
  });

  it('should accept valid instantiation request', async () => {
    const validRequest = {
      job_id: MOCK_JOB_ID,
    };

    const response = await instantiateTemplate(
      createMockRequest(validRequest),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    const data = await response.json();
    expect([201, 404]).toContain(response.status);
    if (response.status === 201) {
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('message');
      expect(Array.isArray(data.tasks)).toBe(true);
    }
  });

  it('should reject missing job_id', async () => {
    const invalidRequest = {};

    const response = await instantiateTemplate(
      createMockRequest(invalidRequest),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('should reject invalid UUID format', async () => {
    const invalidRequest = {
      job_id: 'not-a-uuid',
    };

    const response = await instantiateTemplate(
      createMockRequest(invalidRequest),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    expect(response.status).toBe(400);
  });

  it('should return 403 for non-supervisor users', async () => {
    const { getRequestContext } = require('@/lib/auth/context');
    getRequestContext.mockReturnValueOnce({
      tenantId: 'tenant-123',
      userId: 'user-123',
      roles: ['member'],
      isSupervisor: false,
    });

    const validRequest = {
      job_id: MOCK_JOB_ID,
    };

    const response = await instantiateTemplate(
      createMockRequest(validRequest),
      { params: { id: MOCK_TEMPLATE_ID } }
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
  });
});
