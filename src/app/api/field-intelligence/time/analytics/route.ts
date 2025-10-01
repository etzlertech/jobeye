/**
 * @file src/app/api/field-intelligence/time/analytics/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for time tracking analytics
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TimeAnalyticsService } from '@/domains/field-intelligence/services/time-analytics.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = "force-dynamic";

/**
 * GET /api/field-intelligence/time/analytics?type=xxx&startDate=xxx&endDate=xxx
 * Get time tracking analytics
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
    const type = searchParams.get('type') || 'utilization';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const hourlyRate = parseFloat(searchParams.get('hourlyRate') || '25');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const analyticsService = new TimeAnalyticsService(supabase, companyId);

    let data;
    switch (type) {
      case 'utilization':
        data = await analyticsService.getLaborUtilization(
          new Date(startDate),
          new Date(endDate)
        );
        break;
      case 'overtime':
        data = await analyticsService.getOvertimeCostAnalysis(
          new Date(startDate),
          new Date(endDate),
          hourlyRate
        );
        break;
      case 'productivity':
        data = await analyticsService.getProductivityMetrics(
          new Date(startDate),
          new Date(endDate)
        );
        break;
      case 'forecast':
        data = await analyticsService.forecastLaborCosts(
          new Date(startDate),
          new Date(endDate),
          hourlyRate
        );
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: utilization, overtime, productivity, or forecast' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('Time analytics API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}