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
        { error: 'Forbidden', message: 'Only supervisors can unassign jobs' },
        { status: 403 }
      );
    }

    // Get user_id from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'user_id query parameter is required' },
        { status: 400 }
      );
    }

    // Create service and execute unassignment
    const supabase = await createClient();
    const service = new JobAssignmentService(supabase);

    const response = await service.unassignCrewFromJob(
      context,
      params.jobId,
      userId
    );

    // Return 404 if assignment not found
    if (!response.success) {
      return NextResponse.json(
        { error: 'Not Found', message: response.message },
        { status: 404 }
      );
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[DELETE /api/jobs/[jobId]/unassign] Error:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Not Found', message: error.message },
          { status: 404 }
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
