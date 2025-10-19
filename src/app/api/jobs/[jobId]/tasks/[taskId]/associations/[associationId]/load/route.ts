/**
 * POST /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/load
 * Convenience endpoint to mark an item association as loaded
 *
 * @task T025
 * @feature 015-task-item-association
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import { createWorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/load
 * Mark an item association as loaded (workers and supervisors)
 *
 * This is a convenience endpoint that automatically:
 * - Sets status to 'loaded'
 * - Sets loaded_at to current timestamp
 * - Sets loaded_by to current user ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string; associationId: string } }
) {
  try {
    // Get request context for tenant isolation and user ID
    const context = await getRequestContext(request);

    // Validate role (workers and supervisors can mark items as loaded)
    if (!context.isWorker && !context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Worker or supervisor role required',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Verify we have a user ID
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'No user context',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Create service with service role client for write operations
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const taskRepo = new WorkflowTaskRepository(serviceSupabase);
    const associationRepo = new WorkflowTaskItemAssociationRepository(serviceSupabase);
    const service = createWorkflowTaskService(taskRepo, associationRepo);

    // Mark item as loaded
    const result = await service.markItemAsLoaded(params.associationId, user.id);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Association not found',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 404 }
        );
      }

      if (result.error.code === 'VALIDATION_ERROR') {
        return NextResponse.json(
          {
            error: 'Invalid status transition',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to mark item as loaded',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: result.value,
    });

  } catch (error) {
    console.error('[POST /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]/load] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
