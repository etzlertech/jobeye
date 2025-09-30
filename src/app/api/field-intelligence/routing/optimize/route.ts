/**
 * @file src/app/api/field-intelligence/routing/optimize/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for route optimization with Mapbox integration
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RoutingOptimizationService } from '@/domains/field-intelligence/services/routing-optimization.service';
import { logger } from '@/core/logger/voice-logger';

/**
 * POST /api/field-intelligence/routing/optimize
 * Optimize route for multiple job stops
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get company ID from user metadata
    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID not found' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { jobIds, userId, scheduledDate, startLocation } = body;

    // Validate required fields
    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json(
        { error: 'jobIds array is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Initialize service
    const mapboxApiKey = process.env.MAPBOX_API_KEY || '';
    const optimizationService = new RoutingOptimizationService(
      supabase,
      companyId,
      mapboxApiKey
    );

    // Optimize route
    const result = await optimizationService.optimizeRoute({
      jobIds,
      userId,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      startLocation,
    });

    logger.info('Route optimized via API', {
      userId,
      jobCount: jobIds.length,
      totalDistance: result.totalDistanceMeters,
      totalDuration: result.totalDurationMinutes,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Route optimization API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/field-intelligence/routing/optimize?userId=xxx&date=xxx
 * Get optimization history
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID not found' },
        { status: 400 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    // Query schedules
    const filters: any = {};
    if (userId) filters.user_id = userId;
    if (date) {
      const targetDate = new Date(date);
      filters.scheduled_after = targetDate.toISOString();
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filters.scheduled_before = nextDay.toISOString();
    }

    const { data: schedules, error } = await supabase
      .from('routing_schedules')
      .select('*')
      .eq('company_id', companyId)
      .match(filters)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error: any) {
    logger.error('Get optimization history API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}