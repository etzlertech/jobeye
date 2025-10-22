/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/supervisor/api/jobs-update.test.ts
 * phase: 3
 * domain: supervisor
 * purpose: Ensures supervisors can edit job schedule details
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * coverage_target: 90
 */

import { describe, beforeEach, expect, it, jest } from '@jest/globals';

const mockUpdate = jest.fn();
const mockFindById = jest.fn();

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

jest.mock('@/lib/auth/context', () => ({
  getRequestContext: jest.fn()
}));

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
  createServiceClient: jest.fn()
}));

jest.mock('@/domains/jobs/repositories/jobs.repository', () => ({
  JobsRepository: jest.fn(() => ({
    update: mockUpdate,
    findById: mockFindById
  }))
}));

const { getRequestContext } = jest.requireMock('@/lib/auth/context') as {
  getRequestContext: jest.Mock;
};
const { createServerClient } = jest.requireMock('@/lib/supabase/server') as {
  createServerClient: jest.Mock;
};

describe('PUT /api/supervisor/jobs/[jobId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getRequestContext.mockResolvedValue({
      tenantId: 'tenant-1',
      user: { id: 'user-1' }
    });

    createServerClient.mockResolvedValue({} as Record<string, unknown>);
  });

  it('updates scheduled date and time for a job', async () => {
    mockFindById.mockResolvedValue({
      id: 'job-123',
      scheduled_date: '2025-02-09',
      scheduled_time: '09:00'
    });
    mockUpdate.mockResolvedValue({
      id: 'job-123',
      title: 'Updated Job',
      scheduled_date: '2025-02-10',
      scheduled_time: '14:30',
      scheduled_start: '2025-02-10T14:30:00'
    });

    const request = {
      json: jest.fn().mockResolvedValue({
        title: 'Updated Job',
        scheduledDate: '2025-02-10',
        scheduledTime: '14:30'
      })
    };

    const { PUT } = await import('@/app/api/supervisor/jobs/[jobId]/route');
    const response = await PUT(request as any, { params: { jobId: 'job-123' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'job-123',
      expect.objectContaining({
        title: 'Updated Job',
        scheduled_start: '2025-02-10T14:30:00',
        scheduled_date: '2025-02-10',
        scheduled_time: '14:30'
      }),
      { tenant_id: 'tenant-1' }
    );
    expect(body.job).toEqual(
      expect.objectContaining({
        id: 'job-123',
        scheduled_date: '2025-02-10',
        scheduled_time: '14:30'
      })
    );
  });

  it('defaults to existing scheduled time when only a new date is provided', async () => {
    mockFindById.mockResolvedValue({
      id: 'job-123',
      scheduled_date: '2025-02-09',
      scheduled_time: '11:15'
    });
    mockUpdate.mockResolvedValue({
      id: 'job-123',
      scheduled_date: '2025-02-12',
      scheduled_time: '11:15',
      scheduled_start: '2025-02-12T11:15:00'
    });

    const request = {
      json: jest.fn().mockResolvedValue({
        scheduledDate: '2025-02-12'
      })
    };

    const { PUT } = await import('@/app/api/supervisor/jobs/[jobId]/route');
    const response = await PUT(request as any, { params: { jobId: 'job-123' } });

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'job-123',
      expect.objectContaining({
        scheduled_start: '2025-02-12T11:15:00',
        scheduled_date: '2025-02-12',
        scheduled_time: '11:15'
      }),
      { tenant_id: 'tenant-1' }
    );
  });

  it('returns 400 when provided schedule values are invalid', async () => {
    const request = {
      json: jest.fn().mockResolvedValue({
        scheduledDate: '2025-02-40'
      })
    };

    const { PUT } = await import('@/app/api/supervisor/jobs/[jobId]/route');
    const response = await PUT(request as any, { params: { jobId: 'job-123' } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid schedule payload');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
