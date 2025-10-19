/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/jobs/[jobId]/verify-checklist/route.ts
 * phase: 4
 * domain: job
 * purpose: API endpoint for verifying required tools/materials with vision
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 150
 * dependencies:
 *   - internal: ChecklistVerificationService, createServerClient
 *   - external: next
 * exports: POST
 * voice_considerations:
 *   - Return voice-friendly verification summaries
 *   - Support voice confirmations
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/app/api/jobs/[jobId]/verify-checklist/__tests__/route.test.ts
 * note: Route name preserved for backward compatibility; verifies required tools/materials for work orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ChecklistVerificationService } from '@/domains/job/services/checklist-verification-service';
import { VoiceLogger } from '@/core/logger/voice-logger';

interface RouteContext {
  params: {
    jobId: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const logger = new VoiceLogger();
  const { jobId } = params;

  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          voice_response: 'Please sign in to verify required items'
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Create verification service
    const verificationService = new ChecklistVerificationService(
      supabase,
      undefined,
      undefined,
      undefined,
      logger
    );

    // Handle manual override
    if (body.action === 'manual_override') {
      const { checklist_item_id, new_status, reason } = body;
      
      if (!checklist_item_id || !new_status || !reason) {
        return NextResponse.json(
          { 
            error: 'Missing required fields',
            message: 'checklist_item_id, new_status, and reason are required',
            voice_response: 'Please provide all required information for the override'
          },
          { status: 400 }
        );
      }

      const success = await verificationService.applyManualOverride({
        job_id: jobId,
        checklist_item_id,
        new_status,
        reason,
        user_id: user.id
      });

      return NextResponse.json({
        success,
        message: success ? 'Manual override applied' : 'Failed to apply override',
        voice_response: success 
          ? `Override applied successfully`
          : 'Unable to apply override'
      });
    }

    // Handle verification request
    const { media_id, frame_data, verification_mode = 'auto', confidence_threshold } = body;
    
    if (!media_id && !frame_data) {
      return NextResponse.json(
        { 
          error: 'Missing media',
          message: 'Either media_id or frame_data is required',
          voice_response: 'Please provide an image for verification'
        },
        { status: 400 }
      );
    }

    // Run verification
    const result = await verificationService.verifyChecklist({
      job_id: jobId,
      media_id,
      frame_data,
      verification_mode,
      confidence_threshold,
      user_id: user.id
    });

    // Log verification
    await logger.info('Required items verification completed', {
      jobId,
      verificationId: result.verification_id,
      completionPercentage: result.completion_percentage,
      userId: user.id
    });

    return NextResponse.json({
      verification_id: result.verification_id,
      job_id: result.job_id,
      overall_status: result.overall_status,
      completion_percentage: result.completion_percentage,
      voice_summary: result.voice_summary,
      verified_items: result.verified_items,
      missing_items: result.missing_items,
      unexpected_items: result.unexpected_items,
      containers_detected: result.containers_detected,
      suggestions: result.suggestions
    });

  } catch (error) {
    await logger.error('Failed to verify required items', error as Error, { jobId });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to verify required items',
        voice_response: 'Sorry, verification failed. Please try again.'
      },
      { status: 500 }
    );
  }
}