/**
 * @file src/domains/job-workflows/services/arrival-workflow.service.ts
 * @phase 3
 * @domain job-workflows
 * @purpose GPS arrival orchestration coordinating safety verification, time tracking, and notifications.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T077
 * @complexity_budget 300 LoC
 * @dependencies
 *   internal:
 *     - ./arrival-workflow.types
 *   external: none (dependencies injected)
 * @exports
 *   - ArrivalWorkflowService
 * @voice_considerations
 *   - Emits structured logs so voice prompts can confirm arrival status, safety verification, and clock-in results.
 * @test_requirements
 *   unit: src/__tests__/job-workflows/arrival-workflow.service.test.ts
 *   integration: src/__tests__/job-workflows/integration/arrival-workflow.integration.test.ts
 * END AGENT DIRECTIVE BLOCK
 */

import { JobStatus } from '@/domains/job/types/job-types';
import {
  ArrivalWorkflowDependencies,
  ArrivalWorkflowRequest,
  ArrivalWorkflowResult,
} from './arrival-workflow.types';

export class ArrivalWorkflowService {
  private readonly jobRepository = this.deps.jobRepository;
  private readonly timeTrackingService = this.deps.timeTrackingService;
  private readonly safetyVerificationService = this.deps.safetyVerificationService;
  private readonly notificationClient = this.deps.notificationClient;
  private readonly logger = this.deps.logger ?? console;
  private readonly now: () => Date = this.deps.now ?? (() => new Date());

  constructor(private readonly deps: ArrivalWorkflowDependencies) {
    if (!deps?.jobRepository) {
      throw new Error('ArrivalWorkflowService requires jobRepository');
    }
    if (!deps?.timeTrackingService) {
      throw new Error('ArrivalWorkflowService requires timeTrackingService');
    }
  }

  async processArrival(request: ArrivalWorkflowRequest): Promise<ArrivalWorkflowResult> {
    const { jobId, location, context } = request;
    const { tenantId, userId } = context;

    const job = await this.jobRepository.findById(jobId, tenantId);
    if (!job) {
      throw new Error('Job not found for arrival workflow');
    }

    let safetyResult;
    if (request.arrivalPhoto && request.checklistItem && this.safetyVerificationService) {
      safetyResult = await this.safetyVerificationService.verifyPhoto(
        request.arrivalPhoto,
        request.checklistItem,
        {
          tenantId,
          jobId,
          checklistItemId: request.checklistItem.id,
          performedByUserId: userId,
        }
      );

      if (!safetyResult.verified) {
        this.logger.warn('Safety verification failed during arrival workflow', {
          jobId,
          missingLabels: safetyResult.missingLabels,
        });
      }
    }

    const timeEntry = await this.timeTrackingService.clockIn(userId, location, {
      context: {
        tenantId,
        jobId,
        routeId: context.routeId,
      },
      source: 'geofence',
    });

    const updatedJob =
      (await this.jobRepository.updateJob(
        jobId,
        {
          status: JobStatus.IN_PROGRESS,
          schedule: {
            scheduledDate: job.schedule.scheduledDate,
          },
        },
        tenantId,
        false
      )) ?? job;

    const notifications: ArrivalWorkflowResult["notifications"] = [];
    if (context.notifyCustomer && this.notificationClient) {
      const notification = await this.notificationClient.notifyArrival({
        tenantId,
        jobId,
        userId,
        message: 'Technician ' + userId + ' arrived onsite at ' + this.now().toISOString(),
      });
      if (notification) {
        notifications?.push(notification);
      }
    }

    this.logger.info('Arrival workflow completed', {
      jobId,
      timeEntryId: timeEntry.entryId,
      tenantId,
      userId,
    });

    return {
      job: updatedJob,
      timeEntry,
      safetyVerification: safetyResult,
      notifications: notifications?.length ? notifications : undefined,
    };
  }
}