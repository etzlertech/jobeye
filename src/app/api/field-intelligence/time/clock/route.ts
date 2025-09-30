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
import { TimeEntriesRepository } from '@/domains/field-intelligence/repositories/time-entries.repository';
import { TimeAutoClockoutService } from '@/domains/field-intelligence/services/time-auto-clockout.service';
import { logger } from '@/core/logger/voice-logger';

/**
 * POST /api/field-intelligence/time/clock/in
 * Clock in for job
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
    const { userId, jobId, latitude, longitude } = body;

    if (!userId || !jobId) {
      return NextResponse.json(
        { error: 'userId and jobId are required' },
        { status: 400 }
      );
    }

    const timeEntriesRepo = new TimeEntriesRepository(supabase, companyId);

    // Check if already clocked in
    const activeEntries = await timeEntriesRepo.findAll({
      user_id: userId,
      clock_out_time: null,
    });

    if (activeEntries.length > 0) {
      return NextResponse.json(
        { error: 'User already clocked in' },
        { status: 400 }
      );
    }

    // Create time entry
    const entry = await timeEntriesRepo.create({
      user_id: userId,
      job_id: jobId,
      clock_in_time: new Date().toISOString(),
      clock_in_latitude: latitude || null,
      clock_in_longitude: longitude || null,
      clock_out_time: null,
      approval_status: 'PENDING',
    });

    logger.info('User clocked in via API', {
      entryId: entry.id,
      userId,
      jobId,
    });

    return NextResponse.json({
      success: true,
      data: entry,
    });
  } catch (error: any) {
    logger.error('Clock in API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/field-intelligence/time/clock/out
 * Clock out from job
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
    const { userId, latitude, longitude } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const timeEntriesRepo = new TimeEntriesRepository(supabase, companyId);

    // Find active time entry
    const activeEntries = await timeEntriesRepo.findAll({
      user_id: userId,
      clock_out_time: null,
    });

    if (activeEntries.length === 0) {
      return NextResponse.json(
        { error: 'No active time entry found' },
        { status: 400 }
      );
    }

    const entry = activeEntries[0];

    // Update with clock out time
    await timeEntriesRepo.update(entry.id, {
      clock_out_time: new Date().toISOString(),
      clock_out_latitude: latitude || null,
      clock_out_longitude: longitude || null,
      auto_clocked_out: false,
    });

    const updated = await timeEntriesRepo.findById(entry.id);

    logger.info('User clocked out via API', {
      entryId: entry.id,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Clock out API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/field-intelligence/time/clock/status?userId=xxx
 * Get current clock status
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const timeEntriesRepo = new TimeEntriesRepository(supabase, companyId);

    const activeEntries = await timeEntriesRepo.findAll({
      user_id: userId,
      clock_out_time: null,
    });

    const isClockedIn = activeEntries.length > 0;
    const activeEntry = isClockedIn ? activeEntries[0] : null;

    return NextResponse.json({
      success: true,
      data: {
        isClockedIn,
        activeEntry,
      },
    });
  } catch (error: any) {
    logger.error('Get clock status API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}