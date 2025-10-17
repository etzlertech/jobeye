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
import { JobAssignmentService } from '@/domains/job-assignment/services';
import type { AssignJobRequest } from '@/domains/job-assignment/types';

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
        { error: 'Forbidden', message: 'Only supervisors can assign jobs' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const userIds = body.user_ids || body.userIds; // Support both formats

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'user_ids must be a non-empty array' },
        { status: 400 }
      );
    }

    // Build request object
    const assignRequest: AssignJobRequest = {
      job_id: params.jobId,
      user_ids: userIds,
    };

    // Create service and execute assignment
    const supabase = await createClient();
    const service = new JobAssignmentService(supabase);

    const response = await service.assignCrewToJob(context, assignRequest);

    // Return appropriate status code
    const statusCode = response.success ? 200 : 400;

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('[POST /api/jobs/[jobId]/assign] Error:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Not Found', message: error.message },
          { status: 404 }
        );
      }

      if (error.message.includes('completed') || error.message.includes('cancelled')) {
        return NextResponse.json(
          { error: 'Unprocessable Entity', message: error.message },
          { status: 422 }
        );
      }

      if (error.message.includes('Only supervisors')) {
        return NextResponse.json(
          { error: 'Forbidden', message: error.message },
          { status: 403 }
        );
      }

      // Generic bad request
      return NextResponse.json(
        { error: 'Bad Request', message: error.message },
        { status: 400 }
      );
    }

    // Unknown error
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
