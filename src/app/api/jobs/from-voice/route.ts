/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/jobs/from-voice/route.ts
 * phase: 4
 * domain: job
 * purpose: API endpoint for creating jobs from voice commands
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 100
 * dependencies:
 *   - internal: JobFromVoiceService, createServerClient
 *   - external: next
 * exports: POST
 * voice_considerations:
 *   - Process voice transcriptions for job creation
 *   - Return voice-friendly responses
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/app/api/jobs/from-voice/__tests__/route.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { JobFromVoiceService, VoiceJobCommand } from '@/domains/job/services/job-from-voice-service';
import { VoiceLogger } from '@/core/logger/voice-logger';

export async function POST(request: NextRequest) {
  const logger = new VoiceLogger();

  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          voice_response: 'Please sign in to create jobs'
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate voice command
    const command: VoiceJobCommand = {
      raw_transcript: body.transcript || '',
      intent: body.intent || 'create_job',
      entities: {
        job_type: body.job_type,
        customer_name: body.customer_name,
        property_address: body.property_address,
        date: body.date,
        time: body.time,
        duration: body.duration,
        notes: body.notes,
        container: body.container
      },
      confidence: body.confidence || 0.8,
      session_id: body.session_id
    };

    if (!command.raw_transcript && !command.entities.job_type) {
      return NextResponse.json(
        { 
          error: 'Invalid request',
          message: 'Either transcript or job_type is required',
          voice_response: 'Please specify what type of job you want to create'
        },
        { status: 400 }
      );
    }

    // Create job using voice service
    const jobService = new JobFromVoiceService(supabase, logger);
    const result = await jobService.createJobFromVoice(command, user.id);

    // Log API call
    await logger.info('Voice job creation API called', {
      userId: user.id,
      command,
      success: result.success
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        job_id: result.job_id,
        job_number: result.job_number,
        message: result.message,
        voice_response: result.voice_response
      }, { status: 201 });
    }

    // Handle confirmation needed cases
    if (result.confirmation_needed) {
      return NextResponse.json({
        success: false,
        needs_confirmation: true,
        confirmation_type: result.confirmation_needed.type,
        options: result.confirmation_needed.options,
        original_value: result.confirmation_needed.original_value,
        voice_response: result.voice_response
      }, { status: 200 });
    }

    // Handle failures
    return NextResponse.json({
      success: false,
      message: result.message,
      voice_response: result.voice_response
    }, { status: 400 });

  } catch (error) {
    await logger.error('Failed to create job from voice', error as Error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to process voice command',
        voice_response: 'Sorry, something went wrong. Please try again.'
      },
      { status: 500 }
    );
  }
}