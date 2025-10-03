/**
 * @file /src/app/api/inventory/transfer/route.ts
 * @phase 3.8
 * @domain Inventory
 * @purpose POST /api/inventory/transfer - Transfer items between locations
 * @complexity_budget 150
 * @feature 004-voice-vision-inventory
 *
 * Request:
 * - itemIds: string[]
 * - fromLocationId: string
 * - toLocationId: string
 * - quantities?: Record<string, number>
 * - jobId?: string
 * - notes?: string
 * - voiceSessionId?: string
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
import * as transferService from '@/domains/inventory/services/transfer.service';

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
    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
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
      quantities,
      jobId,
      notes,
      voiceSessionId,
    } = body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds array is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!fromLocationId || !toLocationId) {
      return NextResponse.json(
        { error: 'fromLocationId and toLocationId are required' },
        { status: 400 }
      );
    }

    // Execute transfer
    const result = await transferService.transfer({
      tenantId,
      userId: user.id,
      itemIds,
      fromLocationId,
      toLocationId,
      quantities,
      jobId,
      notes,
      voiceSessionId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message || 'Transfer failed',
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
    console.error('Transfer endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}