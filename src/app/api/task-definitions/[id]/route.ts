/**
 * @fileoverview Task Definitions API Routes - Detail, Update, Delete
 * @module api/task-definitions/[id]
 *
 * @ai-context
 * Purpose: HTTP endpoints for individual task definition operations
 * Pattern: Next.js App Router dynamic route API
 * Dependencies: TaskDefinitionService, TaskDefinitionRepository
 * Usage: Frontend components call these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TaskDefinitionRepository } from '@/domains/task-definition/repositories/TaskDefinitionRepository';
import { TaskDefinitionService } from '@/domains/task-definition/services/TaskDefinitionService';
import { UpdateTaskDefinitionSchema } from '@/domains/task-definition/schemas/task-definition-schemas';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/task-definitions/:id - Get task definition details
 * @param id - Task definition UUID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);

    if (!context.tenantId) {
      return NextResponse.json(
        { error: 'No tenant context' },
        { status: 401 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const repository = new TaskDefinitionRepository(supabase);
    const service = new TaskDefinitionService(repository);

    // Get definition
    const result = await service.getTaskDefinitionById(params.id);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          { error: 'Task definition not found' },
          { status: 404 }
        );
      }
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
    console.error('Error getting task definition:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/task-definitions/:id - Update task definition
 * @param id - Task definition UUID
 * @body name - Updated name (optional)
 * @body description - Updated description (optional)
 * @body acceptance_criteria - Updated criteria (optional)
 * @body requires_photo_verification - Updated photo flag (optional)
 * @body requires_supervisor_approval - Updated approval flag (optional)
 * @body is_required - Updated required flag (optional)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const validation = UpdateTaskDefinitionSchema.safeParse(body);
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

    // Update definition
    const result = await service.updateTaskDefinition(params.id, validation.data);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          { error: 'Task definition not found' },
          { status: 404 }
        );
      }
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
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating task definition:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/task-definitions/:id - Delete task definition (soft delete)
 * @param id - Task definition UUID
 * @returns 200 on success, 409 if in use, 404 if not found
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Initialize service
    const supabase = await createClient();
    const repository = new TaskDefinitionRepository(supabase);
    const service = new TaskDefinitionService(repository);

    // Delete definition
    const result = await service.deleteTaskDefinition(params.id);

    if (!result.ok) {
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json(
          { error: 'Task definition not found' },
          { status: 404 }
        );
      }
      if (result.error.code === 'IN_USE') {
        return NextResponse.json(
          {
            error: result.error.message,
            code: 'IN_USE',
            details: result.error.details
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Task definition deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting task definition:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
