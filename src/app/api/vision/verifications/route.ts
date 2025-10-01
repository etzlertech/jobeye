/**
 * @file /src/app/api/vision/verifications/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint to list vision verifications
 * @complexity_budget 200
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import * as verificationRepo from '@/domains/vision/repositories/vision-verification.repository';

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
    const companyId = searchParams.get('companyId');
    const kitId = searchParams.get('kitId');
    const verificationResult = searchParams.get('verificationResult') as 'complete' | 'incomplete' | 'failed' | null;
    const processingMethod = searchParams.get('processingMethod') as 'local_yolo' | 'cloud_vlm' | null;
    const verifiedAfter = searchParams.get('verifiedAfter');
    const verifiedBefore = searchParams.get('verifiedBefore');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate companyId is provided
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId query parameter is required' },
        { status: 400 }
      );
    }

    // Query verifications
    const result = await verificationRepo.findVerifications({
      companyId,
      kitId: kitId || undefined,
      verificationResult: verificationResult || undefined,
      processingMethod: processingMethod || undefined,
      verifiedAfter: verifiedAfter || undefined,
      verifiedBefore: verifiedBefore || undefined,
      limit,
      offset
    });

    if (result.error) {
      return NextResponse.json(
        { error: 'Failed to fetch verifications', details: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data || [],
        count: result.count || 0,
        pagination: {
          limit,
          offset,
          hasMore: (result.count || 0) > offset + limit
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Verifications list API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}