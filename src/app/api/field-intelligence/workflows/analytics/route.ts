/**
 * @file src/app/api/field-intelligence/workflows/analytics/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for workflow analytics
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowsAnalyticsService } from '@/domains/field-intelligence/services/workflows-analytics.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * GET /api/field-intelligence/workflows/analytics/bottlenecks
 * Detect workflow bottlenecks
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
    const type = searchParams.get('type') || 'bottlenecks';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const analyticsService = new WorkflowsAnalyticsService(supabase, tenantId);

    let data;
    switch (type) {
      case 'bottlenecks':
        data = await analyticsService.detectBottlenecks(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );
        break;
      case 'funnel':
        data = await analyticsService.getWorkflowFunnel(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );
        break;
      case 'productivity':
        data = await analyticsService.getCrewProductivity(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );
        break;
      case 'parsing':
        data = await analyticsService.getTaskParsingAccuracy(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: bottlenecks, funnel, productivity, or parsing' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('Workflow analytics API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}