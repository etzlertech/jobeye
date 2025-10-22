/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/__tests__/demo-jobs/useJobDev.test.tsx
 * phase: dev-crud
 * domain: supervisor
 * purpose: Validates demo job hook supports schedule editing
 * spec_ref: DEV_CRUD_PORT_PLAN.md
 * coverage_target: 85
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useJobDev } from '@/app/demo-jobs/useJobDev';

describe('useJobDev - schedule editing', () => {
  const alertSpy = jest.fn();
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [], total_count: 0 })
    } as Response);
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('saves updated scheduled date and time when editing a job', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: 'job-1',
              job_number: 'JOB-001',
              title: 'Initial Job',
              description: null,
              status: 'scheduled',
              priority: 'normal',
              scheduled_start: '2025-02-10T09:00:00',
              customer: { name: 'Acme' },
              property: { name: 'Main HQ' },
              created_at: '2025-02-01T00:00:00'
            }
          ],
          total_count: 1
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job: { id: 'job-1' } })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: 'job-1',
              job_number: 'JOB-001',
              title: 'Initial Job',
              description: null,
              status: 'scheduled',
              priority: 'normal',
              scheduled_start: '2025-02-15T10:45:00',
              customer: { name: 'Acme' },
              property: { name: 'Main HQ' },
              created_at: '2025-02-01T00:00:00'
            }
          ],
          total_count: 1
        })
      } as Response);

    const { result } = renderHook(() =>
      useJobDev({
        tenantId: 'tenant-1',
        tenantHeaders: { 'x-tenant-id': 'tenant-1' },
        requireSignIn: false,
        setAlertMessage: alertSpy
      })
    );

    await act(async () => {
      await result.current.loadJobs();
    });

    act(() => {
      const job = result.current.jobs[0];
      result.current.beginEdit(job);
    });

    act(() => {
      result.current.updateEditingDraft('scheduledDate', '2025-02-15');
      result.current.updateEditingDraft('scheduledTime', '10:45');
    });

    await act(async () => {
      await result.current.saveEdit('job-1');
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/supervisor/jobs/job-1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          title: 'Initial Job',
          scheduledDate: '2025-02-15',
          scheduledTime: '10:45'
        })
      })
    );
  });
});
