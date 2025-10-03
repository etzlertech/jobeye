/**
 * @file /src/app/api/vision/verifications/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint to list vision verifications
 * @complexity_budget 200
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import { VisionVerificationRepository } from '@/domains/vision/repositories/vision-verification.repository.class';
import { createSupabaseClient } from '@/lib/supabase/client';

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
    const kitId = searchParams.get('kitId');
    const verificationResult = searchParams.get('verificationResult') as 'complete' | 'incomplete' | 'failed' | null;
    const processingMethod = searchParams.get('processingMethod') as 'local_yolo' | 'cloud_vlm' | null;
    const verifiedAfter = searchParams.get('verifiedAfter');
    const verifiedBefore = searchParams.get('verifiedBefore');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate tenantId is provided
    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    // Initialize repository
    const supabase = createSupabaseClient();
    const verificationRepo = new VisionVerificationRepository(supabase);

    // Query verifications
    const filters = {
      tenantId,
      kitId: kitId || undefined,
      verificationResult: verificationResult || undefined,
      processingMethod: processingMethod || undefined,
      verifiedAfter: verifiedAfter || undefined,
      verifiedBefore: verifiedBefore || undefined
    };

    const verifications = await verificationRepo.findAll(filters, limit, offset);
    const count = await verificationRepo.count(filters);

    return NextResponse.json(
      {
        success: true,
        data: verifications,
        count: count,
        pagination: {
          limit,
          offset,
          hasMore: count > offset + limit
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