/**
 * @file /src/app/api/inventory/material-usage/route.ts
 * @phase 3.8
 * @domain Inventory
 * @purpose POST /api/inventory/material-usage - Record material consumption
 * @complexity_budget 150
 * @feature 004-voice-vision-inventory
 *
 * Request:
 * - materialId: string
 * - quantity: number
 * - jobId: string
 * - locationId?: string
 * - notes?: string
 * - voiceSessionId?: string
 *
 * Response:
 * - success: boolean
 * - transaction: InventoryTransaction | null
 * - updatedItem: InventoryItem | null
 * - error?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as materialUsageService from '@/domains/inventory/services/material-usage.service';

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
      materialId,
      quantity,
      jobId,
      locationId,
      notes,
      voiceSessionId,
    } = body;

    if (!materialId) {
      return NextResponse.json(
        { error: 'materialId is required' },
        { status: 400 }
      );
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be greater than 0' },
        { status: 400 }
      );
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    // Execute material usage recording
    const result = await materialUsageService.recordUsage({
      tenantId,
      userId: user.id,
      materialId,
      quantity,
      jobId,
      locationId,
      notes,
      voiceSessionId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message || 'Material usage recording failed',
          transaction: result.transaction,
          updatedItem: result.updatedItem,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      updatedItem: result.updatedItem,
    });
  } catch (error: any) {
    console.error('Material usage endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}