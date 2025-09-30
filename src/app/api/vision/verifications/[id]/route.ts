/**
 * @file /src/app/api/vision/verifications/[id]/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint to get single verification with detected items
 * @complexity_budget 200
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import * as verificationRepo from '@/domains/vision/repositories/vision-verification.repository';
import * as detectedItemRepo from '@/domains/vision/repositories/detected-item.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const verificationId = params.id;

    // Get verification
    const verificationResult = await verificationRepo.findVerificationById(verificationId);

    if (verificationResult.error) {
      return NextResponse.json(
        { error: 'Failed to fetch verification', details: verificationResult.error.message },
        { status: 500 }
      );
    }

    if (!verificationResult.data) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // Get detected items for this verification
    const itemsResult = await detectedItemRepo.findItemsForVerification(verificationId);

    if (itemsResult.error) {
      return NextResponse.json(
        { error: 'Failed to fetch detected items', details: itemsResult.error.message },
        { status: 500 }
      );
    }

    // Get item statistics
    const statsResult = await detectedItemRepo.getItemStatsForVerification(verificationId);

    return NextResponse.json(
      {
        success: true,
        data: {
          verification: verificationResult.data,
          detectedItems: itemsResult.data || [],
          statistics: statsResult.data || {
            total: 0,
            matched: 0,
            unmatched: 0,
            uncertain: 0,
            avgConfidence: 0,
            itemTypes: []
          }
        }
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Verification detail API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}