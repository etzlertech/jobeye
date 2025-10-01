/**
 * @file src/app/api/field-intelligence/routing/geofence/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for geofencing operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RoutingGeofencingService } from '@/domains/field-intelligence/services/routing-geofencing.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * POST /api/field-intelligence/routing/geofence/check
 * Check geofence status
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
    const { userId, propertyId, latitude, longitude } = body;

    if (!userId || !propertyId || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: 'userId, propertyId, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const geofencingService = new RoutingGeofencingService(supabase, companyId);

    const result = await geofencingService.checkGeofence(
      userId,
      propertyId,
      { latitude, longitude }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Geofence check API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/field-intelligence/routing/geofence/events?userId=xxx
 * Get recent geofence events
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
    const hoursAgo = parseInt(searchParams.get('hoursAgo') || '24');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const geofencingService = new RoutingGeofencingService(supabase, companyId);
    const events = await geofencingService.getRecentEvents(userId, hoursAgo);

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    logger.error('Get geofence events API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}