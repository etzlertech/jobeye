/**
 * GET/PATCH/DELETE /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]
 * Manage individual workflow task item associations
 *
 * @task T024
 * @feature 015-task-item-association
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import { WorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import { UpdateWorkflowTaskItemAssociationSchema } from '@/domains/workflow-task/types/workflow-task-association-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]
 * Get a specific workflow task item association
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string; associationId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Create Supabase client with user context
    const supabase = await createClient();
    const associationRepo = new WorkflowTaskItemAssociationRepository(supabase);

    // Get association by ID
    const result = await associationRepo.findById(params.associationId);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch association',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    if (!result.value) {
      return NextResponse.json(
        {
          error: 'Association not found',
          message: 'Workflow task item association not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: result.value,
    });

  } catch (error) {
    console.error('[GET /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]] Error:', error);
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
 * PATCH /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]
 * Update a workflow task item association (workers and supervisors)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string; associationId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate role (workers and supervisors can update associations)
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
      UpdateWorkflowTaskItemAssociationSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid association update data',
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
    const service = new WorkflowTaskService(taskRepo, associationRepo);

    // Update association
    const result = await service.updateItemAssociation(params.associationId, body);

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
          error: 'Failed to update association',
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
    console.error('[PATCH /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]] Error:', error);
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
 * DELETE /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]
 * Delete a workflow task item association (workers and supervisors)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string; associationId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate role (workers and supervisors can delete associations)
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
    const service = new WorkflowTaskService(taskRepo, associationRepo);

    // Delete association
    const result = await service.removeItemAssociation(params.associationId);

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

      return NextResponse.json(
        {
          error: 'Failed to delete association',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('[DELETE /api/jobs/[jobId]/tasks/[taskId]/associations/[associationId]] Error:', error);
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
