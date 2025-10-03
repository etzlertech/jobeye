/**
 * @file /src/app/api/vision/cost/budget/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint for budget checking and alerts
 * @complexity_budget 150
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCostTrackingService } from '@/domains/vision/services/cost-tracking.service';

export const dynamic = "force-dynamic";

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
    const tenantId = searchParams.get('tenantId');
    const dailyBudgetUsd = searchParams.get('dailyBudgetUsd');
    const dailyRequestLimit = searchParams.get('dailyRequestLimit');

    // Validate tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    const service = getCostTrackingService();

    // Check budget
    const budgetCheck = await service.checkBudget(
      tenantId,
      dailyBudgetUsd ? parseFloat(dailyBudgetUsd) : undefined,
      dailyRequestLimit ? parseInt(dailyRequestLimit) : undefined
    );

    // Determine if critical alerts should be sent
    const shouldAlert = service.shouldSendAlert(budgetCheck.alerts);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...budgetCheck,
          shouldAlert
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Budget check API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}