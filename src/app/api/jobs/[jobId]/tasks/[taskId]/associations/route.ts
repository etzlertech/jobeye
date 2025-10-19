/**
 * GET/POST /api/jobs/[jobId]/tasks/[taskId]/associations
 * Manage item associations for workflow tasks
 *
 * @task T023
 * @feature 015-task-item-association
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import { createWorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import {
  TaskItemStatus,
  CreateWorkflowTaskItemAssociationSchema,
} from '@/domains/workflow-task/types/workflow-task-association-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/jobs/[jobId]/tasks/[taskId]/associations
 * List all item associations for a workflow task (with optional status filter)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Get optional status filter from query params
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const status = statusParam ? (statusParam as TaskItemStatus) : undefined;

    // Validate status if provided
    if (status && !['pending', 'loaded', 'verified', 'missing', 'returned'].includes(status)) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'Invalid status value',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Create Supabase client with user context
    const supabase = await createClient();
    const taskRepo = new WorkflowTaskRepository(supabase);
    const associationRepo = new WorkflowTaskItemAssociationRepository(supabase);
    const service = createWorkflowTaskService(taskRepo, associationRepo);

    // Get associations for workflow task
    const result = await service.getItemAssociations(params.taskId, status);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Workflow task not found',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch associations',
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
    console.error('[GET /api/jobs/[jobId]/tasks/[taskId]/associations] Error:', error);
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
 * POST /api/jobs/[jobId]/tasks/[taskId]/associations
 * Create a new item association for a workflow task (workers and supervisors)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate role (workers and supervisors can create associations)
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

    // Parse request body
    const body = await request.json();

    // Validate input with Zod
    try {
      CreateWorkflowTaskItemAssociationSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid association data',
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

    const taskRepo = new WorkflowTaskRepository(supabase);
    const associationRepo = new WorkflowTaskItemAssociationRepository(supabase);
    const service = createWorkflowTaskService(taskRepo, associationRepo);

    // Create association
    const result = await service.addItemAssociation(params.taskId, context.tenantId, body);

    if (!result.ok) {
      if (result.error.code === 'DUPLICATE_ASSOCIATION') {
        return NextResponse.json(
          {
            error: 'Duplicate association',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 409 }
        );
      }

      if (result.error.code === 'INVALID_REFERENCE') {
        return NextResponse.json(
          {
            error: 'Invalid reference',
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
          error: 'Failed to create association',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: result.value,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[POST /api/jobs/[jobId]/tasks/[taskId]/associations] Error:', error);
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
