/**
 * POST /api/workflow-tasks/[id]/image
 * Upload and persist workflow task images
 *
 * @task T010
 * @feature 013-lets-plan-to
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/auth/context';
import { createServiceClient } from '@/lib/supabase/server';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskService } from '@/domains/workflow-task/services/WorkflowTaskService';
import type { ProcessedImages } from '@/utils/image-processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ImagesSchema = z.object({
  thumbnail: z.string().min(1, 'thumbnail image is required'),
  medium: z.string().min(1, 'medium image is required'),
  full: z.string().min(1, 'full image is required'),
});

const RequestSchema = z.object({
  images: ImagesSchema,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);

    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can upload task images',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    const json = await request.json();
    const parsed = RequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          message: parsed.error.errors.map(err => err.message).join(', '),
          code: 'INVALID_INPUT',
          details: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const images = parsed.data.images as ProcessedImages;

    const supabase = createServiceClient();
    const taskRepo = new WorkflowTaskRepository(supabase);
    const service = new WorkflowTaskService(taskRepo);

    const result = await service.uploadTaskImage(
      supabase,
      params.id,
      context.tenantId,
      images
    );

    if (!result.ok) {
      const code = result.error.code;
      const payload = {
        error: code,
        message: result.error.message,
        details: result.error.details,
      };

      switch (code) {
        case 'TASK_NOT_FOUND':
          return NextResponse.json(payload, { status: 404 });
        case 'FORBIDDEN':
          return NextResponse.json(payload, { status: 403 });
        case 'IMAGE_UPLOAD_FAILED':
        case 'IMAGE_UPDATE_FAILED':
          return NextResponse.json(payload, { status: 502 });
        case 'TASK_FETCH_FAILED':
          return NextResponse.json(payload, { status: 500 });
        default:
          return NextResponse.json(payload, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        success: true,
        task: result.value,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[POST /api/workflow-tasks/[id]/image] Unexpected error', error);
    return NextResponse.json(
      {
        error: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);

    if (!context.isSupervisor) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only supervisors can remove task images',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();
    const taskRepo = new WorkflowTaskRepository(supabase);
    const service = new WorkflowTaskService(taskRepo);

    const result = await service.removeTaskImage(
      supabase,
      params.id,
      context.tenantId
    );

    if (!result.ok) {
      const code = result.error.code;
      const payload = {
        error: code,
        message: result.error.message,
        details: result.error.details,
      };

      switch (code) {
        case 'TASK_NOT_FOUND':
          return NextResponse.json(payload, { status: 404 });
        case 'FORBIDDEN':
          return NextResponse.json(payload, { status: 403 });
        case 'IMAGE_UPDATE_FAILED':
          return NextResponse.json(payload, { status: 500 });
        case 'TASK_FETCH_FAILED':
          return NextResponse.json(payload, { status: 500 });
        default:
          return NextResponse.json(payload, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        success: true,
        task: result.value,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/workflow-tasks/[id]/image] Unexpected error', error);
    return NextResponse.json(
      {
        error: 'UNEXPECTED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
