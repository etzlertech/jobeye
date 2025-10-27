/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/voice/confirm/route.ts
 * phase: 3
 * domain: voice
 * purpose: Voice confirmation endpoint for yes/no responses
 * spec_ref: voice-to-crud-plan.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.00010 (Gemini Confirmation) + $0.015 (TTS) = ~$0.015 per request"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '@/domains/intent/services/gemini-confirmation.service',
 *     '@/domains/inventory/services/inventory-voice-orchestrator.service',
 *     '@/domains/voice/services/text-to-speech-service',
 *     '@/lib/auth/context',
 *     '@/core/errors/error-handler'
 *   ]
 * }
 * exports: ['POST']
 * voice_considerations: |
 *   Lightweight endpoint for processing confirmations.
 *   Uses cached responses for common yes/no phrases.
 * test_requirements: {
 *   coverage: 90,
 *   integration_tests: 'tests/integration/voice-confirmation-api.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for confirmations',
 *   'Use GeminiConfirmationService',
 *   'Execute original intent if confirmed',
 *   'Generate TTS response'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/auth/context';
import { GeminiConfirmationService } from '@/domains/intent/services/gemini-confirmation.service';
import { InventoryVoiceOrchestrator } from '@/domains/inventory/services/inventory-voice-orchestrator.service';
import { VoiceIntentResult } from '@/domains/intent/types/voice-intent-types';
import { handleApiError } from '@/core/errors/error-handler';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Request validation schema
const confirmationRequestSchema = z.object({
  transcript: z.string().min(1).max(100),
  previous_intent: z.object({
    intent: z.string(),
    entities: z.record(z.any()).optional(), // Optional - may be undefined
    confidence: z.number(),
    conversation_id: z.string().optional(),
  }),
  confirmation_question: z.string(),
  conversation_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Get auth context
    const context = await getRequestContext(req);
    if (!context.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, tenantId } = context;

    // Parse and validate request
    const body = await req.json();
    const validatedData = confirmationRequestSchema.parse(body);

    // Step 1: Process confirmation
    const confirmationService = new GeminiConfirmationService();
    const confirmationResult = await confirmationService.processConfirmation({
      transcript: validatedData.transcript,
      previous_intent: validatedData.previous_intent as VoiceIntentResult,
      confirmation_question: validatedData.confirmation_question,
    });

    // Step 2: If unclear, ask again
    if (confirmationResult.interpretation === 'unclear') {
      return NextResponse.json({
        success: false,
        confirmed: false,
        interpretation: 'unclear',
        response: {
          text: 'Sorry, I didn\'t catch that. Please say yes or no.',
          // audioUrl is optional - client handles TTS
        },
        metadata: {
          processingTimeMs: Date.now() - startTime,
        },
      }, { status: 200 });
    }

    // Step 3: If not confirmed, return cancellation message
    if (!confirmationResult.confirmed) {
      return NextResponse.json({
        success: true,
        confirmed: false,
        interpretation: 'no',
        response: {
          text: 'Okay, action cancelled.',
          // audioUrl is optional - client handles TTS
        },
        metadata: {
          processingTimeMs: Date.now() - startTime,
        },
      }, { status: 200 });
    }

    // Step 4: Execute the original intent
    const orchestrator = new InventoryVoiceOrchestrator();
    const actionResult = await orchestrator.executeIntent(
      validatedData.previous_intent as VoiceIntentResult,
      user.id,
      tenantId,
      validatedData.conversation_id
    );

    // Step 5: Return result (client handles TTS)
    return NextResponse.json({
      success: actionResult.success,
      confirmed: true,
      interpretation: 'yes',
      action: {
        executed: actionResult.success,
        result: actionResult.data,
      },
      response: {
        text: actionResult.response_text,
        // audioUrl is optional - client handles TTS
      },
      metadata: {
        processingTimeMs: Date.now() - startTime,
      },
    }, { status: 200 });

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return handleApiError(error);
  }
}
