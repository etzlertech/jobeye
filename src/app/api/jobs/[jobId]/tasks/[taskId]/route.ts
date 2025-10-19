/**
 * PATCH/DELETE /api/jobs/[jobId]/tasks/[taskId]
 * Update or delete individual workflow tasks
 *
 * @task T018
 * @feature 011-making-task-lists
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import { createWorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import { UpdateTaskSchema } from '@/domains/workflow-task/types/workflow-task-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PATCH /api/jobs/[jobId]/tasks/[taskId]
 * Update a task (mark complete, update status, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Parse request body
    const body = await request.json();

    // Validate input with Zod
    try {
      UpdateTaskSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid task update data',
            code: 'VALIDATION_ERROR',
            details: err.errors,
          },
          { status: 400 }
        );
      }
      throw err;
    }

    // Create service with service role client for write operations
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const repo = new WorkflowTaskRepository(supabase);
    const associationRepo = new WorkflowTaskItemAssociationRepository(supabase);

    // Check if this is a task completion request
    if (body.status === 'complete') {
      const service = createWorkflowTaskService(repo, associationRepo);

      // Extract verification data if present
      const verificationData = body.verification_photo_url ? {
        photoUrl: body.verification_photo_url,
        aiConfidence: body.ai_confidence,
        verificationMethod: body.verification_method,
        verificationData: body.verification_data,
      } : undefined;

      const result = await service.completeTask(params.taskId, context.userId, verificationData);

      if (!result.ok) {
        if (result.error.code === 'PHOTO_VERIFICATION_REQUIRED') {
          return NextResponse.json(
            {
              error: 'Photo verification required',
              message: result.error.message,
              code: result.error.code,
            },
            { status: 400 }
          );
        }

        if (result.error.code === 'TASK_NOT_FOUND') {
          return NextResponse.json(
            {
              error: 'Task not found',
              message: result.error.message,
              code: result.error.code,
            },
            { status: 404 }
          );
        }

        return NextResponse.json(
          {
            error: 'Failed to complete task',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        task: result.value,
        message: 'Task completed successfully',
      });
    }

    // Regular update (not completion)
    const result = await repo.update(params.taskId, body);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Task not found',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 404 }
        );
      }

      if (result.error.code === 'VALIDATION_ERROR') {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: result.error.message,
            code: result.error.code,
            details: result.error.details,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to update task',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      task: result.value,
      message: 'Task updated successfully',
    });

  } catch (error) {
    console.error('[PATCH /api/jobs/[jobId]/tasks/[taskId]] Error:', error);
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

/**
 * DELETE /api/jobs/[jobId]/tasks/[taskId]
 * Soft delete a task (only supervisors)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can delete tasks)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can delete tasks',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Create service with service role client for write operations
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const repo = new WorkflowTaskRepository(supabase);
    const result = await repo.softDelete(params.taskId);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Failed to delete task',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Task deleted successfully',
    });

  } catch (error) {
    console.error('[DELETE /api/jobs/[jobId]/tasks/[taskId]] Error:', error);
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
