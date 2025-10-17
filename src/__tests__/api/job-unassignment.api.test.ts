/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/api/job-unassignment.api.test.ts
 * phase: 3
 * domain: job-assignment
 * purpose: Contract tests for DELETE /api/jobs/{jobId}/unassign (T008)
 * spec_ref: specs/010-job-assignment-and/contracts/unassign-job.openapi.yaml
 * coverage_target: 0 (initial failing tests for TDD)
 * depends_on: [
 *   'T001 Verify test accounts',
 *   'T002 Extend RequestContext',
 *   'T003-T006a job_assignments migration + types'
 * ]
 * complexity_budget: 120
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMocks } from 'node-mocks-http';
import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/lib/auth/context';
import { NotFoundError, ValidationError } from '@/core/errors/error-types';

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

describe('DELETE /api/jobs/{jobId}/unassign (contract)', () => {
  let unassignCrewFromJobMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unassignCrewFromJobMock = jest.fn();
    JobAssignmentService.mockImplementation(() => ({
      unassignCrewFromJob: unassignCrewFromJobMock
    }));
  });

  it('returns removed assignment for valid supervisor request', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);
    unassignCrewFromJobMock.mockResolvedValue({
      success: true,
      assignment: {
        id: 'assignment-1',
        job_id: 'job-123',
        user_id: 'crew-1',
        tenant_id: 'tenant-123',
        assigned_by: 'user-supervisor',
        assigned_at: '2025-01-02T03:04:05Z',
        created_at: '2025-01-02T03:04:05Z',
        updated_at: '2025-01-02T03:04:05Z'
      },
      message: 'Successfully removed crew member from job'
    });

    const { req } = createMocks({
      method: 'DELETE',
      url: 'https://example.com/api/jobs/job-123/unassign?user_id=crew-1',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/unassign/route');
    const response = await module.DELETE(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const body = await response.json();

    expect(unassignCrewFromJobMock).toHaveBeenCalledWith(
      supervisorContext,
      'job-123',
      'crew-1'
    );
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      message: 'Successfully removed crew member from job',
      removed_assignment: expect.objectContaining({
        id: 'assignment-1',
        user_id: 'crew-1'
      })
    });
  });

  it('rejects missing user_id parameter', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);

    const { req } = createMocks({
      method: 'DELETE',
      url: 'https://example.com/api/jobs/job-123/unassign',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/unassign/route');
    const response = await module.DELETE(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: 'Missing user_id parameter',
      code: 'MISSING_PARAMETER'
    });
    expect(unassignCrewFromJobMock).not.toHaveBeenCalled();
  });

  it('rejects invalid user_id format', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);

    const { req } = createMocks({
      method: 'DELETE',
      url: 'https://example.com/api/jobs/job-123/unassign?user_id=invalid',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/unassign/route');
    const response = await module.DELETE(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: 'Invalid user ID format',
      code: 'INVALID_INPUT'
    });
    expect(unassignCrewFromJobMock).not.toHaveBeenCalled();
  });

  it('forbids non-supervisor roles', async () => {
    getRequestContext.mockResolvedValue(crewContext);

    const { req } = createMocks({
      method: 'DELETE',
      url: 'https://example.com/api/jobs/job-123/unassign?user_id=crew-1',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/unassign/route');
    const response = await module.DELETE(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: 'Forbidden',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
    expect(unassignCrewFromJobMock).not.toHaveBeenCalled();
  });

  it('returns 404 when assignment not found', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);
    unassignCrewFromJobMock.mockRejectedValue(
      new NotFoundError('No assignment found for this job and crew member')
    );

    const { req } = createMocks({
      method: 'DELETE',
      url: 'https://example.com/api/jobs/job-123/unassign?user_id=crew-missing',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/unassign/route');
    const response = await module.DELETE(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({
      error: 'No assignment found for this job and crew member',
      code: 'ASSIGNMENT_NOT_FOUND'
    });
  });

  it('maps service validation errors to 400 responses', async () => {
    getRequestContext.mockResolvedValue(supervisorContext);
    unassignCrewFromJobMock.mockRejectedValue(
      new ValidationError('Cannot remove assignment while job is in progress')
    );

    const { req } = createMocks({
      method: 'DELETE',
      url: 'https://example.com/api/jobs/job-123/unassign?user_id=crew-1',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    const module = await import('@/app/api/jobs/[jobId]/unassign/route');
    const response = await module.DELETE(req as unknown as NextRequest, {
      params: { jobId: 'job-123' }
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'Cannot remove assignment while job is in progress',
      code: 'INVALID_INPUT'
    });
  });
});
