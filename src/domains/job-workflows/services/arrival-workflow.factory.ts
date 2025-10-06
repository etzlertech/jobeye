/**
 * @file src/domains/job-workflows/services/arrival-workflow.factory.ts
 * @phase 3
 * @domain job-workflows
 * @purpose Factory helpers for ArrivalWorkflowService wiring job, time-tracking, safety, and notification dependencies.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T077
 * @complexity_budget 200 LoC
 * @dependencies
 *   internal:
 *     - @/domains/job/repositories/job-repository
 *     - @/domains/time-tracking/services/time-tracking.factory
 *     - @/domains/safety/services/safety-verification.factory
 *     - ./arrival-workflow.service
 *     - ./arrival-workflow.types
 * @exports
 *   - createArrivalWorkflowService
 *   - createDefaultArrivalDependencies
 * @voice_considerations
 *   - Warns when optional services (safety/notifications) are unavailable so voice workflows can inform technicians.
 * END AGENT DIRECTIVE BLOCK
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { JobRepository } from '@/domains/job/repositories/job-repository';
import { createTimeTrackingService, createDefaultTimeTrackingDependencies } from '@/domains/time-tracking/services/time-tracking.factory';
import { createSafetyVerificationService, createDefaultSafetyVerificationDependencies } from '@/domains/safety/services/safety-verification.factory';
import { voiceLogger } from '@/core/logger/voice-logger';
import type { ArrivalWorkflowDependencies } from './arrival-workflow.types';
import { ArrivalWorkflowService } from './arrival-workflow.service';

export interface ArrivalWorkflowFactoryOptions {
  supabaseClient?: SupabaseClient;
  jobRepository?: ArrivalWorkflowDependencies["jobRepository"];
  timeTrackingService?: ArrivalWorkflowDependencies["timeTrackingService"];
  safetyVerificationService?: ArrivalWorkflowDependencies["safetyVerificationService"];
  notificationClient?: ArrivalWorkflowDependencies["notificationClient"];
  logger?: ArrivalWorkflowDependencies["logger"];
  now?: ArrivalWorkflowDependencies["now"];
}

export function createArrivalWorkflowService(options: ArrivalWorkflowFactoryOptions = {}): ArrivalWorkflowService {
  const deps = createDefaultArrivalDependencies(options);
  return new ArrivalWorkflowService(deps);
}

export function createDefaultArrivalDependencies(options: ArrivalWorkflowFactoryOptions = {}): ArrivalWorkflowDependencies {
  const supabase = options.supabaseClient;

  const jobRepository = options.jobRepository ?? (supabase ? new JobRepository(supabase) : createInMemoryJobRepository());

  const timeTrackingService = options.timeTrackingService ?? createTimeTrackingService({
    supabaseClient: supabase,
    logger: options.logger,
    now: options.now,
  });

  const safetyVerificationService = options.safetyVerificationService ?? createSafetyVerificationService({
    supabaseClient: supabase,
    logger: options.logger,
  });

  if (!supabase && !options.jobRepository) {
    voiceLogger.warn('ArrivalWorkflowService factory: job repository using in-memory stub. Provide Supabase client for persistence.');
  }

  if (!supabase && !options.safetyVerificationService) {
    voiceLogger.warn('ArrivalWorkflowService factory: safety verification persistence disabled. Provide Supabase client for audit logging.');
  }

  return {
    jobRepository,
    timeTrackingService,
    safetyVerificationService,
    notificationClient: options.notificationClient,
    logger: options.logger ?? voiceLogger,
    now: options.now,
  };
}

function createInMemoryJobRepository(): ArrivalWorkflowDependencies["jobRepository"] {
  let jobRecord: any = null;
  return {
    async findById(jobId: string, _tenantId: string) {
      if (jobRecord && jobRecord.id === jobId) {
        return jobRecord;
      }
      return null;
    },
    async updateJob(jobId: string, updates: Record<string, unknown>) {
      if (!jobRecord || jobRecord.id !== jobId) {
        jobRecord = { id: jobId, ...updates };
      } else {
        jobRecord = { ...jobRecord, ...updates };
      }
      return jobRecord;
    },
  };
}
