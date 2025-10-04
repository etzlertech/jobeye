/**
 * @file src/domains/job-workflows/services/arrival-workflow.types.ts
 * @phase 3
 * @domain job-workflows
 * @purpose Shared types and dependency contracts for ArrivalWorkflowService.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T077
 * @complexity_budget 200 LoC
 * @dependencies []
 * @exports
 *   - ArrivalWorkflowRequest
 *   - ArrivalWorkflowResult
 *   - ArrivalWorkflowDependencies
 *   - ArrivalNotificationClient
 *   - ArrivalWorkflowContext
 * @voice_considerations
 *   - Types surface verification status and arrival confirmations for voice prompts.
 * END AGENT DIRECTIVE BLOCK
 */

import type { Job } from '@/domains/job/types/job-types';
import type { LocationPoint } from '@/domains/time-tracking/services/time-tracking.types';
import type {
  SafetyChecklistItem,
  SafetyVerificationResult,
} from '@/domains/safety/services/safety-verification.types';
import type {
  ClockInResponse,
} from '@/domains/time-tracking/services/time-tracking.types';

export interface ArrivalWorkflowContext {
  tenantId: string;
  userId: string;
  routeId?: string;
  notifyCustomer?: boolean;
}

export interface ArrivalWorkflowRequest {
  jobId: string;
  location: LocationPoint;
  arrivalPhoto?: Blob | null;
  checklistItem?: SafetyChecklistItem;
  context: ArrivalWorkflowContext;
}

export interface ArrivalWorkflowResult {
  job: Job;
  timeEntry: ClockInResponse;
  safetyVerification?: SafetyVerificationResult;
  notifications?: Array<{ id: string; channel: string }>;
}

export interface ArrivalNotificationClient {
  notifyArrival(payload: {
    tenantId: string;
    jobId: string;
    userId: string;
    message: string;
  }): Promise<{ id: string; channel: string } | null>;
}

export interface ArrivalWorkflowDependencies {
  jobRepository: {
    findById(jobId: string, tenantId: string): Promise<Job | null>;
    updateJob(
      jobId: string,
      updates: Partial<{ status: Job['status']; schedule: Partial<Job['schedule']> }> & Record<string, unknown>,
      tenantId: string,
      validateStateTransition?: boolean
    ): Promise<Job | null>;
  };
  timeTrackingService: {
    clockIn(
      userId: string,
      location: LocationPoint,
      options: {
        context: { tenantId: string; jobId?: string; routeId?: string };
        source?: 'manual' | 'voice_command' | 'geofence' | 'auto_detected';
        metadata?: Record<string, unknown>;
      }
    ): Promise<ClockInResponse>;
  };
  safetyVerificationService?: {
    verifyPhoto(
      photo: Blob,
      checklistItem: SafetyChecklistItem,
      context?: { tenantId?: string; jobId?: string; checklistItemId?: string; performedByUserId?: string }
    ): Promise<SafetyVerificationResult>;
  };
  notificationClient?: ArrivalNotificationClient;
  logger?: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
  now?: () => Date;
}
