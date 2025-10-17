/**
 * Job Assignment Service
 *
 * Business logic layer for job assignments.
 * Handles validation, authorization, and orchestrates repository calls.
 *
 * @see specs/010-job-assignment-and/data-model.md
 * @task T018
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { RequestContext } from '@/lib/auth/context';
import {
  AppError,
  ErrorCode,
  ErrorSeverity,
  NotFoundError,
  ValidationError
} from '@/core/errors/error-types';
import { JobAssignmentRepository } from '../repositories/job-assignment.repository';
import type {
  JobAssignment,
  JobAssignmentWithDetails,
  AssignJobRequest,
  AssignJobResponse,
  UnassignJobResponse,
  JobWithAssignment,
  CrewJobsQuery,
  CrewJobsResponse,
  AssignmentValidationResult,
} from '../types';

export class JobAssignmentService {
  private repository: JobAssignmentRepository;
  private serviceClient: SupabaseClient<Database> | null = null;

  constructor(private supabase: SupabaseClient<Database>) {
    this.repository = new JobAssignmentRepository(supabase);
  }

  /**
   * Get or create a service role client for bypassing RLS
   * Used for internal validation queries where supervisor permission is already verified
   */
  private async getServiceClient(): Promise<SupabaseClient<Database>> {
    if (!this.serviceClient) {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      this.serviceClient = createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    }
    return this.serviceClient;
  }

  /**
   * Assign crew members to a job
   * Validates business rules before creating assignments
   *
   * @param context Request context (requires supervisor role)
   * @param request Assignment request with job_id and user_ids
   * @returns Assignment response with created assignments
   */
  async assignCrewToJob(
    context: RequestContext,
    request: AssignJobRequest
  ): Promise<AssignJobResponse> {
    // Validation 1: Check supervisor permission
    if (!context.isSupervisor) {
      throw new AppError(
        'Only supervisors can assign jobs',
        ErrorCode.FORBIDDEN,
        ErrorSeverity.MEDIUM
      );
    }

    // Validation 2: Verify job exists and is assignable
    const job = await this.getJob(context, request.job_id);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Validation 3: Check job status
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new AppError(
        'Cannot assign to completed job',
        ErrorCode.INVALID_INPUT,
        ErrorSeverity.LOW
      );
    }

    // Validation 4: Verify all users are crew members
    console.log('[JobAssignmentService] About to call getUsers', { userIds: request.user_ids });
    const users = await this.getUsers(context, request.user_ids);
    console.log('[JobAssignmentService] getUsers returned:', { userCount: users.length });
    const nonCrewMembers = users.filter(u => u.role !== 'technician');
    if (nonCrewMembers.length > 0) {
      const names = nonCrewMembers.map(u => u.display_name || u.id).join(', ');
      throw new ValidationError(
        `Only crew members (technicians) can be assigned to jobs: ${names}`,
        'user_ids'
      );
    }

    // Create assignments (repository handles duplicates gracefully)
    const assignments: JobAssignment[] = [];

    for (const userId of request.user_ids) {
      try {
        const assignment = await this.repository.assignCrewToJob(
          context,
          request.job_id,
          userId,
          context.userId!
        );
        assignments.push(assignment);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw error;
      }
    }

    // Return response
    if (assignments.length === 0) {
      return {
        success: false,
        assignments: [],
        message: 'Failed to assign any crew members'
      };
    }

    const message = assignments.length === request.user_ids.length
      ? `Successfully assigned ${assignments.length} crew member${assignments.length > 1 ? 's' : ''} to job`
      : `Assigned ${assignments.length} of ${request.user_ids.length} crew members (some may have already been assigned)`;

    return {
      success: true,
      assignments,
      message,
    };
  }

  /**
   * Unassign crew member from job
   *
   * @param context Request context (requires supervisor role)
   * @param jobId Job to remove crew from
   * @param userId Crew member to remove
   * @returns Unassignment response
   */
  async unassignCrewFromJob(
    context: RequestContext,
    jobId: string,
    userId: string
  ): Promise<UnassignJobResponse> {
    // Validation 1: Check supervisor permission
    if (!context.isSupervisor) {
      throw new AppError(
        'Only supervisors can unassign jobs',
        ErrorCode.FORBIDDEN,
        ErrorSeverity.MEDIUM
      );
    }

    // Validation 2: Verify job exists
    const job = await this.getJob(context, jobId);
    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Remove assignment
    const assignment = await this.repository.unassignCrewFromJob(
      context,
      jobId,
      userId
    );

    if (!assignment) {
      throw new NotFoundError('No assignment found for this job and crew member');
    }

    return {
      success: true,
      assignment,
      message: 'Successfully removed crew member from job',
    };
  }

  /**
   * Get jobs assigned to crew member (for Crew Hub dashboard)
   *
   * @param context Request context (requires crew role)
   * @param query Query parameters (status, pagination)
   * @returns Crew jobs response with load status
   */
  async getCrewJobs(
    context: RequestContext,
    query: CrewJobsQuery = {}
  ): Promise<CrewJobsResponse> {
    // Validation 1: Check crew permission
    if (!context.isCrew && !context.isSupervisor) {
      throw new Error('Only crew members can view assigned jobs');
    }

    // Use userId from context (crew members can only view their own jobs)
    const userId = context.userId!;

    // Get assignments with job details
    const assignments = await this.repository.getAssignmentsForCrew(context, userId);

    // Filter by status if provided
    let filteredJobs = assignments.map(a => ({
      ...a.job!,
      assigned_at: a.assigned_at,
      assigned_by: a.assigned_by,
    }));

    if (query.status) {
      filteredJobs = filteredJobs.filter(j => j.status === query.status);
    }

    // Sort by scheduled_start ASC
    filteredJobs.sort((a, b) => {
      const dateA = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const dateB = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return dateA - dateB;
    });

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const totalCount = filteredJobs.length;
    const paginatedJobs = filteredJobs.slice(offset, offset + limit);

    // Enrich with load status
    const jobsWithLoadStatus = await Promise.all(
      paginatedJobs.map(job => this.enrichWithLoadStatus(context, job))
    );

    return {
      success: true,
      jobs: jobsWithLoadStatus,
      total_count: totalCount,
      has_more: offset + limit < totalCount,
    };
  }

  /**
   * Get all crew assigned to a job
   *
   * @param context Request context
   * @param jobId Job to get assignments for
   * @returns Array of assignments with user details
   */
  async getJobAssignments(
    context: RequestContext,
    jobId: string
  ): Promise<JobAssignmentWithDetails[]> {
    return this.repository.getAssignmentsForJob(context, jobId);
  }

  /**
   * Validate assignment business rules
   *
   * @param context Request context
   * @param jobId Job to assign to
   * @param userId User to assign
   * @returns Validation result with errors
   */
  async validateAssignment(
    context: RequestContext,
    jobId: string,
    userId: string
  ): Promise<AssignmentValidationResult> {
    const errors: string[] = [];

    // Rule 1: Only supervisors can assign
    if (!context.isSupervisor) {
      errors.push('Only supervisors can assign jobs');
    }

    // Rule 2: User must be a crew member
    try {
      const user = await this.getUser(context, userId);
      if (!user) {
        errors.push('User not found');
      } else if (user.role !== 'technician') {
        errors.push('Only crew members (technicians) can be assigned to jobs');
      }
    } catch (error) {
      errors.push(`Failed to verify user: ${error}`);
    }

    // Rule 3: Job must exist and be in assignable state
    try {
      const job = await this.getJob(context, jobId);
      if (!job) {
        errors.push('Job not found');
      } else if (job.status === 'completed' || job.status === 'cancelled') {
        errors.push('Cannot assign crew to completed or cancelled jobs');
      }
    } catch (error) {
      errors.push(`Failed to verify job: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ===== Private Helper Methods =====

  /**
   * Get job by ID (tenant-scoped)
   */
  private async getJob(context: RequestContext, jobId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('jobs')
      .select('id, job_number, status, title, scheduled_start, scheduled_end')
      .eq('tenant_id', context.tenantId)
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Get user by ID (tenant-scoped)
   * Uses service role client to bypass RLS (supervisor permission already verified)
   */
  private async getUser(context: RequestContext, userId: string): Promise<any> {
    const serviceClient = await this.getServiceClient();
    const { data, error} = await serviceClient
      .from('users_extended')
      .select('id, display_name, role')
      .eq('tenant_id', context.tenantId)
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Get multiple users by IDs (tenant-scoped)
   * Uses service role client to bypass RLS (supervisor permission already verified)
   */
  private async getUsers(context: RequestContext, userIds: string[]): Promise<any[]> {
    console.log('[JobAssignmentService.getUsers] Starting query', {
      tenantId: context.tenantId,
      userIds
    });

    const serviceClient = await this.getServiceClient();
    console.log('[JobAssignmentService.getUsers] Got service client');

    const { data, error } = await serviceClient
      .from('users_extended')
      .select('id, display_name, role')
      .eq('tenant_id', context.tenantId)
      .in('id', userIds);

    console.log('[JobAssignmentService.getUsers] Query completed', {
      hasError: !!error,
      dataCount: data?.length || 0,
      error: error ? { code: error.code, message: error.message } : null
    });

    if (error) throw error;

    return data || [];
  }

  /**
   * Enrich job with load status from checklist items
   */
  private async enrichWithLoadStatus(
    context: RequestContext,
    job: any
  ): Promise<JobWithAssignment> {
    // Query checklist items for this job
    type ChecklistItemRow = Pick<Database['public']['Tables']['job_checklist_items']['Row'], 'quantity'>;
    const { data: items, error } = await this.supabase
      .from('job_checklist_items')
      .select('quantity')
      .eq('job_id', job.id);

    if (error) {
      console.error('Failed to fetch checklist items:', error);
    }

    // Calculate total items (loaded tracking not yet implemented)
    const checklistItems = (items || []) as ChecklistItemRow[];
    const totalItems = checklistItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    return {
      ...job,
      total_items: totalItems,
      loaded_items: 0, // TODO: Implement loaded tracking in future feature
      load_percentage: 0,
    };
  }
}
