/**
 * @file src/app/api/field-intelligence/time/clock/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for clock in/out operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { voiceLogger as logger } from '@/core/logger/voice-logger';
import {
  createTimeTrackingService,
} from '@/domains/time-tracking/services/time-tracking.factory';
import type {
  ClockSource,
  LocationPoint,
} from '@/domains/time-tracking/services/time-tracking.types';

type SupportedAction = 'clock-in' | 'clock-out';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id as string | undefined;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant information missing from user metadata' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, location, jobId, routeId, source, metadata } = body ?? {};

    if (!isSupportedAction(action)) {
      return NextResponse.json(
        { error: 'action must be "clock-in" or "clock-out"' },
        { status: 400 }
      );
    }

    if (!isValidLocation(location)) {
      return NextResponse.json(
        { error: 'location with latitude and longitude is required' },
        { status: 400 }
      );
    }

    const service = createTimeTrackingService({
      supabaseClient: supabase,
      logger,
    });

    if (action === 'clock-in') {
      const result = await service.clockIn(user.id, location, {
        context: { tenantId, jobId, routeId },
        source: mapClockSource(source),
        metadata,
      });

      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

    const result = await service.clockOut(user.id, location, {
      context: { tenantId, jobId, routeId },
      metadata,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Time clock API error', { error });
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}

function isSupportedAction(action: unknown): action is SupportedAction {
  return action === 'clock-in' || action === 'clock-out';
}

function isValidLocation(location: unknown): location is LocationPoint {
  return (
    typeof location === 'object' &&
    location !== null &&
    typeof (location as any).latitude === 'number' &&
    typeof (location as any).longitude === 'number'
  );
}

function mapClockSource(source: unknown): ClockSource {
  if (
    source === 'manual' ||
    source === 'voice_command' ||
    source === 'geofence' ||
    source === 'auto_detected'
  ) {
    return source;
  }
  return 'manual';
}

function methodNotAllowed() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
