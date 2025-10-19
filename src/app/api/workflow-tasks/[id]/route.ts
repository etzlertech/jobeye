/**
 * GET /api/workflow-tasks/[id]
 * Retrieve workflow task details with related job/template information
 *
 * @feature 013-lets-plan-to
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);

    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can access task details',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();

    const { data: task, error: taskError } = await supabase
      .from('workflow_tasks')
      .select('*')
      .eq('id', params.id)
      .eq('tenant_id', context.tenantId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (taskError) {
      console.error('Failed to fetch workflow task', taskError);
    }

    if (!task) {
      return NextResponse.json(
        {
          error: 'TASK_NOT_FOUND',
          message: 'Task not found',
        },
        { status: 404 }
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_number, title, status, scheduled_start, scheduled_end, priority')
      .eq('id', task.job_id)
      .eq('tenant_id', context.tenantId)
      .maybeSingle();

    if (jobError) {
      console.error('Failed to fetch job for task', jobError);
    }

    let template = null;
    if (task.template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from('task_templates')
        .select('id, name, description, medium_url, thumbnail_url, primary_image_url')
        .eq('id', task.template_id)
        .eq('tenant_id', context.tenantId)
        .maybeSingle();

      if (templateError) {
        console.error('Failed to fetch template for task', templateError);
      }

      template = templateData || null;
    }

    return NextResponse.json({
      task,
      job,
      template,
    });
  } catch (error) {
    console.error('[GET /api/workflow-tasks/[id]] Unexpected error', error);
    return NextResponse.json(
      {
        error: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
