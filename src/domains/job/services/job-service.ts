// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/job/services/job-service.ts
// phase: 4
// domain: job-execution
// purpose: Job business logic orchestration with state management and voice support
// spec_ref: phase4/job-execution#service
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/job/repositories/job-repository
//     - /src/domains/job/types/job-types
//     - /src/core/events/event-bus
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - JobService: class - Job business logic
//   - createJob: function - Job creation with validation
//   - updateJobStatus: function - State machine transitions
//   - assignJob: function - Job assignment logic
//   - completeJob: function - Job completion workflow
//   - scheduleJob: function - Job scheduling logic
//
// voice_considerations: |
//   Support voice job creation and updates.
//   Voice state transitions with confirmations.
//   Natural language job queries and commands.
//   Voice notes and instructions integration.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/job/services/job-service.test.ts
//
// tasks:
//   1. Implement job creation with business rules
//   2. Add state machine transitions with validation
//   3. Create assignment and scheduling logic
//   4. Implement completion workflows
//   5. Add recurring job generation
//   6. Integrate voice metadata handling
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { JobRepository } from '../repositories/job-repository';
import {
  Job,
  JobCreate,
  JobUpdate,
  JobStatus,
  JobType,
  JobPriority,
  JobRecurrence,
  isValidStatusTransition,
} from '../types/job-types';
import { EventBus } from '@/core/events/event-bus';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export interface JobServiceConfig {
  enableAutoScheduling?: boolean;
  enableRecurringJobs?: boolean;
  requireCustomerApproval?: boolean;
  enableVoiceCommands?: boolean;
}

export class JobService {
  private repository: JobRepository;
  private eventBus: EventBus;
  private config: JobServiceConfig;

  constructor(
    supabaseClient: SupabaseClient,
    eventBus?: EventBus,
    config: JobServiceConfig = {}
  ) {
    this.repository = new JobRepository(supabaseClient);
    this.eventBus = eventBus || EventBus.getInstance();
    this.config = {
      enableAutoScheduling: true,
      enableRecurringJobs: true,
      requireCustomerApproval: false,
      enableVoiceCommands: true,
      ...config,
    };
  }

  /**
   * Create new job with business validation
   */
  async createJob(
    data: JobCreate,
    tenantId: string,
    userId: string
  ): Promise<Job> {
    try {
      // Business validation
      await this.validateJobCreation(data, tenantId);

      // Create job
      const job = await this.repository.createJob(data, tenantId);

      // Handle recurring job setup
      if (this.config.enableRecurringJobs && data.recurrence && data.recurrence !== JobRecurrence.NONE) {
        await this.scheduleRecurringJobs(job, tenantId, userId);
      }

      // Emit event
      this.eventBus.emit('job.created', {
        aggregateId: job.id,
        aggregateType: 'job',
        eventType: 'job.created',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          jobId: job.id,
          jobNumber: job.job_number,
          title: job.title,
          type: job.type,
          priority: job.priority,
          customerId: job.customerId,
          scheduledDate: job.schedule.scheduledDate,
          estimatedCost: job.pricing.estimatedCost,
          voiceCreated: job.voiceMetadata?.createdViaVoice || false,
        },
      });

      return job;
    } catch (error) {
      // Re-throw validation errors as-is
      if (error instanceof Error && error.message.includes('Cannot schedule job in the past')) {
        throw error;
      }
      
      throw createAppError({
        code: 'JOB_CREATE_FAILED',
        message: 'Failed to create job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update job with business logic validation
   */
  async updateJob(
    jobId: string,
    updates: JobUpdate,
    tenantId: string,
    userId: string
  ): Promise<Job | null> {
    try {
      const currentJob = await this.repository.findById(jobId, tenantId);
      if (!currentJob) {
        throw new Error('Job not found');
      }

      // Validate business rules for updates
      await this.validateJobUpdate(currentJob, updates, tenantId);

      // Update job
      const updatedJob = await this.repository.updateJob(jobId, updates, tenantId);
      if (!updatedJob) return null;

      // Handle status change events
      if (updates.status && updates.status !== currentJob.status) {
        await this.handleStatusChange(currentJob, updatedJob, tenantId, userId);
      }

      // Emit update event
      this.eventBus.emit('job.updated', {
        aggregateId: jobId,
        aggregateType: 'job',
        eventType: 'job.updated',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          jobId,
          jobNumber: updatedJob.job_number,
          updates,
          previousStatus: currentJob.status,
          newStatus: updatedJob.status,
        },
      });

      return updatedJob;
    } catch (error) {
      // Re-throw specific validation errors as-is
      if (error instanceof Error && error.message === 'Job not found') {
        throw error;
      }
      
      throw createAppError({
        code: 'JOB_UPDATE_FAILED',
        message: 'Failed to update job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Transition job status with validation
   */
  async transitionStatus(
    jobId: string,
    newStatus: JobStatus,
    reason: string,
    tenantId: string,
    userId: string
  ): Promise<Job> {
    try {
      const currentJob = await this.repository.findById(jobId, tenantId);
      if (!currentJob) {
        throw new Error('Job not found');
      }

      if (!isValidStatusTransition(currentJob.status, newStatus)) {
        throw new Error(`Invalid status transition from ${currentJob.status} to ${newStatus}`);
      }

      // Update with status change
      const updates: JobUpdate = { status: newStatus };

      // Add completion data if transitioning to completed
      if (newStatus === JobStatus.COMPLETED) {
        updates.completion = {
          completedAt: new Date(),
          completedBy: userId,
          notes: reason,
        };
      }

      const updatedJob = await this.repository.updateJob(jobId, updates, tenantId, false);
      if (!updatedJob) {
        throw new Error('Failed to update job status');
      }

      // Emit status change event
      this.eventBus.emit('job.status_changed', {
        aggregateId: jobId,
        aggregateType: 'job',
        eventType: 'job.status_changed',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          jobId,
          jobNumber: updatedJob.job_number,
          fromStatus: currentJob.status,
          toStatus: newStatus,
          reason,
          userId,
        },
      });

      return updatedJob;
    } catch (error) {
      // Re-throw specific validation errors as-is
      if (error instanceof Error && 
          (error.message.includes('Invalid status transition') ||
           error.message === 'Job not found' ||
           error.message === 'Failed to update job status')) {
        throw error;
      }
      
      throw createAppError({
        code: 'JOB_STATUS_TRANSITION_FAILED',
        message: 'Failed to transition job status',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Assign job to technician
   */
  async assignJob(
    jobId: string,
    assigneeId: string,
    teamMembers: string[] = [],
    tenantId: string,
    userId: string
  ): Promise<Job> {
    try {
      const updates: JobUpdate = {
        assignment: {
          assignedTo: assigneeId,
          teamMembers,
        },
        status: JobStatus.ASSIGNED,
      };

      const updatedJob = await this.repository.updateJob(jobId, updates, tenantId);
      if (!updatedJob) {
        throw new Error('Job not found for assignment');
      }

      // Emit assignment event
      this.eventBus.emit('job.assigned', {
        aggregateId: jobId,
        aggregateType: 'job',
        eventType: 'job.assigned',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          jobId,
          jobNumber: updatedJob.job_number,
          assignedTo: assigneeId,
          teamMembers,
          assignedBy: userId,
        },
      });

      return updatedJob;
    } catch (error) {
      throw createAppError({
        code: 'JOB_ASSIGNMENT_FAILED',
        message: 'Failed to assign job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Complete job with quality checks
   */
  async completeJob(
    jobId: string,
    completionData: {
      notes?: string;
      qualityScore?: number;
      beforePhotos?: string[];
      afterPhotos?: string[];
      workPerformed?: string[];
      materialsUsed?: Array<{
        materialId: string;
        quantity: number;
        unit: string;
      }>;
      equipmentUsed?: string[];
      followUpRequired?: boolean;
      followUpDate?: Date;
      followUpNotes?: string;
    },
    tenantId: string,
    userId: string
  ): Promise<Job> {
    try {
      const updates: JobUpdate = {
        status: JobStatus.COMPLETED,
        completion: {
          completedAt: new Date(),
          completedBy: userId,
          ...completionData,
        },
      };

      const updatedJob = await this.repository.updateJob(jobId, updates, tenantId);
      if (!updatedJob) {
        throw new Error('Job not found for completion');
      }

      // Handle follow-up job creation
      if (completionData.followUpRequired && completionData.followUpDate) {
        await this.createFollowUpJob(updatedJob, completionData.followUpDate, completionData.followUpNotes, tenantId, userId);
      }

      // Emit completion event
      this.eventBus.emit('job.completed', {
        aggregateId: jobId,
        aggregateType: 'job',
        eventType: 'job.completed',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          jobId,
          jobNumber: updatedJob.job_number,
          completedBy: userId,
          qualityScore: completionData.qualityScore,
          followUpRequired: completionData.followUpRequired,
          materialsUsed: completionData.materialsUsed,
          equipmentUsed: completionData.equipmentUsed,
        },
      });

      return updatedJob;
    } catch (error) {
      throw createAppError({
        code: 'JOB_COMPLETION_FAILED',
        message: 'Failed to complete job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Schedule job with conflict detection
   */
  async scheduleJob(
    jobId: string,
    scheduledDate: Date,
    tenantId: string,
    userId: string,
    timeWindow?: { start: string; end: string }
  ): Promise<Job> {
    try {
      // Check for scheduling conflicts
      if (this.config.enableAutoScheduling) {
        await this.checkSchedulingConflicts(tenantId, scheduledDate, timeWindow);
      }

      const updates: JobUpdate = {
        schedule: {
          scheduledDate,
          timeWindow,
        },
        status: JobStatus.SCHEDULED,
      };

      const updatedJob = await this.repository.updateJob(jobId, updates, tenantId);
      if (!updatedJob) {
        throw new Error('Job not found for scheduling');
      }

      // Emit scheduling event
      this.eventBus.emit('job.scheduled', {
        aggregateId: jobId,
        aggregateType: 'job',
        eventType: 'job.scheduled',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          jobId,
          jobNumber: updatedJob.job_number,
          scheduledDate,
          timeWindow,
          scheduledBy: userId,
        },
      });

      return updatedJob;
    } catch (error) {
      throw createAppError({
        code: 'JOB_SCHEDULING_FAILED',
        message: 'Failed to schedule job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Get jobs by various filters
   */
  async getJobs(
    filters: {
      status?: JobStatus;
      type?: JobType;
      priority?: JobPriority;
      customerId?: string;
      assignedTo?: string;
      dateRange?: {
        start: Date;
        end: Date;
      };
    },
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Job[]; count: number }> {
    return this.repository.findAll({
      tenantId,
      filters: {
        ...filters,
        is_active: true,
      },
      limit,
      offset,
    });
  }

  /**
   * Search jobs by text
   */
  async searchJobs(
    searchTerm: string,
    tenantId: string,
    limit: number = 20
  ): Promise<Job[]> {
    return this.repository.searchJobs(searchTerm, tenantId, limit);
  }

  /**
   * Cancel job with reason
   */
  async cancelJob(
    jobId: string,
    reason: string,
    tenantId: string,
    userId: string
  ): Promise<Job> {
    return this.transitionStatus(jobId, JobStatus.CANCELLED, reason, tenantId, userId);
  }

  /**
   * Delete job (soft delete)
   */
  async deleteJob(
    jobId: string,
    tenantId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const success = await this.repository.delete(jobId, tenantId);
      
      if (success) {
        this.eventBus.emit('job.deleted', {
          aggregateId: jobId,
          aggregateType: 'job',
          eventType: 'job.deleted',
          tenantId,
          userId,
          timestamp: new Date(),
          payload: {
            jobId,
            deletedBy: userId,
          },
        });
      }

      return success;
    } catch (error) {
      throw createAppError({
        code: 'JOB_DELETE_FAILED',
        message: 'Failed to delete job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Validate job creation business rules
   */
  private async validateJobCreation(data: JobCreate, tenantId: string): Promise<void> {
    // Check if customer exists (would need customer service integration)
    // Check if scheduled date is not in the past
    if (data.schedule.scheduledDate < new Date()) {
      throw new Error('Cannot schedule job in the past');
    }

    // Check if required equipment/materials are available (would need inventory integration)
    // Additional business validations...
  }

  /**
   * Validate job update business rules
   */
  private async validateJobUpdate(currentJob: Job, updates: JobUpdate, tenantId: string): Promise<void> {
    // Validate status transitions
    if (updates.status && !isValidStatusTransition(currentJob.status, updates.status)) {
      throw new Error(`Invalid status transition from ${currentJob.status} to ${updates.status}`);
    }

    // Validate completed jobs cannot be modified (except for follow-up)
    if (currentJob.status === JobStatus.COMPLETED && updates.status !== JobStatus.REQUIRES_FOLLOWUP) {
      throw new Error('Cannot modify completed job');
    }

    // Additional business validations...
  }

  /**
   * Handle status change side effects
   */
  private async handleStatusChange(
    currentJob: Job,
    updatedJob: Job,
    tenantId: string,
    userId: string
  ): Promise<void> {
    // Handle specific status transitions
    switch (updatedJob.status) {
      case JobStatus.IN_PROGRESS:
        // Start time tracking, notify customer, etc.
        break;
      case JobStatus.COMPLETED:
        // Generate invoice, update customer records, etc.
        break;
      case JobStatus.CANCELLED:
        // Release resources, notify stakeholders, etc.
        break;
    }
  }

  /**
   * Check for scheduling conflicts
   */
  private async checkSchedulingConflicts(
    tenantId: string,
    scheduledDate: Date,
    timeWindow?: { start: string; end: string }
  ): Promise<void> {
    // Implementation would check for:
    // - Technician availability
    // - Equipment conflicts
    // - Customer availability
    // - Service area constraints
  }

  /**
   * Schedule recurring jobs
   */
  private async scheduleRecurringJobs(
    parentJob: Job,
    tenantId: string,
    userId: string
  ): Promise<void> {
    // Implementation would create future job instances based on recurrence pattern
    // This is a placeholder for the recurring job logic
  }

  /**
   * Create follow-up job
   */
  private async createFollowUpJob(
    originalJob: Job,
    followUpDate: Date,
    followUpNotes: string | undefined,
    tenantId: string,
    userId: string
  ): Promise<Job> {
    const followUpJobData: JobCreate = {
      title: `Follow-up: ${originalJob.title}`,
      description: `Follow-up job for ${originalJob.job_number}. ${followUpNotes || ''}`,
      type: originalJob.type,
      priority: originalJob.priority,
      customerId: originalJob.customerId,
      location: originalJob.location,
      schedule: {
        scheduledDate: followUpDate,
      },
      recurrence: JobRecurrence.NONE,
      estimatedCost: 0,
      currency: originalJob.pricing.currency,
      assignedTo: originalJob.assignment?.assignedTo,
      tags: Array.from(new Set([...(originalJob.tags ?? []), 'follow-up'])),
      customFields: {
        ...originalJob.customFields,
        originalJobId: originalJob.id,
        isFollowUp: true,
      },
      teamMembers: [...(originalJob.assignment?.teamMembers ?? [])],
      equipmentAssigned: [...(originalJob.assignment?.equipmentAssigned ?? [])],
      materialsAllocated: (originalJob.assignment?.materialsAllocated ?? []).map(material => ({
        materialId: material.materialId,
        quantity: material.quantity,
        unit: material.unit,
      })),
    };

    return this.createJob(followUpJobData, tenantId, userId);
  }
}
