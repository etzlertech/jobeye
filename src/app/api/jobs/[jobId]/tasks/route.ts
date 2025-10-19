/**
 * GET/POST /api/jobs/[jobId]/tasks
 * Manage workflow tasks for a job
 *
 * @task T017
 * @feature 011-making-task-lists
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import { CreateTaskSchema } from '@/domains/workflow-task/types/workflow-task-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/jobs/[jobId]/tasks
 * Get all tasks for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Create Supabase client with user context
    const supabase = await createClient();
    const repo = new WorkflowTaskRepository(supabase);
    const service = new WorkflowTaskService(repo);

    // Get task list
    const result = await service.getTaskList(params.jobId);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch tasks',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tasks: result.value,
      count: result.value.length,
    });

  } catch (error) {
    console.error('[GET /api/jobs/[jobId]/tasks] Error:', error);
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
 * POST /api/jobs/[jobId]/tasks
 * Create a new task for a job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can create tasks)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can create tasks',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Add job_id from params
    const taskInput = {
      ...body,
      job_id: params.jobId,
    };

    // Validate input with Zod
    try {
      CreateTaskSchema.parse(taskInput);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid task data',
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
    const result = await repo.create(taskInput);

    if (!result.ok) {
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
          error: 'Failed to create task',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        task: result.value,
        message: 'Task created successfully',
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[POST /api/jobs/[jobId]/tasks] Error:', error);
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
