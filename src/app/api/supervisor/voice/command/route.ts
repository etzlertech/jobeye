/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/voice/command/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoint for processing supervisor voice commands
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 150
 * migrations_touched: ['ai_interaction_logs']
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.02-0.05 (STT + LLM + TTS)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '@/domains/supervisor/services/supervisor-workflow.service',
 *     '@/domains/intent/services/voice-command.service',
 *     '@/lib/auth/with-auth',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: [],
 *   supabase: ['ai_interaction_logs']
 * }
 * exports: ['POST']
 * voice_considerations: Core voice interaction endpoint
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/supervisor/api/test_voice_command_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for voice commands',
 *   'Process with voice service',
 *   'Execute resulting actions',
 *   'Return voice response'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupervisorWorkflowService } from '@/domains/supervisor/services/supervisor-workflow.service';
import { VoiceCommandService } from '@/domains/intent/services/voice-command.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

// Request validation schema
const voiceCommandRequestSchema = z.object({
  transcript: z.string().min(1).max(1000),
  context: z.object({
    currentPage: z.string().optional(),
    activeJobId: z.string().optional(),
    previousCommands: z.array(z.string()).optional()
  }).optional()
});

// Response schema
const voiceCommandResponseSchema = z.object({
  success: z.boolean(),
  response: z.object({
    text: z.string(),
    audioUrl: z.string().optional(),
    intent: z.string(),
    confidence: z.number(),
    actions: z.array(z.object({
      type: z.enum(['navigate', 'update', 'create', 'show']),
      target: z.string(),
      parameters: z.record(z.any())
    })).optional()
  }),
  metadata: z.object({
    processingTimeMs: z.number(),
    modelUsed: z.string(),
    costUsd: z.number()
  })
});

export async function POST(req: NextRequest) {
  return withAuth(req, async (user, tenantId) => {
    try {
      // Check role permission
      const userRole = user.app_metadata?.role;
      if (userRole !== 'supervisor' && userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Parse and validate request
      const body = await req.json();
      const validatedData = voiceCommandRequestSchema.parse(body);

      // Initialize services
      const voiceService = new VoiceCommandService();
      const supabase = await createServerClient();
      const supervisorService = new SupervisorWorkflowService(supabase);

      // Process voice command
      const voiceResult = await voiceService.processCommand({
        transcript: validatedData.transcript,
        userId: user.id,
        tenantId,
        context: {
          role: 'supervisor',
          ...validatedData.context
        }
      });

      // Execute workflow based on intent
      let workflowResult;
      if (voiceResult.response.actions && voiceResult.response.actions.length > 0) {
        workflowResult = await supervisorService.processVoiceCommand(
          validatedData.transcript,
          tenantId,
          user.id,
          validatedData.context
        );
      }

      // Build response
      const response = {
        success: true,
        response: {
          text: voiceResult.response.text,
          audioUrl: voiceResult.response.audioUrl,
          intent: voiceResult.intent,
          confidence: voiceResult.confidence,
          actions: voiceResult.response.actions
        },
        metadata: {
          processingTimeMs: voiceResult.metadata.processingTimeMs,
          modelUsed: 'gpt-3.5-turbo',
          costUsd: 0.04 // Estimated total cost
        }
      };

      // Validate response
      const validatedResponse = voiceCommandResponseSchema.parse(response);

      return NextResponse.json(validatedResponse, { status: 200 });

    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: error.errors
          },
          { status: 400 }
        );
      }

      // Handle other errors
      return handleApiError(error);
    }
  });
}
