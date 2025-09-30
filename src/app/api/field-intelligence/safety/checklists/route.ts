/**
 * @file src/app/api/field-intelligence/safety/checklists/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for safety checklist operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SafetyChecklistManagementService } from '@/domains/field-intelligence/services/safety-checklist-management.service';
import { logger } from '@/core/logger/voice-logger';

/**
 * GET /api/field-intelligence/safety/checklists?jobId=xxx
 * Get checklist for job
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
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const checklistService = new SafetyChecklistManagementService(supabase, companyId);
    const checklist = await checklistService.getChecklistForJob(jobId);

    return NextResponse.json({
      success: true,
      data: checklist,
    });
  } catch (error: any) {
    logger.error('Get checklist API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/field-intelligence/safety/checklists
 * Create checklist for job
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
    const { jobId, items } = body;

    if (!jobId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'jobId and items array are required' },
        { status: 400 }
      );
    }

    const checklistService = new SafetyChecklistManagementService(supabase, companyId);
    const checklist = await checklistService.createChecklist(jobId, items);

    return NextResponse.json({
      success: true,
      data: checklist,
    });
  } catch (error: any) {
    logger.error('Create checklist API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/field-intelligence/safety/checklists/items
 * Complete checklist item
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
    const { itemId, userId, photoProofUrl, notes } = body;

    if (!itemId || !userId) {
      return NextResponse.json(
        { error: 'itemId and userId are required' },
        { status: 400 }
      );
    }

    const checklistService = new SafetyChecklistManagementService(supabase, companyId);
    await checklistService.completeItem(itemId, userId, photoProofUrl, notes);

    return NextResponse.json({
      success: true,
      message: 'Checklist item completed',
    });
  } catch (error: any) {
    logger.error('Complete checklist item API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}