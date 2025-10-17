/**
 * Job Assignment Types
 *
 * Domain types for job assignment feature.
 * Maps to job_assignments table in database.
 *
 * @see specs/010-job-assignment-and/data-model.md
 * @task T016
 */

import type { Database } from '@/types/database';

// Base types from database
export type JobAssignmentRow = Database['public']['Tables']['job_assignments']['Row'];
export type JobAssignmentInsert = Database['public']['Tables']['job_assignments']['Insert'];
export type JobAssignmentUpdate = Database['public']['Tables']['job_assignments']['Update'];

/**
 * Job Assignment Entity
 * Represents a crew member assigned to a job
 */
export interface JobAssignment {
  /** Unique assignment ID */
  id: string;

  /** Tenant ID for multi-tenant isolation */
  tenant_id: string;

  /** Job ID being assigned */
  job_id: string;

  /** User ID of crew member assigned */
  user_id: string;

  /** User ID of supervisor who made assignment */
  assigned_by: string | null;

  /** Timestamp when assignment was created */
  assigned_at: string | null; // ISO 8601 timestamp

  /** Standard metadata */
  created_at: string | null;
  updated_at: string | null;
}

/**
 * User Profile (minimal for assignment context)
 */
export interface UserProfile {
  id: string;
  email?: string;
  display_name?: string | null;
  role?: string;
}

/**
 * Job (minimal for assignment context)
 */
export interface JobMinimal {
  id: string;
  job_number: string;
  title?: string | null;
  status?: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
}

/**
 * Job Assignment with related entities (for API responses)
 */
export interface JobAssignmentWithDetails extends JobAssignment {
  /** Job details */
  job?: JobMinimal;

  /** Crew member profile */
  user?: UserProfile;

  /** Supervisor who made the assignment */
  assigned_by_user?: UserProfile;
}

/**
 * Assignment request payload (POST /api/jobs/[jobId]/assign)
 */
export interface AssignJobRequest {
  /** Job ID to assign crew to */
  job_id: string;

  /** Array of user IDs to assign (supports bulk assignment) */
  user_ids: string[];
}

/**
 * Assignment response (POST /api/jobs/[jobId]/assign)
 */
export interface AssignJobResponse {
  /** Operation success status */
  success: boolean;

  /** Created assignments */
  assignments: JobAssignment[];

  /** Human-readable message */
  message: string;
}

/**
 * Unassignment request payload (DELETE /api/jobs/[jobId]/unassign)
 */
export interface UnassignJobRequest {
  /** Job ID to remove crew from */
  job_id: string;

  /** User ID to unassign */
  user_id: string;
}

/**
 * Unassignment response
 */
export interface UnassignJobResponse {
  /** Operation success status */
  success: boolean;

  /** Removed assignment */
  assignment: JobAssignment | null;

  /** Human-readable message */
  message: string;
}

/**
 * Job with assignment details (for Crew Hub API)
 * Extends base Job with assignment metadata
 */
export interface JobWithAssignment {
  /** Job details */
  id: string;
  tenant_id: string;
  job_number: string;
  customer_id?: string | null;
  property_id?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string;
  priority?: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;

  /** Assignment metadata */
  assigned_at: string | null;  // When crew member was assigned
  assigned_by: string | null;  // Who assigned the crew member
  assigned_by_user?: UserProfile; // Supervisor profile

  /** Load progress */
  total_items?: number;
  loaded_items?: number;
  load_percentage?: number;
}

/**
 * Crew jobs query parameters (GET /api/crew/jobs)
 */
export interface CrewJobsQuery {
  /** Filter by job status */
  status?: string;

  /** Pagination limit */
  limit?: number;

  /** Pagination offset */
  offset?: number;
}

/**
 * Crew jobs response
 */
export interface CrewJobsResponse {
  /** Success status */
  success: boolean;

  /** Array of jobs with assignment details */
  jobs: JobWithAssignment[];

  /** Total count (for pagination) */
  total_count: number;

  /** Whether there are more results */
  has_more: boolean;
}

/**
 * Validation error response
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  status: number;
  validation_errors?: ValidationError[];
}

/**
 * Assignment validation result
 */
export interface AssignmentValidationResult {
  valid: boolean;
  errors: string[];
}
