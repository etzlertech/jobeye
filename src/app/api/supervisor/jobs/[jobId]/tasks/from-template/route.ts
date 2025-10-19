/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/supervisor/jobs/[jobId]/tasks/from-template/route.ts
 * phase: phase3-feature-011
 * domain: jobs
 * purpose: API endpoint for adding tasks from template to existing job
 * spec_ref: specs/011-making-task-lists/TASK_TEMPLATE_MANAGEMENT_PLAN.md
 * complexity_budget: 150
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler', '@/domains/task-template/services/TaskTemplateService'],
 *   external: ['next/server'],
 *   supabase: ['workflow_tasks', 'task_templates']
 * }
 * exports: ['POST']
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { TaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { getRequestContext } from '@/lib/auth/context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const { template_id } = body;

    if (!template_id) {
      return validationError('template_id is required');
    }

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

    // Instantiate template tasks
    const templateRepo = new TaskTemplateRepository(supabase);
    const taskRepo = new WorkflowTaskRepository(supabase);
    const templateService = new TaskTemplateService(templateRepo, taskRepo);

    const result = await templateService.instantiateTemplate(template_id, jobId);

    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to instantiate template');
    }

    return NextResponse.json({
      message: 'Tasks added successfully from template',
      tasks: result.value,
      count: result.value.length
    }, { status: 201 });

  } catch (error) {
    console.error('Add tasks from template error:', error);
    return handleApiError(error);
  }
}
