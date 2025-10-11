/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/supervisor/api/jobs-today.test.ts
 * phase: 3
 * domain: supervisor
 * purpose: Validates GET /api/supervisor/jobs/today returns supervisor job feed
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * coverage_target: 90
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
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

jest.mock('@/lib/auth/with-auth', () => ({
  __esModule: true,
  withAuth: jest.fn()
}));

jest.mock('@/lib/supabase/server', () => ({
  __esModule: true,
  createServerClient: jest.fn()
}));

const { withAuth } = jest.requireMock('@/lib/auth/with-auth') as {
  withAuth: jest.Mock
};
const { createServerClient } = jest.requireMock('@/lib/supabase/server') as {
  createServerClient: jest.Mock
};

describe('GET /api/supervisor/jobs/today', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-02-02T10:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns today jobs for supervisors', async () => {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(function () {
        return this;
      }),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'job-1',
            scheduled_date: '2025-02-02',
            scheduled_time: '09:00',
            status: 'assigned',
            special_instructions: 'Bring HVAC kit',
            job_templates: {
              name: 'HVAC Maintenance',
              estimated_duration: 90
            },
            customers: {
              name: 'Acme Industries'
            },
            properties: {
              address: '123 Supervisor Way'
            },
            job_assignments: [
              {
                assigned_at: '2025-02-02T08:00:00Z'
              }
            ]
          },
          {
            id: 'job-2',
            scheduled_date: '2025-02-02',
            scheduled_time: '13:30',
            status: 'scheduled',
            special_instructions: null,
            job_templates: null,
            customers: {
              name: 'Globex'
            },
            properties: {
              address: '456 Field Service Dr'
            },
            job_assignments: []
          }
        ],
        error: null
      })
    };

    createServerClient.mockResolvedValue({
      from: jest.fn().mockReturnValue(mockQueryBuilder)
    } as any);

    withAuth.mockImplementation(
      async (_req: NextRequest, handler: any) =>
        handler(
          {
            id: 'user-supervisor',
            app_metadata: { role: 'supervisor', tenant_id: 'tenant-123' }
          },
          'tenant-123'
        )
    );

    const { GET } = await import('@/app/api/supervisor/jobs/today/route');
    const response = await GET({} as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.date).toBe('2025-02-02');
    expect(body.total_count).toBe(2);
    expect(body.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job-1',
          customer_name: 'Acme Industries',
          property_address: '123 Supervisor Way',
          scheduled_time: '09:00',
          status: 'assigned',
          template_name: 'HVAC Maintenance',
          estimated_duration: 90,
          assigned_at: '2025-02-02T08:00:00Z'
        }),
        expect.objectContaining({
          id: 'job-2',
          customer_name: 'Globex',
          template_name: 'Custom Job',
          assigned_at: null
        })
      ])
    );
  });

  it('rejects non-supervisor roles', async () => {
    withAuth.mockImplementation(
      async (_req: NextRequest, handler: any) =>
        handler(
          {
            id: 'user-crew',
            app_metadata: { role: 'crew', tenant_id: 'tenant-123' }
          },
          'tenant-123'
        )
    );

    const { GET } = await import('@/app/api/supervisor/jobs/today/route');
    const response = await GET({} as NextRequest);

    expect(response.status).toBe(403);
  });
});
