/**
 * @fileoverview Task Definitions API Routes - List and Create
 * @module api/task-definitions
 *
 * @ai-context
 * Purpose: HTTP endpoints for task definition management
 * Pattern: Next.js App Router API routes
 * Dependencies: TaskDefinitionService, TaskDefinitionRepository
 * Usage: Frontend components call these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TaskDefinitionRepository } from '@/domains/task-definition/repositories/TaskDefinitionRepository';
import { TaskDefinitionService } from '@/domains/task-definition/services/TaskDefinitionService';
import { CreateTaskDefinitionSchema } from '@/domains/task-definition/schemas/task-definition-schemas';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/task-definitions - List all task definitions
 * @query include_deleted - Include soft-deleted definitions (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);

    if (!context.tenantId) {
      return NextResponse.json(
        { error: 'No tenant context' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeDeleted = searchParams.get('include_deleted') === 'true';

    // Initialize service
    const supabase = await createClient();
    const repository = new TaskDefinitionRepository(supabase);
    const service = new TaskDefinitionService(repository);

    // List definitions
    const result = await service.listTaskDefinitions(includeDeleted);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: result.value },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing task definitions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/task-definitions - Create new task definition
 * @body name - Task name (required)
 * @body description - Task description (required)
 * @body acceptance_criteria - Acceptance criteria (optional)
 * @body requires_photo_verification - Photo required (optional, default: false)
 * @body requires_supervisor_approval - Approval required (optional, default: false)
 * @body is_required - Required task (optional, default: true)
 */
export async function POST(request: NextRequest) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);

    if (!context.tenantId) {
      return NextResponse.json(
        { error: 'No tenant context' },
        { status: 401 }
      );
    }

    // Check supervisor role
    if (!context.roles?.includes('supervisor') && !context.roles?.includes('tenant_admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Supervisor role required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    const validation = CreateTaskDefinitionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const repository = new TaskDefinitionRepository(supabase);
    const service = new TaskDefinitionService(repository);

    // Create definition
    const userId = context.userId || 'system';
    const result = await service.createTaskDefinition(
      validation.data,
      context.tenantId,
      userId
    );

    if (!result.ok) {
      if (result.error.code === 'VALIDATION_ERROR') {
        return NextResponse.json(
          { error: result.error.message, details: result.error.details },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: result.value },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating task definition:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
