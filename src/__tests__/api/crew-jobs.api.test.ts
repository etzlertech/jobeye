/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/api/crew-jobs.api.test.ts
 * phase: 3
 * domain: job-assignment
 * purpose: Contract tests for GET /api/crew/jobs (T009)
 * spec_ref: specs/010-job-assignment-and/contracts/crew-jobs.openapi.yaml
 * coverage_target: 0 (initial failing tests for TDD)
 * depends_on: [
 *   'T001 Verify test accounts',
 *   'T002 Extend RequestContext',
 *   'T003-T006a job_assignments migration + types'
 * ]
 * complexity_budget: 150
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/lib/auth/context';

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

jest.mock('@/lib/auth/with-auth', () => ({
  __esModule: true,
  withAuth: jest.fn(() => {
    throw new Error('withAuth should not be called; use getRequestContext instead');
  })
}));

jest.mock('@/domains/crew/services/crew-workflow.service', () => ({
  __esModule: true,
  CrewWorkflowService: jest.fn(() => {
    throw new Error('CrewWorkflowService should be replaced by JobAssignmentService');
  })
}));

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

const crewContext: RequestContext = {
  tenantId: 'tenant-123',
  roles: ['technician'],
  source: 'session',
  userId: 'crew-123',
  isCrew: true,
  isSupervisor: false
} as RequestContext;

const nonCrewContext: RequestContext = {
  tenantId: 'tenant-123',
  roles: ['supervisor'],
  source: 'session',
  userId: 'user-supervisor',
  isCrew: false,
  isSupervisor: true
} as RequestContext;

describe('GET /api/crew/jobs (contract)', () => {
  let getCrewJobsMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getCrewJobsMock = jest.fn();
    JobAssignmentService.mockImplementation(() => ({
      getCrewJobs: getCrewJobsMock
    }));
  });

  it('returns crew jobs sorted by scheduled_start ASC', async () => {
    getRequestContext.mockResolvedValue(crewContext);
    getCrewJobsMock.mockResolvedValue({
      success: true,
      jobs: [
        {
          id: 'job-1',
          tenant_id: 'tenant-123',
          job_number: 'JOB-001',
          status: 'scheduled',
          priority: 'high',
          customer_id: 'customer-2',
          customer_name: 'Acme Industries',
          property_id: 'property-2',
          property_address: '123 Main St',
          property_location: { latitude: 37.7749, longitude: -122.4194 },
          scheduled_start: '2025-05-01T09:00:00Z',
          assigned_at: '2025-04-29T09:00:00Z',
          assigned_by: 'supervisor-2',
          assigned_by_name: 'Morgan Lee',
          total_items: 5,
          loaded_items: 3,
          load_percentage: 60,
          is_fully_loaded: false,
          notes: 'Bring HVAC kit',
          created_at: '2025-04-01T09:00:00Z',
          updated_at: '2025-04-09T12:00:00Z'
        },
        {
          id: 'job-2',
          tenant_id: 'tenant-123',
          job_number: 'JOB-002',
          status: 'scheduled',
          priority: 'normal',
          customer_id: 'customer-1',
          customer_name: 'Globex',
          property_id: 'property-1',
          property_address: '456 Field St',
          property_location: { latitude: 37.779, longitude: -122.419 },
          scheduled_start: '2025-05-01T15:00:00Z',
          assigned_at: '2025-04-30T10:00:00Z',
          assigned_by: 'supervisor-1',
          assigned_by_name: 'Jamie Rivera',
          total_items: 4,
          loaded_items: 4,
          load_percentage: 100,
          is_fully_loaded: true,
          notes: null,
          created_at: '2025-04-01T10:00:00Z',
          updated_at: '2025-04-10T11:00:00Z'
        }
      ],
      total_count: 2,
      has_more: false
    });

    const req = new Request('https://example.com/api/crew/jobs', {
      method: 'GET',
      headers: { authorization: 'Bearer test-token' }
    });

    const module = await import('@/app/api/crew/jobs/route');
    const response = await module.GET(req as unknown as NextRequest);
    const body = await response.json();

    expect(getCrewJobsMock).toHaveBeenCalledWith(crewContext, {
      status: 'scheduled',
      limit: 50,
      offset: 0
    });
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      total_count: 2,
      has_more: false
    });
    expect(body.jobs).toHaveLength(2);
    expect(body.jobs[0].id).toBe('job-1');
    expect(body.jobs[1].id).toBe('job-2');
    expect(body.jobs[0]).toMatchObject({
      total_items: 5,
      loaded_items: 3,
      load_percentage: 60,
      is_fully_loaded: false
    });
    expect(body.jobs[1].is_fully_loaded).toBe(true);
  });

  it('passes pagination parameters to the service', async () => {
    getRequestContext.mockResolvedValue(crewContext);
    getCrewJobsMock.mockResolvedValue({
      success: true,
      jobs: [],
      total_count: 0,
      has_more: false
    });

    const req = new Request('https://example.com/api/crew/jobs?status=in_progress&limit=10&offset=5');

    const module = await import('@/app/api/crew/jobs/route');
    await module.GET(req as unknown as NextRequest);

    expect(getCrewJobsMock).toHaveBeenCalledWith(crewContext, {
      status: 'in_progress',
      limit: 10,
      offset: 5
    });
  });

  it('forbids access for non-crew roles', async () => {
    getRequestContext.mockResolvedValue(nonCrewContext);

    const req = new Request('https://example.com/api/crew/jobs');
    const module = await import('@/app/api/crew/jobs/route');
    const response = await module.GET(req as unknown as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: 'Forbidden',
      code: 'INVALID_ROLE'
    });
    expect(getCrewJobsMock).not.toHaveBeenCalled();
  });

  it('returns 401 when getRequestContext throws', async () => {
    getRequestContext.mockRejectedValue(new Error('No auth'));

    const req = new Request('https://example.com/api/crew/jobs');
    const module = await import('@/app/api/crew/jobs/route');
    const response = await module.GET(req as unknown as NextRequest);

    expect(response.status).toBe(401);
  });
});
