/**
 * @file /src/app/api/inventory/check-out/route.ts
 * @phase 3.8
 * @domain Inventory
 * @purpose POST /api/inventory/check-out - Check out equipment/materials
 * @complexity_budget 150
 * @feature 004-voice-vision-inventory
 *
 * Request:
 * - itemIds: string[]
 * - jobId?: string
 * - locationId?: string
 * - quantities?: Record<string, number>
 * - notes?: string
 * - voiceSessionId?: string
 * - detectionSessionId?: string
 *
 * Response:
 * - success: boolean
 * - transactions: InventoryTransaction[]
 * - updatedItems: InventoryItem[]
 * - containerAssignments: ContainerAssignment[]
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as checkOutService from '@/domains/inventory/services/check-out.service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get company ID from user metadata
    const companyId = user.app_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID not found in user metadata' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      itemIds,
      jobId,
      locationId,
      quantities,
      notes,
      voiceSessionId,
      detectionSessionId,
    } = body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Execute check-out
    const result = await checkOutService.checkOut({
      companyId,
      userId: user.id,
      itemIds,
      jobId,
      locationId,
      quantities,
      notes,
      voiceSessionId,
      detectionSessionId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message || 'Check-out failed',
          transactions: result.transactions,
          updatedItems: result.updatedItems,
          containerAssignments: result.containerAssignments,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transactions: result.transactions,
      updatedItems: result.updatedItems,
      containerAssignments: result.containerAssignments,
    });
  } catch (error: any) {
    console.error('Check-out endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}