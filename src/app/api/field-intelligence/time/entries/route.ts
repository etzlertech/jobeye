/**
 * @file src/app/api/field-intelligence/time/entries/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for time entries CRUD operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TimeEntriesRepository } from '@/domains/field-intelligence/repositories/time-entries.repository';
import { logger } from '@/core/logger/voice-logger';

/**
 * GET /api/field-intelligence/time/entries?userId=xxx&startDate=xxx&endDate=xxx
 * List time entries with filters
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const approvalStatus = searchParams.get('approvalStatus');

    const repository = new TimeEntriesRepository(supabase, companyId);

    const filters: any = {};
    if (userId) filters.user_id = userId;
    if (approvalStatus) filters.approval_status = approvalStatus;
    if (startDate) filters.clock_in_after = new Date(startDate).toISOString();
    if (endDate) filters.clock_in_before = new Date(endDate).toISOString();

    const entries = await repository.findAll(filters);

    return NextResponse.json({
      success: true,
      data: entries,
    });
  } catch (error: any) {
    logger.error('Get time entries API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/field-intelligence/time/entries/:id
 * Update time entry
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
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    const repository = new TimeEntriesRepository(supabase, companyId);

    // Convert date fields if present
    if (updates.clockInTime) {
      updates.clock_in_time = new Date(updates.clockInTime).toISOString();
      delete updates.clockInTime;
    }
    if (updates.clockOutTime) {
      updates.clock_out_time = new Date(updates.clockOutTime).toISOString();
      delete updates.clockOutTime;
    }

    await repository.update(id, updates);
    const updated = await repository.findById(id);

    logger.info('Time entry updated via API', { entryId: id });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Update time entry API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/field-intelligence/time/entries/:id
 * Delete time entry
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
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    const repository = new TimeEntriesRepository(supabase, companyId);
    await repository.delete(id);

    logger.info('Time entry deleted via API', { entryId: id });

    return NextResponse.json({
      success: true,
      message: 'Time entry deleted',
    });
  } catch (error: any) {
    logger.error('Delete time entry API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}