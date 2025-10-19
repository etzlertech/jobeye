/**
 * GET/POST /api/task-templates
 * Manage task templates
 *
 * @task T019
 * @feature 011-making-task-lists
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { TaskTemplateItemAssociationRepository } from '@/domains/task-template/repositories/TaskTemplateItemAssociationRepository';
import { createTaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import {
  CreateTemplateSchema,
  CreateTemplateItemSchema,
} from '@/domains/task-template/types/task-template-types';
import { ZodError } from 'zod';

// CRITICAL: Force dynamic rendering for server-side execution
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/task-templates
 * Get all templates (optionally include inactive)
 */
export async function GET(request: NextRequest) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Check for includeInactive query param
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Create Supabase client with user context
    const supabase = await createClient();
    const templateRepo = new TaskTemplateRepository(supabase);
    const taskRepo = new WorkflowTaskRepository(supabase);
    const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
    const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
    const service = createTaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);

    // Get all templates
    const result = await service.getAllTemplates(includeInactive);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch templates',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      templates: result.value,
      count: result.value.length,
    });

  } catch (error) {
    console.error('[GET /api/task-templates] Error:', error);
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
 * POST /api/task-templates
 * Create a new template (supervisors only)
 */
export async function POST(request: NextRequest) {
  try {
    // Get request context for tenant isolation
    const context = await getRequestContext(request);

    // Validate supervisor role (only supervisors can create templates)
    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can create templates',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate template data
    try {
      // Convert empty strings to undefined for optional fields
      const templateData = {
        name: body.name,
        description: body.description || undefined,
        job_type: body.job_type || undefined,
      };

      CreateTemplateSchema.parse(templateData);

      // Validate items array exists and has at least one item
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Template must have at least one item',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        );
      }

      // Validate each item
      body.items.forEach((item: any) => {
        // Convert empty acceptance_criteria to undefined
        const itemData = {
          ...item,
          acceptance_criteria: item.acceptance_criteria || undefined,
        };
        CreateTemplateItemSchema.parse(itemData);
      });

    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid template data',
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
    const result = await repo.create(
      {
        name: body.name,
        description: body.description,
        job_type: body.job_type,
        tenant_id: context.tenantId, // Add tenant_id from context
      },
      body.items
    );

    if (!result.ok) {
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
          error: 'Failed to create template',
          message: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        template: result.value,
        message: 'Template created successfully',
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[POST /api/task-templates] Error:', error);
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
