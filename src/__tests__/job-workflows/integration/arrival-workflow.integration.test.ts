/**
 * @file src/__tests__/job-workflows/integration/arrival-workflow.integration.test.ts
 * @description Integration-style test verifying factory wiring for ArrivalWorkflowService.
 * END AGENT DIRECTIVE BLOCK
 */

import { createArrivalWorkflowService } from '@/domains/job-workflows/services/arrival-workflow.factory';
import type { ArrivalWorkflowDependencies } from '@/domains/job-workflows/services/arrival-workflow.types';
import { JobStatus } from '@/domains/job/types/job-types';

const baseJob = {
  id: 'job-55',
  tenant_id: 'tenant-1',
  job_number: 'J-55',
  title: 'Inspect harnesses',
  description: 'Inspection job',
  type: 'other',
  priority: 'normal',
  status: JobStatus.SCHEDULED,
  customerId: 'cust-1',
  location: { type: 'coordinates', coordinates: { latitude: 35, longitude: -80 } },
  schedule: {
    scheduledDate: new Date('2025-10-06T14:00:00Z'),
  },
  recurrence: 'none',
  assignment: { teamMembers: [] },
  pricing: { estimatedCost: 150 },
  tags: [],
  customFields: {},
  is_active: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'system',
  updatedBy: 'system',
};

describe('ArrivalWorkflowService factory integration', () => {
  it('uses provided repositories/services when supplied', async () => {
    const jobRepository: ArrivalWorkflowDependencies['jobRepository'] = {
      findById: jest.fn().mockResolvedValue(baseJob as any),
      updateJob: jest.fn().mockResolvedValue({ ...baseJob, status: JobStatus.IN_PROGRESS } as any),
    };

    const timeEntry = {
      entryId: 'entry-factory',
      clockInTime: new Date('2025-10-06T14:05:00Z').toISOString(),
      source: 'geofence',
    };

    const service = createArrivalWorkflowService({
      jobRepository,
      timeTrackingService: {
        clockIn: jest.fn().mockResolvedValue(timeEntry),
      } as any,
      safetyVerificationService: undefined,
      notificationClient: {
        notifyArrival: jest.fn().mockResolvedValue({ id: 'notif-2', channel: 'push' }),
      },
      now: () => new Date('2025-10-06T14:05:00Z'),
    });

    const result = await service.processArrival({
      jobId: 'job-55',
      location: { latitude: 35.1, longitude: -80.1 },
      context: { tenantId: 'tenant-1', userId: 'user-9', notifyCustomer: true },
    });

    expect(result.job.status).toBe(JobStatus.IN_PROGRESS);
    expect(result.timeEntry.entryId).toBe('entry-factory');
    expect(result.notifications?.[0]?.id).toBe('notif-2');
    expect(jobRepository.updateJob).toHaveBeenCalled();
  });
});
