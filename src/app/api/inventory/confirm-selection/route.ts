/**
 * @file /src/app/api/inventory/confirm-selection/route.ts
 * @phase 3.8
 * @domain Inventory
 * @purpose POST /api/inventory/confirm-selection - Confirm user selections from detection
 * @complexity_budget 150
 * @feature 004-voice-vision-inventory
 *
 * Request:
 * - sessionId: string
 * - selectedCandidateIds: string[]
 *
 * Response:
 * - success: boolean
 * - message: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as detectionOrchestratorService from '@/domains/inventory/services/detection-orchestrator.service';

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

    // Parse request body
    const body = await request.json();
    const { sessionId, selectedCandidateIds } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(selectedCandidateIds)) {
      return NextResponse.json(
        { error: 'selectedCandidateIds must be an array' },
        { status: 400 }
      );
    }

    // Confirm selections
    const result = await detectionOrchestratorService.confirmSelections(
      sessionId,
      selectedCandidateIds
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Confirmed ${selectedCandidateIds.length} selection${selectedCandidateIds.length !== 1 ? 's' : ''}`,
    });
  } catch (error: any) {
    console.error('Confirm selection endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}