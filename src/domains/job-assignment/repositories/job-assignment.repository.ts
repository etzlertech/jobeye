/**
 * Job Assignment Repository
 *
 * Data access layer for job assignments.
 * All methods accept RequestContext for tenant isolation.
 *
 * @see specs/010-job-assignment-and/data-model.md
 * @task T017
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { RequestContext } from '@/lib/auth/context';
import type {
  JobAssignment,
  JobAssignmentWithDetails,
  JobAssignmentInsert,
} from '../types';

export class JobAssignmentRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Assign crew member to job
   * Uses ON CONFLICT DO NOTHING for idempotency
   *
   * @param context Request context with tenant_id
   * @param jobId Job to assign crew to
   * @param userId Crew member to assign
   * @param assignedBy Supervisor making the assignment
   * @returns Created assignment or existing if already assigned
   */
  async assignCrewToJob(
    context: RequestContext,
    jobId: string,
    userId: string,
    assignedBy: string
  ): Promise<JobAssignment> {
    const now = new Date().toISOString();

    // Try to insert, ignore conflict if already assigned
    const { data, error } = await this.supabase
      .from('job_assignments')
      .insert({
        tenant_id: context.tenantId,
        job_id: jobId,
        user_id: userId,
        assigned_by: assignedBy,
        assigned_at: now,
      })
      .select()
      .single();

    if (error) {
      // If duplicate, fetch existing assignment
      if (error.code === '23505') {
        return this.getAssignment(context, jobId, userId);
      }
      throw error;
    }

    return this.mapFromDb(data);
  }

  /**
   * Get specific assignment
   */
  private async getAssignment(
    context: RequestContext,
    jobId: string,
    userId: string
  ): Promise<JobAssignment> {
    const { data, error } = await this.supabase
      .from('job_assignments')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Unassign crew member from job
   *
   * @param context Request context with tenant_id
   * @param jobId Job to remove crew from
   * @param userId Crew member to remove
   * @returns Removed assignment or null if not found
   */
  async unassignCrewFromJob(
    context: RequestContext,
    jobId: string,
    userId: string
  ): Promise<JobAssignment | null> {
    const { data, error } = await this.supabase
      .from('job_assignments')
      .delete()
      .eq('tenant_id', context.tenantId)
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapFromDb(data);
  }

  /**
   * Get all assignments for a job
   *
   * @param context Request context with tenant_id
   * @param jobId Job to get assignments for
   * @returns Array of assignments with user details
   */
  async getAssignmentsForJob(
    context: RequestContext,
    jobId: string
  ): Promise<JobAssignmentWithDetails[]> {
    const { data, error } = await this.supabase
      .from('job_assignments')
      .select(`
        *,
        user:users_extended!job_assignments_user_id_fkey (
          id,
          display_name,
          role
        )
      `)
      .eq('tenant_id', context.tenantId)
      .eq('job_id', jobId)
      .order('assigned_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => this.mapWithDetailsFromDb(row));
  }

  /**
   * Get all assignments for a crew member
   *
   * @param context Request context with tenant_id
   * @param userId Crew member to get assignments for
   * @returns Array of assignments with job details
   */
  async getAssignmentsForCrew(
    context: RequestContext,
    userId: string
  ): Promise<JobAssignmentWithDetails[]> {
    const { data, error } = await this.supabase
      .from('job_assignments')
      .select(`
        *,
        job:jobs!job_assignments_job_id_fkey (
          id,
          job_number,
          title,
          status,
          priority,
          scheduled_start,
          scheduled_end
        )
      `)
      .eq('tenant_id', context.tenantId)
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => this.mapWithDetailsFromDb(row));
  }

  /**
   * Get assignment history for a job (includes supervisor info)
   *
   * @param context Request context with tenant_id
   * @param jobId Job to get history for
   * @returns Array of assignments with full details
   */
  async getAssignmentHistory(
    context: RequestContext,
    jobId: string
  ): Promise<JobAssignmentWithDetails[]> {
    const { data, error } = await this.supabase
      .from('job_assignments')
      .select(`
        *,
        user:users_extended!job_assignments_user_id_fkey (
          id,
          display_name,
          role
        ),
        assigned_by_user:users_extended!job_assignments_assigned_by_fkey (
          id,
          display_name,
          role
        )
      `)
      .eq('tenant_id', context.tenantId)
      .eq('job_id', jobId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => this.mapWithDetailsFromDb(row));
  }

  /**
   * Check if user is assigned to job
   *
   * @param context Request context with tenant_id
   * @param jobId Job to check
   * @param userId User to check
   * @returns True if user is assigned
   */
  async isUserAssignedToJob(
    context: RequestContext,
    jobId: string,
    userId: string
  ): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('job_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', context.tenantId)
      .eq('job_id', jobId)
      .eq('user_id', userId);

    if (error) throw error;

    return (count || 0) > 0;
  }

  /**
   * Count assignments for a job
   *
   * @param context Request context with tenant_id
   * @param jobId Job to count assignments for
   * @returns Number of crew assigned
   */
  async countAssignmentsForJob(
    context: RequestContext,
    jobId: string
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from('job_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', context.tenantId)
      .eq('job_id', jobId);

    if (error) throw error;

    return count || 0;
  }

  /**
   * Count assignments for a crew member
   *
   * @param context Request context with tenant_id
   * @param userId Crew member to count assignments for
   * @param status Optional job status filter
   * @returns Number of jobs assigned
   */
  async countAssignmentsForCrew(
    context: RequestContext,
    userId: string,
    status?: string
  ): Promise<number> {
    let query = this.supabase
      .from('job_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', context.tenantId)
      .eq('user_id', userId);

    // If status filter provided, need to join with jobs table
    // For now, just count all assignments (optimize later if needed)

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  }

  /**
   * Map database row to domain model
   */
  private mapFromDb(data: any): JobAssignment {
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      job_id: data.job_id,
      user_id: data.user_id,
      assigned_by: data.assigned_by,
      assigned_at: data.assigned_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Map database row with relations to domain model
   */
  private mapWithDetailsFromDb(data: any): JobAssignmentWithDetails {
    const assignment = this.mapFromDb(data);

    return {
      ...assignment,
      user: data.user ? {
        id: data.user.id,
        display_name: data.user.display_name,
        role: data.user.role,
      } : undefined,
      job: data.job ? {
        id: data.job.id,
        job_number: data.job.job_number,
        title: data.job.title,
        status: data.job.status,
        scheduled_start: data.job.scheduled_start,
        scheduled_end: data.job.scheduled_end,
      } : undefined,
      assigned_by_user: data.assigned_by_user ? {
        id: data.assigned_by_user.id,
        display_name: data.assigned_by_user.display_name,
        role: data.assigned_by_user.role,
      } : undefined,
    };
  }
}
