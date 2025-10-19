/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/supervisor/jobs/[jobId]/tasks/[taskId]/route.ts
 * phase: phase3-feature-011
 * domain: jobs
 * purpose: API endpoints for individual workflow task operations (update, delete)
 * spec_ref: specs/011-making-task-lists/TASK_TEMPLATE_MANAGEMENT_PLAN.md
 * complexity_budget: 200
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler', '@/domains/workflow-task/repositories/WorkflowTaskRepository'],
 *   external: ['next/server'],
 *   supabase: ['workflow_tasks', 'jobs']
 * }
 * exports: ['PATCH', 'DELETE']
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { getRequestContext } from '@/lib/auth/context';
import { UpdateTaskSchema } from '@/domains/workflow-task/types/workflow-task-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase: SupabaseClient = user
      ? await createServerClient()
      : createServiceClient();

    const { jobId, taskId } = params;
    const body = await request.json();

    // Verify job exists and belongs to tenant
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify task exists and belongs to job
    const taskRepo = new WorkflowTaskRepository(supabase);
    const existingTaskResult = await taskRepo.findById(taskId);

    if (!existingTaskResult.ok || !existingTaskResult.value) {
      return NextResponse.json(
        { message: 'Task not found' },
        { status: 404 }
      );
    }

    const existingTask = existingTaskResult.value;

    if (existingTask.job_id !== jobId) {
      return NextResponse.json(
        { message: 'Task does not belong to this job' },
        { status: 403 }
      );
    }

    // Validate input
    const validationResult = UpdateTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return validationError('Invalid task data', {
        errors: validationResult.error.errors
      });
    }

    // Update task
    const result = await taskRepo.update(taskId, validationResult.data);

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update task');
    }

    return NextResponse.json({
      task: result.value,
      message: 'Task updated successfully'
    });

  } catch (error) {
    console.error('Task PATCH error:', error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string; taskId: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase: SupabaseClient = user
      ? await createServerClient()
      : createServiceClient();

    const { jobId, taskId } = params;

    // Verify job exists and belongs to tenant
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify task exists and belongs to job
    const taskRepo = new WorkflowTaskRepository(supabase);
    const existingTaskResult = await taskRepo.findById(taskId);

    if (!existingTaskResult.ok || !existingTaskResult.value) {
      return NextResponse.json(
        { message: 'Task not found' },
        { status: 404 }
      );
    }

    const existingTask = existingTaskResult.value;

    if (existingTask.job_id !== jobId) {
      return NextResponse.json(
        { message: 'Task does not belong to this job' },
        { status: 403 }
      );
    }

    // Soft delete task (mark as deleted)
    const result = await taskRepo.softDelete(taskId);

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to delete task');
    }

    return NextResponse.json({
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('Task DELETE error:', error);
    return handleApiError(error);
  }
}
