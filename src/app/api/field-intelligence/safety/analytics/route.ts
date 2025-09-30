/**
 * @file src/app/api/field-intelligence/safety/analytics/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for safety analytics
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SafetyAnalyticsService } from '@/domains/field-intelligence/services/safety-analytics.service';
import { logger } from '@/core/logger/voice-logger';

/**
 * GET /api/field-intelligence/safety/analytics/completion?startDate=xxx&endDate=xxx
 * Get completion rate analytics
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const analyticsService = new SafetyAnalyticsService(supabase, companyId);
    const completionRate = await analyticsService.getCompletionRate(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return NextResponse.json({
      success: true,
      data: completionRate,
    });
  } catch (error: any) {
    logger.error('Safety analytics API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}