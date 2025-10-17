/**
 * Job Assignment Domain Types
 * Central export for all job assignment types
 */

export type {
  JobAssignment,
  JobAssignmentRow,
  JobAssignmentInsert,
  JobAssignmentUpdate,
  JobAssignmentWithDetails,
  AssignJobRequest,
  AssignJobResponse,
  UnassignJobRequest,
  UnassignJobResponse,
  JobWithAssignment,
  CrewJobsQuery,
  CrewJobsResponse,
  UserProfile,
  JobMinimal,
  ValidationError,
  ApiErrorResponse,
  AssignmentValidationResult,
} from './job-assignment.types';
