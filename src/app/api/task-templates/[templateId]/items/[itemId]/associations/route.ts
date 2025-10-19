/**
 * GET/POST /api/task-templates/[templateId]/items/[itemId]/associations
 * Manage item associations for task template items
 *
 * @task T021
 * @feature 015-task-item-association
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { TaskTemplateItemAssociationRepository } from '@/domains/task-template/repositories/TaskTemplateItemAssociationRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import { createTaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { CreateTaskTemplateItemAssociationSchema } from '@/domains/task-template/types/task-template-association-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/task-templates/[templateId]/items/[itemId]/associations
 * List all item associations for a template item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string; itemId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Create Supabase client with user context
    const supabase = await createClient();
    const templateRepo = new TaskTemplateRepository(supabase);
    const taskRepo = new WorkflowTaskRepository(supabase);
    const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
    const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
    const service = createTaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);

    // Get associations for template item
    const result = await service.getItemAssociations(params.itemId);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Template item not found',
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
    console.error('[GET /api/task-templates/[templateId]/items/[itemId]/associations] Error:', error);
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
 * POST /api/task-templates/[templateId]/items/[itemId]/associations
 * Create a new item association for a template item (supervisors only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string; itemId: string } }
) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can modify templates)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can create template item associations',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input with Zod
    try {
      CreateTaskTemplateItemAssociationSchema.parse(body);
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

    const templateRepo = new TaskTemplateRepository(supabase);
    const taskRepo = new WorkflowTaskRepository(supabase);
    const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
    const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
    const service = createTaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);

    // Create association
    const result = await service.addItemAssociation(params.itemId, context.tenantId, body);

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
    console.error('[POST /api/task-templates/[templateId]/items/[itemId]/associations] Error:', error);
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
