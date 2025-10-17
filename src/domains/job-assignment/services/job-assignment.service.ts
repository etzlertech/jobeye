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

  constructor(private supabase: SupabaseClient<Database>) {
    this.repository = new JobAssignmentRepository(supabase);
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
      throw new Error('Only supervisors can assign jobs');
    }

    // Validation 2: Verify job exists and is assignable
    const job = await this.getJob(context, request.job_id);
    if (!job) {
      throw new Error('Job not found');
    }

    // Validation 3: Check job status
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new Error('Cannot assign crew to completed or cancelled jobs');
    }

    // Validation 4: Verify all users are crew members
    const users = await this.getUsers(context, request.user_ids);
    const nonCrewMembers = users.filter(u => u.role !== 'technician');
    if (nonCrewMembers.length > 0) {
      const names = nonCrewMembers.map(u => u.display_name || u.id).join(', ');
      throw new Error(\`Only crew members (technicians) can be assigned to jobs: \${names}\`);
    }

    // Create assignments (repository handles duplicates gracefully)
    const assignments: JobAssignment[] = [];
    const errors: string[] = [];

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
        errors.push(\`Failed to assign user \${userId}: \${error}\`);
      }
    }

    // Return response
    if (assignments.length === 0) {
      return {
        success: false,
        assignments: [],
        message: \`Failed to assign any crew members: \${errors.join('; ')}\`,
      };
    }

    const message = assignments.length === request.user_ids.length
      ? \`Successfully assigned \${assignments.length} crew member\${assignments.length > 1 ? 's' : ''}\`
      : \`Assigned \${assignments.length} of \${request.user_ids.length} crew members (some may have already been assigned)\`;

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
      throw new Error('Only supervisors can unassign jobs');
    }

    // Validation 2: Verify job exists
    const job = await this.getJob(context, jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Remove assignment
    const assignment = await this.repository.unassignCrewFromJob(
      context,
      jobId,
      userId
    );

    if (!assignment) {
      return {
        success: false,
        assignment: null,
        message: 'Assignment not found',
      };
    }

    return {
      success: true,
      assignment,
      message: 'Crew member successfully unassigned',
    };
  }

  /**
   * Get jobs assigned to crew member (for Crew Hub dashboard)
   *
   * @param context Request context (requires crew role)
   * @param userId Crew member to get jobs for
   * @param query Query parameters (status, pagination)
   * @returns Crew jobs response with load status
   */
  async getCrewJobs(
    context: RequestContext,
    userId: string,
    query: CrewJobsQuery = {}
  ): Promise<CrewJobsResponse> {
    // Validation 1: Check crew permission (or allow supervisor to view any crew's jobs)
    if (!context.isCrew && !context.isSupervisor) {
      throw new Error('Only crew members can view assigned jobs');
    }

    // Validation 2: Crew can only view their own jobs (unless supervisor)
    if (context.isCrew && userId !== context.userId) {
      throw new Error('Crew members can only view their own jobs');
    }

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
      errors.push(\`Failed to verify user: \${error}\`);
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
      errors.push(\`Failed to verify job: \${error}\`);
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
   */
  private async getUser(context: RequestContext, userId: string): Promise<any> {
    const { data, error} = await this.supabase
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
   */
  private async getUsers(context: RequestContext, userIds: string[]): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('users_extended')
      .select('id, display_name, role')
      .eq('tenant_id', context.tenantId)
      .in('id', userIds);

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
    const { data: items, error } = await this.supabase
      .from('job_checklist_items')
      .select('quantity, loaded_quantity')
      .eq('tenant_id', context.tenantId)
      .eq('job_id', job.id);

    if (error) {
      console.error('Failed to fetch checklist items:', error);
    }

    // Calculate load status
    const totalItems = (items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    const loadedItems = (items || []).reduce((sum, item) => sum + (item.loaded_quantity || 0), 0);
    const loadPercentage = totalItems > 0 ? Math.round((loadedItems / totalItems) * 100) : 0;

    return {
      ...job,
      total_items: totalItems,
      loaded_items: loadedItems,
      load_percentage: loadPercentage,
    };
  }
}
