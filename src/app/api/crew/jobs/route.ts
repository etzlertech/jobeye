/**
 * GET /api/crew/jobs
 * Get jobs assigned to crew member (Crew Hub dashboard)
 *
 * @task T022
 * @feature 010-job-assignment-and
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { JobAssignmentService } from '@/domains/job-assignment/services';
import type { CrewJobsQuery } from '@/domains/job-assignment/types';
import {
  AppError,
  ErrorCode
} from '@/core/errors/error-types';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Get request context first
    const context = await getRequestContext(request);

    // Validate crew role
    if (!context.isCrew) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only crew members can access this endpoint',
          code: 'INVALID_ROLE'
        },
        { status: 403 }
      );
    }

    // Parse query parameters with defaults
    const { searchParams } = new URL(request.url);
    const query: CrewJobsQuery = {
      status: searchParams.get('status') || 'scheduled', // Default to scheduled jobs
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50, // Default 50
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0, // Default 0
    };

    // Validate pagination parameters
    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (query.offset && query.offset < 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'offset must be >= 0' },
        { status: 400 }
      );
    }

    // Create service and get crew jobs
    const supabase = await createClient();
    const service = new JobAssignmentService(supabase);

    // Service will use context.userId to fetch crew's own jobs
    const response = await service.getCrewJobs(context, query);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[GET /api/crew/jobs] Error:', error);

    const mapped = mapError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

function mapError(error: unknown): { status: number; body: Record<string, unknown> } {
  // Handle auth/context errors as 401
  if (error instanceof Error) {
    if (error.message.includes('No auth') || error.message.includes('not authenticated')) {
      return {
        status: 401,
        body: {
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'UNAUTHORIZED'
        }
      };
    }

    if (error.message.includes('Only crew members')) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          message: error.message,
          code: 'INVALID_ROLE'
        }
      };
    }

    if (error.message.includes('can only view their own')) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          message: error.message,
          code: 'INVALID_ROLE'
        }
      };
    }
  }

  if (error instanceof AppError) {
    if (error.code === ErrorCode.FORBIDDEN) {
      return {
        status: 403,
        body: {
          error: 'Forbidden',
          message: error.message,
          code: 'INVALID_ROLE'
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
