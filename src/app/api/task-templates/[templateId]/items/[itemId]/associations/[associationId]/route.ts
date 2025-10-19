/**
 * GET/PATCH/DELETE /api/task-templates/[templateId]/items/[itemId]/associations/[associationId]
 * Manage individual template item associations
 *
 * @task T022
 * @feature 015-task-item-association
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { TaskTemplateItemAssociationRepository } from '@/domains/task-template/repositories/TaskTemplateItemAssociationRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import { TaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { UpdateTaskTemplateItemAssociationSchema } from '@/domains/task-template/types/task-template-association-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/task-templates/[templateId]/items/[itemId]/associations/[associationId]
 * Get a specific template item association
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string; itemId: string; associationId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Create Supabase client with user context
    const supabase = await createClient();
    const associationRepo = new TaskTemplateItemAssociationRepository(supabase);

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
          message: 'Template item association not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: result.value,
    });

  } catch (error) {
    console.error('[GET /api/task-templates/[templateId]/items/[itemId]/associations/[associationId]] Error:', error);
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
 * PATCH /api/task-templates/[templateId]/items/[itemId]/associations/[associationId]
 * Update a template item association (supervisors only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string; itemId: string; associationId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can modify templates)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can update template item associations',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input with Zod
    try {
      UpdateTaskTemplateItemAssociationSchema.parse(body);
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

    const templateRepo = new TaskTemplateRepository(supabase);
    const taskRepo = new WorkflowTaskRepository(supabase);
    const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
    const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
    const service = new TaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);

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
    console.error('[PATCH /api/task-templates/[templateId]/items/[itemId]/associations/[associationId]] Error:', error);
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
 * DELETE /api/task-templates/[templateId]/items/[itemId]/associations/[associationId]
 * Delete a template item association (supervisors only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string; itemId: string; associationId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can modify templates)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can delete template item associations',
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

    const templateRepo = new TaskTemplateRepository(supabase);
    const taskRepo = new WorkflowTaskRepository(supabase);
    const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
    const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
    const service = new TaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);

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
    console.error('[DELETE /api/task-templates/[templateId]/items/[itemId]/associations/[associationId]] Error:', error);
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
