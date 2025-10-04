/**
 * @file src/__tests__/job-workflows/arrival-workflow.service.test.ts
 * @description Unit tests for ArrivalWorkflowService covering success and failure scenarios.
 * END AGENT DIRECTIVE BLOCK
 */

import { ArrivalWorkflowService } from '@/domains/job-workflows/services/arrival-workflow.service';
import type {
  ArrivalWorkflowDependencies,
  ArrivalWorkflowRequest,
} from '@/domains/job-workflows/services/arrival-workflow.types';
import { JobStatus } from '@/domains/job/types/job-types';

const baseJob = {
  id: 'job-1',
  tenant_id: 'tenant-1',
  job_number: 'J-100',
  title: 'Install Harness',
  description: 'Install safety harness',
  type: 'other',
  priority: 'normal',
  status: JobStatus.SCHEDULED,
  customerId: 'cust-1',
  location: { type: 'coordinates', coordinates: { latitude: 35, longitude: -80 } },
  schedule: {
    scheduledDate: new Date('2025-10-06T12:00:00Z'),
  },
  recurrence: 'none',
  assignment: { teamMembers: [] },
  pricing: { estimatedCost: 100 },
  tags: [],
  customFields: {},
  is_active: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'system',
  updatedBy: 'system',
};

const location = { latitude: 35.0, longitude: -80.0 };
const context = { tenantId: 'tenant-1', userId: 'user-1' };

const createService = (
  override: Partial<ArrivalWorkflowDependencies> = {}
) => {
  const jobRepository = {
    findById: jest.fn().mockResolvedValue(baseJob),
    updateJob: jest.fn().mockResolvedValue({ ...baseJob, status: JobStatus.IN_PROGRESS }),
  };

  const timeTrackingService = {
    clockIn: jest.fn().mockResolvedValue({
      entryId: 'entry-1',
      clockInTime: new Date('2025-10-06T12:01:00Z').toISOString(),
      source: 'geofence',
    }),
  };

  const deps: ArrivalWorkflowDependencies = {
    jobRepository: jobRepository as any,
    timeTrackingService: timeTrackingService as any,
    safetyVerificationService: {
      verifyPhoto: jest.fn().mockResolvedValue({
        verified: true,
        confidence: 0.9,
        matchedLabels: ['harness'],
        missingLabels: [],
        fallbackUsed: false,
        detectedSamples: [],
        analyzedAt: new Date('2025-10-06T12:01:00Z').toISOString(),
      }),
    },
    notificationClient: {
      notifyArrival: jest.fn().mockResolvedValue({ id: 'notif-1', channel: 'push' }),
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    now: () => new Date('2025-10-06T12:01:00Z'),
    ...override,
  } as ArrivalWorkflowDependencies;

  return {
    service: new ArrivalWorkflowService(deps),
    deps,
  };
};

describe('ArrivalWorkflowService', () => {
  it('processArrival orchestrates safety verification, time tracking, and notifications', async () => {
    const { service, deps } = createService();

    const result = await service.processArrival({
      jobId: 'job-1',
      location,
      arrivalPhoto: new Blob(['photo']),
      checklistItem: {
        id: 'helmet',
        label: 'Helmet',
        requiredLabels: ['helmet'],
      },
      context: { ...context, notifyCustomer: true },
    });

    expect(result.job.status).toBe(JobStatus.IN_PROGRESS);
    expect(result.timeEntry.entryId).toBe('entry-1');
    expect(result.safetyVerification?.verified).toBe(true);
    expect(result.notifications?.[0]?.id).toBe('notif-1');
    expect(deps.jobRepository.updateJob).toHaveBeenCalled();
    expect(deps.timeTrackingService.clockIn).toHaveBeenCalled();
  });

  it('throws when job is not found', async () => {
    const { service, deps } = createService();
    (deps.jobRepository.findById as jest.Mock).mockResolvedValue(null);

    await expect(
      service.processArrival({ jobId: 'missing', location, context })
    ).rejects.toThrow('Job not found for arrival workflow');
  });
});
