/**
 * @file /src/app/api/vision/verify/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint for vision-based kit verification
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVisionVerificationService } from '@/domains/vision/services/vision-verification.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { kitId, tenantId, imageData, expectedItems, maxBudgetUsd, maxRequestsPerDay } = body;

    // Validate required fields
    if (!kitId || !tenantId || !imageData || !expectedItems) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'kitId, tenantId, imageData, and expectedItems are required'
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(expectedItems)) {
      return NextResponse.json(
        { error: 'expectedItems must be an array' },
        { status: 400 }
      );
    }

    // Convert base64 image to ImageData if needed
    let processedImageData: ImageData;
    if (typeof imageData === 'string') {
      // For now, we'll accept the base64 string and the service will handle it
      // In production, you'd decode it here
      processedImageData = imageData as any;
    } else if (imageData.width && imageData.height && imageData.data) {
      processedImageData = imageData;
    } else {
      return NextResponse.json(
        { error: 'Invalid imageData format' },
        { status: 400 }
      );
    }

    // Call verification service
    const service = getVisionVerificationService();
    const result = await service.verifyKit({
      kitId,
      tenantId,
      imageData: processedImageData,
      expectedItems,
      maxBudgetUsd,
      maxRequestsPerDay
    });

    if (result.error) {
      const statusCode = result.error.code === 'BUDGET_EXCEEDED' || result.error.code === 'REQUEST_LIMIT_REACHED'
        ? 429
        : 500;

      return NextResponse.json(
        {
          error: result.error.message,
          code: result.error.code,
          details: result.error.details
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Vision verification API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}