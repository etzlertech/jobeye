/**
 * @file /src/app/api/vision/verifications/[id]/route.ts
 * @phase 3.4
 * @domain Vision
 * @purpose API endpoint to get single verification with detected items
 * @complexity_budget 200
 * @test_coverage ≥80%
 */

import { NextRequest, NextResponse } from 'next/server';
import { VisionVerificationRepository } from '@/domains/vision/repositories/vision-verification.repository.class';
import { DetectedItemRepository } from '@/domains/vision/repositories/detected-item.repository.class';
import { createSupabaseClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

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

    // Initialize repositories
    const supabase = createSupabaseClient();
    const verificationRepo = new VisionVerificationRepository(supabase);
    const detectedItemRepo = new DetectedItemRepository(supabase);

    // Get verification
    const verification = await verificationRepo.findById(verificationId);

    if (!verification) {
      return NextResponse.json(
        { error: 'Verification not found' },
        { status: 404 }
      );
    }

    // Get detected items for this verification
    const items = await detectedItemRepo.findByVerification(verificationId);

    // Get item statistics
    const stats = await detectedItemRepo.getVerificationStats(verificationId);

    return NextResponse.json(
      {
        success: true,
        data: {
          verification,
          detectedItems: items,
          statistics: stats || {
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