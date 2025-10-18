/**
 * POST /api/jobs/[jobId]/assign
 * Assign crew members to a job
 *
 * @task T020
 * @feature 010-job-assignment-and
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { JobAssignmentService } from '@/domains/job-assignment/services/job-assignment.service';
import type { AssignJobRequest } from '@/domains/job-assignment/types';
import {
  NotFoundError,
  ValidationError,
  AppError,
  ErrorCode
} from '@/core/errors/error-types';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // CRITICAL: Get request context first
    const context = await getRequestContext(request);

    // Validate supervisor role
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can assign jobs',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const userIds = body.user_ids || body.userIds; // Support both formats

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          message: 'user_ids must be a non-empty array',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    const invalidIds = userIds.filter(id => typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid user ID format',
          message: 'user_ids must be valid UUIDs',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

    // Build request object
    const assignRequest: AssignJobRequest = {
      job_id: params.jobId,
      user_ids: userIds,
    };

    // Create service with service role client for write operations
    // The supervisor permission check was already done above via context.isSupervisor
    const {createClient: createServiceClient} = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    const service = new JobAssignmentService(supabase);

    console.log('[POST /api/jobs/[jobId]/assign] About to call service.assignCrewToJob', {
      jobId: params.jobId,
      userIds: userIds,
      supervisorId: context.userId
    });

    const response = await service.assignCrewToJob(context, assignRequest);

    console.log('[POST /api/jobs/[jobId]/assign] Service returned successfully:', {
      success: response.success,
      assignmentCount: response.assignments.length
    });

    // Return appropriate status code
    const statusCode = response.success ? 200 : 400;

    return NextResponse.json(
      {
        success: response.success,
        assignments: response.assignments,
        message: response.message,
        crew_limit_violations: response.crew_limit_violations ?? []
      },
      { status: statusCode }
    );

  } catch (error) {
    console.error('[POST /api/jobs/[jobId]/assign] Error:', error);

    const mapped = mapError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

function mapError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof NotFoundError) {
    return {
      status: 404,
      body: {
        error: error.message,
        message: error.message,
        code: 'RESOURCE_NOT_FOUND'
      }
    };
  }

  if (error instanceof ValidationError) {
    if (error.message.includes('already assigned')) {
      return {
        status: 400,
        body: {
          error: 'Crew member already assigned',
          message: error.message,
          code: 'DUPLICATE_ASSIGNMENT'
        }
      };
    }

    return {
      status: 400,
      body: {
        error: 'Invalid input',
        message: error.message,
        code: 'INVALID_INPUT'
      }
    };
  }

  if (error instanceof AppError) {
    if (error.code === ErrorCode.INVALID_INPUT &&
        error.message.includes('completed')) {
      return {
        status: 422,
        body: {
          error: 'Cannot assign to completed job',
          message: error.message,
          code: 'INVALID_JOB_STATUS'
        }
      };
    }

    if (error.code === ErrorCode.FORBIDDEN || error.message.includes('Only supervisors')) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          message: error.message,
          code: 'INSUFFICIENT_PERMISSIONS'
        }
      };
    }

    return {
      status: 400,
      body: {
        error: 'Bad Request',
        message: error.message,
        code: ErrorCode[error.code] ?? 'INVALID_INPUT'
      }
    };
  }

  if (error instanceof Error) {
    // Check for Postgres errors (from database triggers/constraints)
    const pgError = error as any;
    if (pgError.code === 'P0001' || pgError.code === '23505') {
      return {
        status: 409,
        body: {
          error: 'Conflict',
          message: error.message,
          code: 'SCHEDULE_CONFLICT'
        }
      };
    }

    return {
      status: 400,
      body: {
        error: 'Bad Request',
        message: error.message,
        code: 'INVALID_INPUT'
      }
    };
  }

  return {
    status: 500,
    body: {
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR'
    }
  };
}
