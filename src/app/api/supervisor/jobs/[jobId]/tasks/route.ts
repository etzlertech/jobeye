/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/supervisor/jobs/[jobId]/tasks/route.ts
 * phase: phase3-feature-011
 * domain: jobs
 * purpose: API endpoints for workflow task management (list, create)
 * spec_ref: specs/011-making-task-lists/TASK_TEMPLATE_MANAGEMENT_PLAN.md
 * complexity_budget: 200
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler', '@/domains/workflow-task/repositories/WorkflowTaskRepository'],
 *   external: ['next/server'],
 *   supabase: ['workflow_tasks', 'jobs']
 * }
 * exports: ['GET', 'POST']
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { getRequestContext } from '@/lib/auth/context';
import { CreateTaskSchema } from '@/domains/workflow-task/types/workflow-task-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase: SupabaseClient = user
      ? await createServerClient()
      : createServiceClient();

    const jobId = params.jobId;

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

    // Fetch tasks for this job
    const taskRepo = new WorkflowTaskRepository(supabase);
    const result = await taskRepo.findByJobId(jobId);

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch tasks');
    }

    return NextResponse.json({
      tasks: result.value,
      count: result.value.length
    });

  } catch (error) {
    console.error('Tasks GET error:', error);
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase: SupabaseClient = user
      ? await createServerClient()
      : createServiceClient();

    const jobId = params.jobId;
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

    // Get current task count to determine task_order
    const taskRepo = new WorkflowTaskRepository(supabase);
    const existingTasksResult = await taskRepo.findByJobId(jobId);
    const taskOrder = existingTasksResult.ok ? existingTasksResult.value.length : 0;

    // Validate input
    const validationResult = CreateTaskSchema.safeParse({
      ...body,
      job_id: jobId,
      task_order: taskOrder
    });

    if (!validationResult.success) {
      return validationError('Invalid task data', {
        errors: validationResult.error.errors
      });
    }

    // Create task
    const taskData = {
      ...validationResult.data,
      tenant_id: tenantId
    };

    const result = await taskRepo.create(taskData);

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to create task');
    }

    return NextResponse.json({
      task: result.value,
      message: 'Task created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Tasks POST error:', error);
    return handleApiError(error);
  }
}
