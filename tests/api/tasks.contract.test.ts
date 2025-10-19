/**
 * Contract Tests: Workflow Task API Endpoints
 *
 * Feature: 011-making-task-lists
 * Tests: T021 - API contract tests for task endpoints
 *
 * PURPOSE: Validate request/response schemas for task management endpoints
 */

import { GET as getTasks, POST as createTask } from '@/app/api/jobs/[jobId]/tasks/route';
import { PATCH as updateTask, DELETE as deleteTask } from '@/app/api/jobs/[jobId]/tasks/[taskId]/route';

// Mock Next.js server utilities
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number } = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

// Test constants
const MOCK_JOB_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_TASK_ID = '22222222-2222-2222-2222-222222222222';

// Build comprehensive Supabase mock
function buildSupabaseMock(config?: {
  findByJobIdData?: any[];
  findByIdData?: any;
  insertData?: any;
  updateData?: any;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'workflow_tasks') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn((col: string, val: any) => {
              if (col === 'job_id') {
                // GET /tasks - findByJobId
                return {
                  eq: jest.fn(() => ({
                    order: jest.fn(() =>
                      Promise.resolve({
                        data: config?.findByJobIdData || [],
                        error: null,
                      })
                    ),
                  })),
                };
              }
              if (col === 'id') {
                // PATCH - findById
                return {
                  eq: jest.fn(() => ({
                    single: jest.fn(() =>
                      Promise.resolve({
                        data: config?.findByIdData || null,
                        error: null,
                      })
                    ),
                  })),
                };
              }
              return {
                eq: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({ data: [], error: null })),
                  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
                })),
              };
            }),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: config?.insertData || {
                    id: 'task-new',
                    job_id: MOCK_JOB_ID,
                    task_description: 'New task',
                    task_order: 0,
                    is_required: true,
                    status: 'pending',
                  },
                  error: null,
                })
              ),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn((col: string) => {
              if (col === 'id') {
                return {
                  eq: jest.fn(() => ({
                    select: jest.fn(() => ({
                      single: jest.fn(() =>
                        Promise.resolve({
                          data: config?.updateData || {
                            id: MOCK_TASK_ID,
                            status: 'complete',
                            completed_at: new Date().toISOString(),
                          },
                          error: null,
                        })
                      ),
                    })),
                  })),
                };
              }
              // For soft delete
              return Promise.resolve({ data: null, error: null });
            }),
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
  roles: ['member'],
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

function createMockRequest(body?: unknown, url?: string): any {
  return {
    json: async () => body,
    url: url || 'http://localhost:3000/api/jobs/test/tasks',
  };
}

describe('GET /api/jobs/[jobId]/tasks - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServerClient = buildSupabaseMock({ findByJobIdData: [] });
    jest.requireMock('@/lib/supabase/server').createClient.mockReturnValue(mockServerClient);
  });

  it('should return tasks array with correct schema', async () => {
    const response = await getTasks(
      createMockRequest(),
      { params: { jobId: MOCK_JOB_ID } }
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('tasks');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(typeof data.count).toBe('number');
  });

  it('should include all required task fields', async () => {
    mockServerClient = buildSupabaseMock({
      findByJobIdData: [
        {
          id: 'task-1',
          job_id: MOCK_JOB_ID,
          task_description: 'Test task',
          task_order: 0,
          is_required: true,
          is_deleted: false,
          status: 'pending',
          requires_photo_verification: false,
          requires_supervisor_approval: false,
          created_at: new Date().toISOString(),
        },
      ],
    });
    jest.requireMock('@/lib/supabase/server').createClient.mockReturnValue(mockServerClient);

    const response = await getTasks(
      createMockRequest(),
      { params: { jobId: MOCK_JOB_ID } }
    );

    const data = await response.json();
    if (data.tasks.length > 0) {
      const task = data.tasks[0];
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('job_id');
      expect(task).toHaveProperty('task_description');
      expect(task).toHaveProperty('task_order');
      expect(task).toHaveProperty('is_required');
      expect(task).toHaveProperty('status');
    }
  });
});

describe('POST /api/jobs/[jobId]/tasks - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServiceClient = buildSupabaseMock();
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);
  });

  it('should accept valid task creation request', async () => {
    const validTask = {
      task_description: 'New task',
      task_order: 0,
      is_required: true,
      requires_photo_verification: false,
      requires_supervisor_approval: false,
    };

    const response = await createTask(
      createMockRequest(validTask),
      { params: { jobId: MOCK_JOB_ID } }
    );

    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data).toHaveProperty('task');
    expect(data).toHaveProperty('message');
    expect(data.task).toHaveProperty('id');
  });

  it('should reject missing required fields', async () => {
    const invalidTask = {
      task_description: 'Missing task_order',
    };

    const response = await createTask(
      createMockRequest(invalidTask),
      { params: { jobId: MOCK_JOB_ID } }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('should reject invalid task_description (empty string)', async () => {
    const invalidTask = {
      task_description: '',
      task_order: 0,
      is_required: true,
      requires_photo_verification: false,
      requires_supervisor_approval: false,
    };

    const response = await createTask(
      createMockRequest(invalidTask),
      { params: { jobId: MOCK_JOB_ID } }
    );

    expect(response.status).toBe(400);
  });

  it('should reject negative task_order', async () => {
    const invalidTask = {
      task_description: 'Task',
      task_order: -1,
      is_required: true,
      requires_photo_verification: false,
      requires_supervisor_approval: false,
    };

    const response = await createTask(
      createMockRequest(invalidTask),
      { params: { jobId: MOCK_JOB_ID } }
    );

    expect(response.status).toBe(400);
  });

  it('should accept optional acceptance_criteria', async () => {
    const validTask = {
      task_description: 'Task with criteria',
      task_order: 0,
      is_required: true,
      requires_photo_verification: false,
      requires_supervisor_approval: false,
      acceptance_criteria: 'Must meet quality standards',
    };

    const response = await createTask(
      createMockRequest(validTask),
      { params: { jobId: MOCK_JOB_ID } }
    );

    expect(response.status).toBe(201);
  });
});

describe('PATCH /api/jobs/[jobId]/tasks/[taskId] - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServiceClient = buildSupabaseMock({
      findByIdData: {
        id: MOCK_TASK_ID,
        job_id: MOCK_JOB_ID,
        task_description: 'Test task',
        status: 'in-progress',
        is_required: true,
        requires_photo_verification: false,
        requires_supervisor_approval: false,
        created_at: new Date().toISOString(),
      },
      updateData: {
        id: MOCK_TASK_ID,
        status: 'complete',
        completed_at: new Date().toISOString(),
      },
    });
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);
  });

  it('should accept valid task update', async () => {
    const validUpdate = {
      status: 'in-progress',
    };

    const response = await updateTask(
      createMockRequest(validUpdate),
      { params: { jobId: MOCK_JOB_ID, taskId: MOCK_TASK_ID } }
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('task');
    expect(data).toHaveProperty('message');
  });

  it('should accept task completion with photo verification', async () => {
    const completionWithPhoto = {
      status: 'complete',
      verification_photo_url: 'https://storage.example.com/photo.jpg',
      ai_confidence: 0.95,
      verification_method: 'vlm',
    };

    const response = await updateTask(
      createMockRequest(completionWithPhoto),
      { params: { jobId: MOCK_JOB_ID, taskId: MOCK_TASK_ID } }
    );

    expect(response.status).toBe(200);
  });

  it('should accept partial updates', async () => {
    const partialUpdate = {
      task_description: 'Updated description',
    };

    const response = await updateTask(
      createMockRequest(partialUpdate),
      { params: { jobId: MOCK_JOB_ID, taskId: MOCK_TASK_ID } }
    );

    expect(response.status).toBe(200);
  });

  it('should reject invalid status values', async () => {
    const invalidUpdate = {
      status: 'invalid-status',
    };

    const response = await updateTask(
      createMockRequest(invalidUpdate),
      { params: { jobId: MOCK_JOB_ID, taskId: MOCK_TASK_ID } }
    );

    expect(response.status).toBe(400);
  });

  it('should validate ai_confidence range (0-1)', async () => {
    const invalidConfidence = {
      status: 'complete',
      verification_photo_url: 'https://storage.example.com/photo.jpg',
      ai_confidence: 1.5, // Invalid: > 1
      verification_method: 'vlm',
    };

    const response = await updateTask(
      createMockRequest(invalidConfidence),
      { params: { jobId: MOCK_TASK_ID, taskId: MOCK_TASK_ID } }
    );

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/jobs/[jobId]/tasks/[taskId] - Contract Tests', () => {
  beforeEach(() => {
    mockContext.isSupervisor = true;
    mockServiceClient = buildSupabaseMock();
    jest.requireMock('@supabase/supabase-js').createClient.mockReturnValue(mockServiceClient);
  });

  it('should accept valid delete request', async () => {
    const response = await deleteTask(
      createMockRequest(),
      { params: { jobId: MOCK_JOB_ID, taskId: MOCK_TASK_ID } }
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('message');
  });

  it('should return 403 for non-supervisor users', async () => {
    mockContext = {
      tenantId: 'tenant-123',
      userId: 'user-123',
      roles: ['member'],
      isSupervisor: false,
    };

    const response = await deleteTask(
      createMockRequest(),
      { params: { jobId: MOCK_JOB_ID, taskId: MOCK_TASK_ID } }
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
  });
});
