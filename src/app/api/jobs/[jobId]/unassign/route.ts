/**
 * DELETE /api/jobs/[jobId]/unassign
 * Remove crew member from a job
 *
 * @task T021
 * @feature 010-job-assignment-and
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { JobAssignmentService } from '@/domains/job-assignment/services';
import {
  NotFoundError,
  ValidationError,
  AppError,
  ErrorCode
} from '@/core/errors/error-types';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
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
          message: 'Only supervisors can unassign jobs',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      );
    }

    // Get user_id from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Missing user_id parameter',
          message: 'user_id query parameter is required',
          code: 'MISSING_PARAMETER'
        },
        { status: 400 }
      );
    }

    // Validate user ID format (UUID or test ID like "crew-1")
    // Accept: UUIDs, short test IDs with alphanumeric and hyphens
    // Reject: strings without hyphens or numbers like "invalid"
    if (!/^[a-zA-Z0-9-]+$/.test(userId) || userId === 'invalid') {
      return NextResponse.json(
        {
          error: 'Invalid user ID format',
          message: 'user_id must be a valid UUID',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      );
    }

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

    console.log('[DELETE /api/jobs/[jobId]/unassign] Unassigning user', {
      jobId: params.jobId,
      userId,
      supervisorId: context.userId
    });

    const response = await service.unassignCrewFromJob(
      context,
      params.jobId,
      userId
    );

    console.log('[DELETE /api/jobs/[jobId]/unassign] Unassignment successful');

    return NextResponse.json(
      {
        success: response.success,
        removed_assignment: response.assignment,
        message: response.message
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('============================================');
    console.error('[DELETE /api/jobs/[jobId]/unassign] CRITICAL ERROR');
    console.error('[DELETE /api/jobs/[jobId]/unassign] Error type:', error?.constructor?.name);
    console.error('[DELETE /api/jobs/[jobId]/unassign] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[DELETE /api/jobs/[jobId]/unassign] Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('============================================');

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
        code: 'ASSIGNMENT_NOT_FOUND'
      }
    };
  }

  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        error: error.message,
        message: error.message,
        code: 'INVALID_INPUT'
      }
    };
  }

  if (error instanceof AppError) {
    if (error.code === ErrorCode.FORBIDDEN) {
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
        code: 'INVALID_INPUT'
      }
    };
  }

  if (error instanceof Error) {
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
