/**
 * @file src/app/api/field-intelligence/routing/schedules/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for routing schedules CRUD operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RoutingSchedulesRepository } from '@/domains/field-intelligence/repositories/routing-schedules.repository';
import { logger } from '@/core/logger/voice-logger';

/**
 * GET /api/field-intelligence/routing/schedules
 * List routing schedules with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');

    const repository = new RoutingSchedulesRepository(supabase, companyId);

    // Build filters
    const filters: any = {};
    if (userId) filters.user_id = userId;
    if (status) filters.status = status;
    if (date) {
      const targetDate = new Date(date);
      filters.scheduled_after = targetDate.toISOString();
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filters.scheduled_before = nextDay.toISOString();
    }

    const schedules = await repository.findAll(filters);

    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error: any) {
    logger.error('Get schedules API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/field-intelligence/routing/schedules
 * Create new routing schedule
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const {
      userId,
      scheduledDate,
      routeOrder,
      totalDistance,
      totalDuration,
      optimizationMethod,
    } = body;

    // Validate required fields
    if (!userId || !scheduledDate || !routeOrder) {
      return NextResponse.json(
        { error: 'userId, scheduledDate, and routeOrder are required' },
        { status: 400 }
      );
    }

    const repository = new RoutingSchedulesRepository(supabase, companyId);

    const schedule = await repository.create({
      user_id: userId,
      scheduled_date: new Date(scheduledDate).toISOString(),
      route_order: routeOrder,
      total_distance_meters: totalDistance || 0,
      total_duration_minutes: totalDuration || 0,
      optimization_method: optimizationMethod || 'MAPBOX',
      status: 'PENDING',
    });

    logger.info('Schedule created via API', {
      scheduleId: schedule.id,
      userId,
      jobCount: routeOrder.length,
    });

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error: any) {
    logger.error('Create schedule API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/field-intelligence/routing/schedules/:id
 * Update routing schedule
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    const repository = new RoutingSchedulesRepository(supabase, companyId);

    // Convert date fields if present
    if (updates.scheduledDate) {
      updates.scheduled_date = new Date(updates.scheduledDate).toISOString();
      delete updates.scheduledDate;
    }

    await repository.update(id, updates);

    const updated = await repository.findById(id);

    logger.info('Schedule updated via API', { scheduleId: id });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Update schedule API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/field-intelligence/routing/schedules/:id
 * Delete routing schedule
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    const repository = new RoutingSchedulesRepository(supabase, companyId);
    await repository.delete(id);

    logger.info('Schedule deleted via API', { scheduleId: id });

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted',
    });
  } catch (error: any) {
    logger.error('Delete schedule API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}