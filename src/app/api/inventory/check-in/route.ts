/**
 * @file /src/app/api/inventory/check-in/route.ts
 * @phase 3.8
 * @domain Inventory
 * @purpose POST /api/inventory/check-in - Check in equipment/materials
 * @complexity_budget 150
 * @feature 004-voice-vision-inventory
 *
 * Request:
 * - itemIds: string[]
 * - fromLocationId?: string
 * - toLocationId?: string
 * - jobId?: string
 * - quantities?: Record<string, number>
 * - conditions?: Record<string, ItemStatus>
 * - notes?: string
 * - voiceSessionId?: string
 * - detectionSessionId?: string
 *
 * Response:
 * - success: boolean
 * - transactions: InventoryTransaction[]
 * - updatedItems: InventoryItem[]
 * - closedAssignments: string[]
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as checkInService from '@/domains/inventory/services/check-in.service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = createClient();
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
      fromLocationId,
      toLocationId,
      jobId,
      quantities,
      conditions,
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

    // Execute check-in
    const result = await checkInService.checkIn({
      companyId,
      userId: user.id,
      itemIds,
      fromLocationId,
      toLocationId,
      jobId,
      quantities,
      conditions,
      notes,
      voiceSessionId,
      detectionSessionId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message || 'Check-in failed',
          transactions: result.transactions,
          updatedItems: result.updatedItems,
          closedAssignments: result.closedAssignments,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transactions: result.transactions,
      updatedItems: result.updatedItems,
      closedAssignments: result.closedAssignments,
    });
  } catch (error: any) {
    console.error('Check-in endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}