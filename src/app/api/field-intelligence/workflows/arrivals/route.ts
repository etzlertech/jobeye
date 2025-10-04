/**
 * @file src/app/api/field-intelligence/workflows/arrivals/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for job arrival logging and tracking
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Buffer } from 'node:buffer';
import { voiceLogger as logger } from '@/core/logger/voice-logger';
import { createArrivalWorkflowService } from '@/domains/job-workflows/services/arrival-workflow.factory';
import { createSafetyVerificationService } from '@/domains/safety/services/safety-verification.factory';
import type { SafetyChecklistItem } from '@/domains/safety/services/safety-verification.types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * POST /api/field-intelligence/workflows/arrivals
 * Log job arrival (manual or automatic)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { jobId, userId, latitude, longitude, routeId, notifyCustomer, checklistItem, arrivalPhotoBase64, arrivalPhotoType } = body;

    if (!jobId || !userId || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: 'jobId, userId, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const arrivalService = createArrivalWorkflowService({
      supabaseClient: supabase,
      logger,
      safetyVerificationService: createSafetyVerificationService({
        logger,
        vision: {
          apiKey: process.env.GOOGLE_API_KEY,
          model: process.env.GOOGLE_VISION_MODEL,
        },
      }),
    });

    const arrivalPhoto = toBlob(arrivalPhotoBase64, arrivalPhotoType);

    const result = await arrivalService.processArrival({
      jobId,
      location: { latitude, longitude },
      arrivalPhoto,
      checklistItem: sanitizeChecklistItem(checklistItem),
      context: {
        tenantId,
        userId,
        routeId,
        notifyCustomer: Boolean(notifyCustomer),
      },
    });

    logger.info('Job arrival workflow completed via API', {
      jobId,
      userId,
      timeEntryId: result.timeEntry.entryId,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    logger.error('Job arrival API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/field-intelligence/workflows/arrivals?userId=xxx&jobId=xxx
 * Get arrival records
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const jobId = searchParams.get('jobId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    const arrivalService = createArrivalWorkflowService({
      supabaseClient: supabase,
      logger,
      safetyVerificationService: createSafetyVerificationService({
        logger,
        vision: {
          apiKey: process.env.GOOGLE_API_KEY,
          model: process.env.GOOGLE_VISION_MODEL,
        },
      }),
    });

    // At this stage the arrival workflow service focuses on orchestration rather than retrieval.
    // Until a read repository is restored, return a placeholder response signalling receipt of the request.
    logger.warn('Arrival workflow GET requested but read API not yet implemented', {
      tenantId,
      userId,
      jobId,
    });

    return NextResponse.json(
      {
        message: 'Arrival retrieval not yet implemented in restored workflow.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Get arrivals API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function toBlob(base64?: string | null, type?: string | null): Blob | undefined {
  if (!base64) return undefined;
  try {
    const buffer = Buffer.from(base64, 'base64');
    return new Blob([buffer], { type: type ?? 'image/jpeg' });
  } catch (error) {
    logger.warn('Failed to decode arrival photo base64', { error });
    return undefined;
  }
}

function sanitizeChecklistItem(input: unknown): SafetyChecklistItem | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const candidate = input as any;
  if (!candidate.id || !candidate.requiredLabels) {
    return undefined;
  }
  return {
    id: String(candidate.id),
    label: String(candidate.label ?? candidate.id),
    requiredLabels: Array.isArray(candidate.requiredLabels)
      ? candidate.requiredLabels.map((label: any) => String(label))
      : [],
    minimumConfidence: typeof candidate.minimumConfidence === 'number'
      ? candidate.minimumConfidence
      : undefined,
    fallbackPrompt: candidate.fallbackPrompt ? String(candidate.fallbackPrompt) : undefined,
  };
}
