/**
 * @file src/app/api/field-intelligence/routing/gps/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for GPS tracking operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RoutingGPSTrackingService } from '@/domains/field-intelligence/services/routing-gps-tracking.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * POST /api/field-intelligence/routing/gps
 * Record GPS coordinate
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { userId, latitude, longitude, accuracy, jobId } = body;

    if (!userId || latitude == null || longitude == null || accuracy == null) {
      return NextResponse.json(
        { error: 'userId, latitude, longitude, and accuracy are required' },
        { status: 400 }
      );
    }

    const trackingService = new RoutingGPSTrackingService(supabase, companyId);

    await trackingService.recordCoordinate(
      userId,
      {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(),
      },
      jobId
    );

    return NextResponse.json({
      success: true,
      message: 'GPS coordinate recorded',
    });
  } catch (error: any) {
    logger.error('GPS tracking API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/field-intelligence/routing/gps?userId=xxx&jobId=xxx
 * Get tracking session info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const jobId = searchParams.get('jobId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const trackingService = new RoutingGPSTrackingService(supabase, companyId);
    const session = await trackingService.getTrackingSession(userId, jobId || undefined);

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    logger.error('Get tracking session API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}