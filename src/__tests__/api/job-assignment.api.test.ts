/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/api/job-assignment.api.test.ts
 * phase: 3
 * domain: job-assignment
 * purpose: Contract tests for POST /api/jobs/{jobId}/assign (T007)
 * spec_ref: specs/010-job-assignment-and/contracts/assign-job.openapi.yaml
 * coverage_target: 0 (initial failing tests for TDD)
 * depends_on: [
 *   'T001 Verify test accounts',
 *   'T002 Extend RequestContext',
 *   'T003-T006a job_assignments migration + types'
 * ]
 * complexity_budget: 150
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/lib/auth/context';
import { NotFoundError, ValidationError, AppError, ErrorCode } from '@/core/errors/error-types';

if (typeof Response !== 'undefined' && typeof (Response as any).json !== 'function') {
  (Response as any).json = (data: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      },
      ...init
    });
}

jest.mock('@/lib/auth/context', () => {
  const actual = jest.requireActual('@/lib/auth/context');
  return {
    __esModule: true,
    ...actual,
    getRequestContext: jest.fn()
  };
});

jest.mock('@/domains/job-assignment/services/job-assignment.service', () => ({
  __esModule: true,
  JobAssignmentService: jest.fn()
}));

const { getRequestContext } = jest.requireMock('@/lib/auth/context') as {
  getRequestContext: jest.Mock;
};

const { JobAssignmentService } = jest.requireMock(
  '@/domains/job-assignment/services/job-assignment.service'
) as {
  JobAssignmentService: jest.Mock;
};

const supervisorContext: RequestContext = {
  tenantId: 'tenant-123',
  roles: ['supervisor'],
  source: 'session',
  userId: 'user-supervisor',
  isSupervisor: true,
  isCrew: false
} as RequestContext;

const crewContext: RequestContext = {
  tenantId: 'tenant-123',
  roles: ['technician'],
  source: 'session',
  userId: 'user-crew',
  isSupervisor: false,
  isCrew: true
} as RequestContext;

describe('POST /api/jobs/{jobId}/assign (contract)', () => {
  let assignCrewToJobMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    assignCrewToJobMock = jest.fn();
    JobAssignmentService.mockImplementation(() => ({
      assignCrewToJob: assignCrewToJobMock
    }));
  });

  it('returns assignments for valid supervisor request', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);
    assignCrewToJobMock.mockResolvedValue({
      assignments: [
        {
          id: 'assignment-1',
          job_id: 'job-123',
          user_id: 'crew-1',
          tenant_id: 'tenant-123',
          assigned_by: 'user-supervisor',
          assigned_at: '2025-01-02T03:04:05Z',
          created_at: '2025-01-02T03:04:05Z',
          updated_at: '2025-01-02T03:04:05Z'
        }
      ],
      message: 'Successfully assigned 1 crew member to job'
    });

    const { req } = createMocks({
      method: 'POST',
      url: 'https://example.com/api/jobs/job-123/assign',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-token'
      },
      body: {
        user_ids: ['crew-1']
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/assign/route');
    const response = await module.POST(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const body = await response.json();

    expect(assignCrewToJobMock).toHaveBeenCalledWith(supervisorContext, 'job-123', ['crew-1']);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: 'Successfully assigned 1 crew member to job',
      assignments: [
        expect.objectContaining({
          id: 'assignment-1',
          job_id: 'job-123',
          user_id: 'crew-1',
          tenant_id: supervisorContext.tenantId,
          assigned_by: supervisorContext.userId
        })
      ]
    });
  });

  it('rejects invalid user ID format', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);

    const { req } = createMocks({
      method: 'POST',
      url: 'https://example.com/api/jobs/job-123/assign',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-token'
      },
      body: {
        user_ids: ['not-a-uuid']
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/assign/route');

    await expect(
      module.POST(req as unknown as NextRequest, { params: { jobId: 'job-123' } })
    ).resolves.toHaveProperty('status', 400);
    expect(assignCrewToJobMock).not.toHaveBeenCalled();
  });

  it('forbids non-supervisor roles', async () => {
    getRequestContext.mockResolvedValue(crewContext);

    const { req } = createMocks({
      method: 'POST',
      url: 'https://example.com/api/jobs/job-123/assign',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-token'
      },
      body: {
        user_ids: ['c01b7d68-733e-4c6d-9961-2b282087b12a']
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/assign/route');
    const response = await module.POST(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: 'Forbidden',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
    expect(assignCrewToJobMock).not.toHaveBeenCalled();
  });

  it('returns 404 when job is not found', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);
    assignCrewToJobMock.mockRejectedValue(new NotFoundError('Job not found'));

    const { req } = createMocks({
      method: 'POST',
      url: 'https://example.com/api/jobs/job-404/assign',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-token'
      },
      body: {
        user_ids: ['c01b7d68-733e-4c6d-9961-2b282087b12a']
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/assign/route');
    const response = await module.POST(req as unknown as NextRequest, {
      params: { jobId: 'job-404' }
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({
      error: 'Job not found',
      code: 'RESOURCE_NOT_FOUND'
    });
  });

  it('returns 422 for completed jobs', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);
    assignCrewToJobMock.mockRejectedValue(
      new AppError('Jobs with status completed cannot be assigned', ErrorCode.INVALID_INPUT)
    );

    const { req } = createMocks({
      method: 'POST',
      url: 'https://example.com/api/jobs/job-done/assign',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-token'
      },
      body: {
        user_ids: ['c01b7d68-733e-4c6d-9961-2b282087b12a']
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/assign/route');
    const response = await module.POST(req as unknown as NextRequest, {
      params: { jobId: 'job-done' }
    });
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({
      error: 'Cannot assign to completed job',
      code: 'INVALID_JOB_STATUS'
    });
  });

  it('returns 400 when service signals duplicate assignment', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);
    assignCrewToJobMock.mockRejectedValue(
      new ValidationError('Crew member already assigned', 'user_ids')
    );

    const { req } = createMocks({
      method: 'POST',
      url: 'https://example.com/api/jobs/job-123/assign',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-token'
      },
      body: {
        user_ids: ['c01b7d68-733e-4c6d-9961-2b282087b12a']
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/assign/route');
    const response = await module.POST(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Crew member already assigned',
      code: 'DUPLICATE_ASSIGNMENT'
    });
  });
});
