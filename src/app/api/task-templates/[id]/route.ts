/**
 * GET/PATCH/DELETE /api/task-templates/[id]
 * Manage individual task templates
 *
 * @task T020
 * @feature 011-making-task-lists
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { TaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { UpdateTemplateSchema } from '@/domains/task-template/types/task-template-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/task-templates/[id]
 * Get template details with items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Create Supabase client with user context
    const supabase = await createClient();
    const templateRepo = new TaskTemplateRepository(supabase);
    const taskRepo = new WorkflowTaskRepository(supabase);
    const service = new TaskTemplateService(templateRepo, taskRepo);

    // Get template details
    const result = await service.getTemplateDetails(params.id);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch template',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    if (!result.value) {
      return NextResponse.json(
        {
          error: 'Template not found',
          message: 'Template not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      template: result.value,
    });

  } catch (error) {
    console.error('[GET /api/task-templates/[id]] Error:', error);
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
 * PATCH /api/task-templates/[id]
 * Update template metadata (supervisors only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can update templates)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can update templates',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input with Zod
    try {
      UpdateTemplateSchema.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid template update data',
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

    const repo = new TaskTemplateRepository(supabase);
    const result = await repo.update(params.id, body);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Template not found',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 404 }
        );
      }

      if (result.error.code === 'TEMPLATE_NAME_EXISTS') {
        return NextResponse.json(
          {
            error: 'Template name already exists',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 409 }
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
          error: 'Failed to update template',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      template: result.value,
      message: 'Template updated successfully',
    });

  } catch (error) {
    console.error('[PATCH /api/task-templates/[id]] Error:', error);
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
 * DELETE /api/task-templates/[id]
 * Delete template (supervisors only, only if not in use)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can delete templates)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can delete templates',
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
    const service = new TaskTemplateService(templateRepo, taskRepo);

    // Check if template is in use
    const usageResult = await service.validateTemplateUsage(params.id);

    if (!usageResult.ok) {
      return NextResponse.json(
        {
          error: 'Failed to validate template usage',
          message: usageResult.error.message,
          code: usageResult.error.code,
        },
        { status: 500 }
      );
    }

    if (!usageResult.value.canDelete) {
      return NextResponse.json(
        {
          error: 'Template in use',
          message: 'Cannot delete template that is currently in use by jobs',
          code: 'TEMPLATE_IN_USE',
        },
        { status: 409 }
      );
    }

    // Delete template
    const result = await templateRepo.delete(params.id);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Failed to delete template',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Template deleted successfully',
    });

  } catch (error) {
    console.error('[DELETE /api/task-templates/[id]] Error:', error);
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
