/**
 * @file /src/app/api/vision/batch-verify/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint for batch kit verification
 * @complexity_budget 300
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBatchVerificationService } from '@/domains/vision/services/batch-verification.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      tenantId,
      items,
      maxBudgetUsd = 10.0,
      maxRequestsPerDay = 100,
      stopOnError = false,
      concurrency = 3
    } = body;

    // Validate required fields
    if (!tenantId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: tenantId, items (array)'
        },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Items array cannot be empty'
        },
        { status: 400 }
      );
    }

    if (items.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum 50 items per batch'
        },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.kitId || !item.imageData || !item.expectedItems) {
        return NextResponse.json(
          {
            success: false,
            error: 'Each item must have kitId, imageData, and expectedItems'
          },
          { status: 400 }
        );
      }
    }

    // Convert imageData arrays back to ImageData objects
    const processedItems = items.map((item: any) => {
      // Reconstruct ImageData from array
      const dataArray = new Uint8ClampedArray(item.imageData.data);
      const imageData = new ImageData(
        dataArray,
        item.imageData.width,
        item.imageData.height
      );

      return {
        kitId: item.kitId,
        imageData,
        expectedItems: item.expectedItems
      };
    });

    // Call batch verification service
    const service = getBatchVerificationService();
    const result = await service.verifyBatch({
      tenantId,
      items: processedItems,
      maxBudgetUsd,
      maxRequestsPerDay,
      stopOnError,
      concurrency
    });

    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          error: result.error.message,
          data: result.data // Include partial results if available
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error('Batch verification API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}