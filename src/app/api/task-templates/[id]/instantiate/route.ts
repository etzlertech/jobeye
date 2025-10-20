/**
 * POST /api/task-templates/[id]/instantiate
 * Instantiate a template into a job (create workflow tasks from template)
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

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/task-templates/[id]/instantiate
 * Apply template to a job, creating workflow tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can instantiate templates)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can instantiate templates',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate job_id is provided
    if (!body.job_id || typeof body.job_id !== 'string') {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'job_id is required and must be a string',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Validate job_id is a valid UUID
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(body.job_id)) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'job_id must be a valid UUID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
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

    // Instantiate template
    const result = await service.instantiateTemplate(params.id, body.job_id, context.tenantId);

    if (!result.ok) {
      if (result.error.code === 'TEMPLATE_NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Template not found',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 404 }
        );
      }

      if (result.error.code === 'TEMPLATE_INACTIVE') {
        return NextResponse.json(
          {
            error: 'Template inactive',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 400 }
        );
      }

      if (result.error.code === 'TEMPLATE_EMPTY') {
        return NextResponse.json(
          {
            error: 'Template empty',
            message: result.error.message,
            code: result.error.code,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to instantiate template',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        tasks: result.value,
        count: result.value.length,
        message: `Template instantiated successfully. Created ${result.value.length} tasks.`,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[POST /api/task-templates/[id]/instantiate] Error:', error);
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
