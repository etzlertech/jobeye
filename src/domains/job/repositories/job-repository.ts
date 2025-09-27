// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/job/repositories/job-repository.ts
// phase: 4
// domain: job-execution
// purpose: Job data access with multi-tenant isolation and state management
// spec_ref: phase4/job-execution#repository
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/job/types/job-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - JobRepository: class - Job data access
//   - createJob: function - Create new job
//   - updateJob: function - Update job with state validation
//   - findJobsByStatus: function - Filter by job status
//   - findJobsByCustomer: function - Customer-specific queries
//   - findJobsByDateRange: function - Scheduling queries
//   - findJobsByAssignee: function - Assignment-based queries
//
// voice_considerations: |
//   Support voice-driven job queries and updates.
//   Store voice metadata with job records.
//   Enable natural language job searches.
//   Track voice-confirmed job state changes.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/job/repositories/job-repository.test.ts
//
// tasks:
//   1. Extend BaseRepository for jobs
//   2. Implement CRUD with tenant isolation
//   3. Add status and date filtering
//   4. Create assignment and customer queries
//   5. Implement recurring job management
//   6. Add voice metadata handling
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  Job,
  JobCreate,
  JobUpdate,
  JobStatus,
  JobType,
  JobPriority,
  JobRecurrence,
  jobCreateSchema,
  jobUpdateSchema,
  isValidStatusTransition,
} from '../types/job-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export class JobRepository extends BaseRepository<'jobs'> {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    super('jobs', supabaseClient);
    this.supabaseClient = supabaseClient;
  }

  /**
   * Create new job with tenant isolation
   */
  async createJob(data: JobCreate, tenantId: string): Promise<Job> {
    try {
      // Validate input
      const validated = jobCreateSchema.parse(data);

      // Generate job number
      const jobNumber = await this.generateJobNumber(tenantId);

      const job = {
        job_number: jobNumber,
        tenant_id: tenantId,
        title: validated.title,
        description: validated.description,
        type: validated.type,
        priority: validated.priority,
        status: JobStatus.DRAFT,
        customer_id: validated.customerId,
        location: validated.location,
        schedule: {
          scheduledDate: validated.schedule.scheduledDate.toISOString(),
          estimatedStartTime: validated.schedule.estimatedStartTime,
          estimatedDuration: validated.schedule.estimatedDuration,
          timeWindow: validated.schedule.timeWindow,
        },
        recurrence: validated.recurrence,
        parent_job_id: validated.parentJobId,
        assignment: {
          assignedTo: validated.assignedTo,
          teamMembers: validated.teamMembers,
          equipmentAssigned: validated.equipmentAssigned,
          materialsAllocated: validated.materialsAllocated,
        },
        pricing: {
          estimatedCost: validated.estimatedCost,
          quotedPrice: validated.quotedPrice,
          currency: validated.currency,
        },
        tags: validated.tags,
        custom_fields: validated.customFields,
        template_id: validated.templateId,
        external_id: validated.externalId,
        voice_metadata: validated.voiceMetadata ? {
          createdViaVoice: validated.voiceMetadata.createdViaVoice,
          voiceInstructions: validated.voiceMetadata.voiceInstructions.map(vi => ({
            ...vi,
            timestamp: vi.timestamp.toISOString(),
          })),
          voiceUpdates: [],
        } : null,
        is_active: true,
      };

      const { data: created, error } = await this.supabaseClient
        .from('jobs')
        .insert(job)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapToJob(created);
    } catch (error) {
      throw createAppError({
        code: 'JOB_CREATE_FAILED',
        message: 'Failed to create job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update job with state validation
   */
  async updateJob(
    jobId: string,
    updates: JobUpdate,
    tenantId: string,
    validateStateTransition: boolean = true
  ): Promise<Job | null> {
    try {
      const validated = jobUpdateSchema.parse(updates);

      // Get current job for state validation
      if (validateStateTransition && validated.status) {
        const currentJob = await this.findById(jobId, tenantId);
        if (!currentJob) {
          throw new Error('Job not found for state validation');
        }
        
        if (!isValidStatusTransition(currentJob.status, validated.status)) {
          throw new Error(`Invalid status transition from ${currentJob.status} to ${validated.status}`);
        }
      }

      const updateData: any = {};

      if (validated.title) updateData.title = validated.title;
      if (validated.description) updateData.description = validated.description;
      if (validated.type) updateData.type = validated.type;
      if (validated.priority) updateData.priority = validated.priority;
      if (validated.status) updateData.status = validated.status;
      
      if (validated.schedule) {
        const scheduleUpdate: any = {};
        if (validated.schedule.scheduledDate) {
          scheduleUpdate.scheduledDate = validated.schedule.scheduledDate.toISOString();
        }
        if (validated.schedule.estimatedStartTime !== undefined) {
          scheduleUpdate.estimatedStartTime = validated.schedule.estimatedStartTime;
        }
        if (validated.schedule.estimatedDuration !== undefined) {
          scheduleUpdate.estimatedDuration = validated.schedule.estimatedDuration;
        }
        if (validated.schedule.timeWindow !== undefined) {
          scheduleUpdate.timeWindow = validated.schedule.timeWindow;
        }
        updateData.schedule = scheduleUpdate;
      }

      if (validated.assignment) {
        updateData.assignment = validated.assignment;
      }

      if (validated.pricing) {
        updateData.pricing = validated.pricing;
      }

      if (validated.completion) {
        const completionUpdate = {
          ...validated.completion,
          completedAt: validated.completion.completedAt?.toISOString(),
          followUpDate: validated.completion.followUpDate?.toISOString(),
        };
        updateData.completion = completionUpdate;
      }

      if (validated.tags) updateData.tags = validated.tags;
      if (validated.customFields) updateData.custom_fields = validated.customFields;
      if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

      const { data: updated, error } = await this.supabaseClient
        .from('jobs')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapToJob(updated);
    } catch (error) {
      throw createAppError({
        code: 'JOB_UPDATE_FAILED',
        message: 'Failed to update job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find job by ID with tenant isolation
   */
  async findById(jobId: string, tenantId: string): Promise<Job | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToJob(data);
    } catch (error) {
      throw createAppError({
        code: 'JOB_FETCH_FAILED',
        message: 'Failed to fetch job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all jobs with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: {
      status?: JobStatus;
      type?: JobType;
      priority?: JobPriority;
      customerId?: string;
      assignedTo?: string;
      dateRange?: {
        start: Date;
        end: Date;
      };
      is_active?: boolean;
    };
    limit?: number;
    offset?: number;
  }): Promise<{ data: Job[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from('jobs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      if (options.filters) {
        if (options.filters.status) {
          query = query.eq('status', options.filters.status);
        }
        if (options.filters.type) {
          query = query.eq('type', options.filters.type);
        }
        if (options.filters.priority) {
          query = query.eq('priority', options.filters.priority);
        }
        if (options.filters.customerId) {
          query = query.eq('customer_id', options.filters.customerId);
        }
        if (options.filters.assignedTo) {
          query = query.eq('assignment->>assignedTo', options.filters.assignedTo);
        }
        if (options.filters.dateRange) {
          query = query
            .gte('schedule->>scheduledDate', options.filters.dateRange.start.toISOString())
            .lte('schedule->>scheduledDate', options.filters.dateRange.end.toISOString());
        }
        if (options.filters.is_active !== undefined) {
          query = query.eq('is_active', options.filters.is_active);
        }
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query.order('schedule->>scheduledDate', { ascending: true });

      if (error) throw error;

      return {
        data: (data || []).map(row => this.mapToJob(row)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'JOB_FETCH_FAILED',
        message: 'Failed to fetch jobs list',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find jobs by status
   */
  async findJobsByStatus(
    status: JobStatus,
    tenantId: string,
    limit: number = 50
  ): Promise<Job[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .eq('is_active', true)
        .limit(limit)
        .order('schedule->>scheduledDate', { ascending: true });

      if (error) throw error;

      return (data || []).map(row => this.mapToJob(row));
    } catch (error) {
      throw createAppError({
        code: 'JOB_STATUS_SEARCH_FAILED',
        message: 'Failed to find jobs by status',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find jobs by customer
   */
  async findJobsByCustomer(
    customerId: string,
    tenantId: string,
    limit: number = 50
  ): Promise<Job[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => this.mapToJob(row));
    } catch (error) {
      throw createAppError({
        code: 'JOB_CUSTOMER_SEARCH_FAILED',
        message: 'Failed to find jobs by customer',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find jobs by assignee
   */
  async findJobsByAssignee(
    assigneeId: string,
    tenantId: string,
    status?: JobStatus,
    limit: number = 50
  ): Promise<Job[]> {
    try {
      let query = this.supabaseClient
        .from('jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assignment->>assignedTo', assigneeId)
        .eq('is_active', true);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query
        .limit(limit)
        .order('schedule->>scheduledDate', { ascending: true });

      if (error) throw error;

      return (data || []).map(row => this.mapToJob(row));
    } catch (error) {
      throw createAppError({
        code: 'JOB_ASSIGNEE_SEARCH_FAILED',
        message: 'Failed to find jobs by assignee',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find jobs by date range
   */
  async findJobsByDateRange(
    startDate: Date,
    endDate: Date,
    tenantId: string,
    status?: JobStatus
  ): Promise<Job[]> {
    try {
      let query = this.supabaseClient
        .from('jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('schedule->>scheduledDate', startDate.toISOString())
        .lte('schedule->>scheduledDate', endDate.toISOString())
        .eq('is_active', true);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('schedule->>scheduledDate', { ascending: true });

      if (error) throw error;

      return (data || []).map(row => this.mapToJob(row));
    } catch (error) {
      throw createAppError({
        code: 'JOB_DATE_SEARCH_FAILED',
        message: 'Failed to find jobs by date range',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search jobs by title or description
   */
  async searchJobs(
    searchTerm: string,
    tenantId: string,
    limit: number = 20
  ): Promise<Job[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => this.mapToJob(row));
    } catch (error) {
      throw createAppError({
        code: 'JOB_SEARCH_FAILED',
        message: 'Failed to search jobs',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Delete job (soft delete)
   */
  async delete(jobId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient
        .from('jobs')
        .update({
          is_active: false,
          status: JobStatus.CANCELLED,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw createAppError({
        code: 'JOB_DELETE_FAILED',
        message: 'Failed to delete job',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Generate unique job number
   */
  private async generateJobNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    
    // Get count of jobs created today
    const { count, error } = await this.supabaseClient
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString())
      .lt('created_at', new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString());

    if (error) throw error;

    const sequence = ((count || 0) + 1).toString().padStart(3, '0');
    return `JOB-${year}${month}${day}-${sequence}`;
  }

  /**
   * Map database row to Job type
   */
  private mapToJob(row: any): Job {
    if (!row) throw new Error('Cannot map null row to Job');

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      job_number: row.job_number,
      title: row.title,
      description: row.description,
      type: row.type as JobType,
      priority: row.priority as JobPriority,
      status: row.status as JobStatus,
      customerId: row.customer_id,
      customerName: row.customer_name,
      location: row.location,
      schedule: {
        scheduledDate: new Date(row.schedule.scheduledDate),
        estimatedStartTime: row.schedule.estimatedStartTime,
        estimatedDuration: row.schedule.estimatedDuration,
        timeWindow: row.schedule.timeWindow,
        actualStartTime: row.schedule.actualStartTime ? new Date(row.schedule.actualStartTime) : undefined,
        actualEndTime: row.schedule.actualEndTime ? new Date(row.schedule.actualEndTime) : undefined,
        actualDuration: row.schedule.actualDuration,
      },
      recurrence: row.recurrence as JobRecurrence,
      parentJobId: row.parent_job_id,
      assignment: row.assignment || {
        teamMembers: [],
        equipmentAssigned: [],
        materialsAllocated: [],
      },
      pricing: {
        estimatedCost: row.pricing?.estimatedCost || 0,
        quotedPrice: row.pricing?.quotedPrice,
        actualCost: row.pricing?.actualCost,
        finalPrice: row.pricing?.finalPrice,
        laborHours: row.pricing?.laborHours,
        laborRate: row.pricing?.laborRate,
        materialCosts: row.pricing?.materialCosts,
        equipmentCosts: row.pricing?.equipmentCosts,
        markupPercentage: row.pricing?.markupPercentage,
        taxAmount: row.pricing?.taxAmount,
        currency: row.pricing?.currency || 'USD',
      },
      completion: row.completion ? {
        ...row.completion,
        completedAt: row.completion.completedAt ? new Date(row.completion.completedAt) : undefined,
        followUpDate: row.completion.followUpDate ? new Date(row.completion.followUpDate) : undefined,
      } : undefined,
      voiceMetadata: row.voice_metadata ? {
        ...row.voice_metadata,
        voiceInstructions: (row.voice_metadata.voiceInstructions || []).map((vi: any) => ({
          ...vi,
          timestamp: new Date(vi.timestamp),
        })),
        voiceUpdates: (row.voice_metadata.voiceUpdates || []).map((vu: any) => ({
          ...vu,
          timestamp: new Date(vu.timestamp),
        })),
      } : undefined,
      tags: row.tags || [],
      customFields: row.custom_fields || {},
      templateId: row.template_id,
      externalId: row.external_id,
      is_active: row.is_active,
      version: row.version || 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}

// Convenience export
export const createJobRepository = (supabase: SupabaseClient): JobRepository => {
  return new JobRepository(supabase);
};