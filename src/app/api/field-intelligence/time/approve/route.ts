/**
 * @file src/app/api/field-intelligence/time/approve/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for time entry approval operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TimeApprovalService } from '@/domains/field-intelligence/services/time-approval.service';
import { logger } from '@/core/logger/voice-logger';

/**
 * GET /api/field-intelligence/time/approve/pending
 * Get pending time entries for approval
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

    const approvalService = new TimeApprovalService(supabase, companyId);
    const pending = await approvalService.getPendingApprovals(user.id);

    return NextResponse.json({
      success: true,
      data: pending,
    });
  } catch (error: any) {
    logger.error('Get pending approvals API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/field-intelligence/time/approve
 * Approve or reject time entry
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
    const { entryId, action, reason } = body;

    if (!entryId || !action) {
      return NextResponse.json(
        { error: 'entryId and action are required' },
        { status: 400 }
      );
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be APPROVE or REJECT' },
        { status: 400 }
      );
    }

    const approvalService = new TimeApprovalService(supabase, companyId);

    let result;
    if (action === 'APPROVE') {
      result = await approvalService.approveEntry(entryId, user.id, reason);
    } else {
      if (!reason) {
        return NextResponse.json(
          { error: 'reason is required for rejection' },
          { status: 400 }
        );
      }
      result = await approvalService.rejectEntry(entryId, user.id, reason);
    }

    logger.info('Time entry approved/rejected via API', {
      entryId,
      action,
      approverId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Time approval API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/field-intelligence/time/approve/bulk
 * Bulk approve multiple entries
 */
export async function PUT(request: NextRequest) {
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
    const { entryIds, reason } = body;

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { error: 'entryIds array is required' },
        { status: 400 }
      );
    }

    const approvalService = new TimeApprovalService(supabase, companyId);
    const result = await approvalService.bulkApprove(entryIds, user.id, reason);

    logger.info('Bulk time approval via API', {
      totalEntries: entryIds.length,
      approved: result.approved,
      failed: result.failed,
      approverId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Bulk approval API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}