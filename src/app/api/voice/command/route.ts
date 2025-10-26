/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/voice/command/route.ts
 * phase: 3
 * domain: voice
 * purpose: Unified voice command API endpoint for voice-to-CRUD operations
 * spec_ref: voice-to-crud-plan.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.00015 (Gemini Intent) + $0.015 (TTS) = ~$0.015 per request"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '@/domains/intent/services/gemini-intent.service',
 *     '@/domains/inventory/services/inventory-voice-orchestrator.service',
 *     '@/domains/voice/services/speech-to-text-service',
 *     '@/domains/voice/services/text-to-speech-service',
 *     '@/lib/auth/context',
 *     '@/core/errors/error-handler'
 *   ]
 * }
 * exports: ['POST']
 * voice_considerations: |
 *   Unified endpoint replacing crew/supervisor-specific routes.
 *   Prioritizes browser STT for cost savings.
 *   Handles multi-turn clarification loops.
 * test_requirements: {
 *   coverage: 90,
 *   integration_tests: 'tests/integration/voice-command-api.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler with audio/transcript support',
 *   'Add browser STT preference with Whisper fallback',
 *   'Integrate GeminiIntentService',
 *   'Call InventoryVoiceOrchestrator for execution',
 *   'Generate TTS response',
 *   'Handle clarification loops'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/auth/context';
import { GeminiIntentService } from '@/domains/intent/services/gemini-intent.service';
import { InventoryVoiceOrchestrator } from '@/domains/inventory/services/inventory-voice-orchestrator.service';
import { SpeechToTextService, STTProvider } from '@/domains/voice/services/speech-to-text-service';
import { TextToSpeechService } from '@/domains/voice/services/text-to-speech-service';
import { handleApiError } from '@/core/errors/error-handler';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Request validation schema
const voiceCommandRequestSchema = z.object({
  // Either audio OR transcript must be provided
  audio: z.string().optional(), // Base64-encoded audio
  transcript: z.string().min(1).max(1000).optional(),

  // Context
  context: z.object({
    role: z.enum(['supervisor', 'crew']).optional(),
    currentPage: z.string().optional(),
    activeJobId: z.string().optional(),
    previousCommands: z.array(z.string()).optional(),
  }).optional(),

  // Conversation tracking
  conversation_id: z.string().optional(),

  // Settings
  settings: z.object({
    use_browser_stt: z.boolean().optional(),
    auto_speak: z.boolean().optional(),
    language: z.string().optional(),
  }).optional(),
}).refine(
  data => data.audio || data.transcript,
  { message: 'Either audio or transcript must be provided' }
);

// Response schema
const voiceCommandResponseSchema = z.object({
  success: z.boolean(),
  transcript: z.string(),
  intent: z.string(),
  confidence: z.number(),
  needs_clarification: z.boolean(),
  follow_up: z.string().optional(),
  action: z.object({
    executed: z.boolean(),
    result: z.any().optional(),
  }).optional(),
  response: z.object({
    text: z.string(),
    audioUrl: z.string().optional(),
  }),
  conversation_id: z.string().optional(),
  turn_number: z.number().optional(),
  metadata: z.object({
    processingTimeMs: z.number(),
    sttDuration: z.number(),
    intentDuration: z.number(),
    actionDuration: z.number(),
    ttsDuration: z.number(),
    costUsd: z.number(),
    sttProvider: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const timings = {
    sttDuration: 0,
    intentDuration: 0,
    actionDuration: 0,
    ttsDuration: 0,
  };

  try {
    // Get auth context
    const context = await getRequestContext(req);
    if (!context.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user, tenantId, isCrew, isSupervisor } = context;

    // Parse and validate request
    const body = await req.json();
    const validatedData = voiceCommandRequestSchema.parse(body);

    // Determine user role
    const userRole = validatedData.context?.role || (isCrew ? 'crew' : 'supervisor');

    // Step 1: Speech-to-Text (if audio provided)
    let transcript = validatedData.transcript || '';
    let sttProvider: STTProvider | undefined;

    if (validatedData.audio && !validatedData.transcript) {
      const sttStart = Date.now();

      // Decode base64 audio to blob
      const audioBlob = base64ToBlob(validatedData.audio);

      // Use browser STT preference or fallback to Whisper
      const preferBrowserSTT = validatedData.settings?.use_browser_stt !== false;
      sttProvider = preferBrowserSTT ? STTProvider.BROWSER_API : STTProvider.OPENAI_WHISPER;

      const sttService = new SpeechToTextService();
      const sttResult = await sttService.transcribe(audioBlob, {
        language: validatedData.settings?.language || 'en-US',
        provider: sttProvider,
      });

      transcript = sttResult.text;
      timings.sttDuration = Date.now() - sttStart;
    }

    // Step 2: Intent Classification
    const intentStart = Date.now();
    const intentService = new GeminiIntentService();

    const intentResult = await intentService.classifyIntent({
      transcript,
      context: {
        userRole,
        currentPage: validatedData.context?.currentPage,
        previousIntent: undefined, // TODO: Load from conversation context
      },
      conversation_context: validatedData.conversation_id
        ? intentService.getConversationContext(validatedData.conversation_id)
        : undefined,
    });

    timings.intentDuration = Date.now() - intentStart;

    // Step 3: If needs clarification, return early
    if (intentResult.needs_clarification) {
      // Generate TTS response for follow-up question
      const ttsStart = Date.now();
      const ttsService = new TextToSpeechService();
      const audioUrl = await ttsService.speak(intentResult.follow_up || 'Could you clarify that?');
      timings.ttsDuration = Date.now() - ttsStart;

      const response = {
        success: true,
        transcript,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        needs_clarification: true,
        follow_up: intentResult.follow_up,
        response: {
          text: intentResult.follow_up || 'Could you clarify that?',
          audioUrl,
        },
        conversation_id: intentResult.conversation_id,
        turn_number: intentResult.turn_number,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          ...timings,
          costUsd: intentResult.cost_usd,
          sttProvider: sttProvider?.toString(),
        },
      };

      return NextResponse.json(voiceCommandResponseSchema.parse(response), { status: 200 });
    }

    // Step 4: Execute action via orchestrator
    const actionStart = Date.now();
    const orchestrator = new InventoryVoiceOrchestrator();

    const actionResult = await orchestrator.executeIntent(
      intentResult,
      user.id,
      tenantId,
      validatedData.conversation_id
    );

    timings.actionDuration = Date.now() - actionStart;

    // Step 5: Generate TTS response
    const ttsStart = Date.now();
    const ttsService = new TextToSpeechService();
    const audioUrl = await ttsService.speak(actionResult.response_text);
    timings.ttsDuration = Date.now() - ttsStart;

    // Step 6: Build and return response
    const totalCost = intentResult.cost_usd + (sttProvider === STTProvider.OPENAI_WHISPER ? 0.006 : 0) + 0.015;

    const response = {
      success: actionResult.success,
      transcript,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      needs_clarification: false,
      action: {
        executed: actionResult.success,
        result: actionResult.data,
      },
      response: {
        text: actionResult.response_text,
        audioUrl,
      },
      conversation_id: intentResult.conversation_id,
      turn_number: intentResult.turn_number,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        ...timings,
        costUsd: totalCost,
        sttProvider: sttProvider?.toString(),
      },
    };

    return NextResponse.json(voiceCommandResponseSchema.parse(response), { status: 200 });

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

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string): Blob {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:audio\/\w+;base64,/, '');

  // Convert base64 to binary
  const binaryString = Buffer.from(base64Data, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: 'audio/webm' });
}
