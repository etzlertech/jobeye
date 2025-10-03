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
import { WorkflowsJobArrivalService } from '@/domains/field-intelligence/services/workflows-job-arrival.service';
import { logger } from '@/core/logger/voice-logger';

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
    const { jobId, userId, latitude, longitude, detectionMethod, photoProofUrl } = body;

    if (!jobId || !userId || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: 'jobId, userId, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    if (!detectionMethod || !['GEOFENCE', 'MANUAL', 'GPS'].includes(detectionMethod)) {
      return NextResponse.json(
        { error: 'detectionMethod must be GEOFENCE, MANUAL, or GPS' },
        { status: 400 }
      );
    }

    const arrivalService = new WorkflowsJobArrivalService(supabase, tenantId);

    const arrival = await arrivalService.logArrival({
      jobId,
      userId,
      latitude,
      longitude,
      detectionMethod,
      photoProofUrl,
    });

    logger.info('Job arrival logged via API', {
      arrivalId: arrival.arrivalId,
      jobId,
      userId,
      detectionMethod,
    });

    return NextResponse.json({
      success: true,
      data: arrival,
    });
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

    const arrivalService = new WorkflowsJobArrivalService(supabase, tenantId);

    if (jobId && userId) {
      // Get specific arrival
      const arrival = await arrivalService.getArrival(userId, jobId);
      return NextResponse.json({
        success: true,
        data: arrival,
      });
    } else if (userId) {
      // Get today's arrivals for user
      const arrivals = await arrivalService.getTodayArrivals(userId);
      return NextResponse.json({
        success: true,
        data: arrivals,
      });
    } else {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    logger.error('Get arrivals API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}