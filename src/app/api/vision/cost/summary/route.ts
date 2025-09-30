/**
 * @file /src/app/api/vision/cost/summary/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint for cost summary and analytics
 * @complexity_budget 200
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCostTrackingService } from '@/domains/vision/services/cost-tracking.service';

export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const breakdown = searchParams.get('breakdown'); // 'provider' or 'daily'

    // Validate companyId
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId query parameter is required' },
        { status: 400 }
      );
    }

    const service = getCostTrackingService();

    // Get base summary
    const summary = await service.getTodayCostSummary(companyId);

    // Get optional breakdowns
    let providerBreakdown = null;
    let dailyBreakdown = null;

    if (breakdown === 'provider' || breakdown === 'all') {
      providerBreakdown = await service.getCostBreakdownByProvider(
        companyId,
        startDate || undefined,
        endDate || undefined
      );
    }

    if (breakdown === 'daily' || breakdown === 'all') {
      if (startDate && endDate) {
        dailyBreakdown = await service.getDailyCostSummaries(
          companyId,
          startDate,
          endDate
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          summary,
          providerBreakdown,
          dailyBreakdown
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Cost summary API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}