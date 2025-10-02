/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/intent/classify/route.ts
 * phase: 3
 * domain: intent
 * purpose: API endpoint for intent classification from camera images
 * spec_ref: 007-mvp-intent-driven/contracts/intent-api.md
 * complexity_budget: 150
 * migrations_touched: ['041_intent_classifications.sql']
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.02-0.05 (VLM inference)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/intent/services/intent-classification.service',
 *     '@/lib/auth/with-auth',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: [],
 *   supabase: ['intent_classifications']
 * }
 * exports: ['POST']
 * voice_considerations: Can include voice transcript for better accuracy
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/intent/api/test_classify_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for intent classification',
 *   'Add request validation',
 *   'Handle offline queueing',
 *   'Return structured response'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { IntentClassificationService } from '@/domains/intent/services/intent-classification.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Request validation schema
const classifyRequestSchema = z.object({
  image: z.string().min(1, 'Image data is required'),
  context: z.object({
    currentPage: z.string().optional(),
    previousIntent: z.string().optional(),
    timeOfDay: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),
  voiceTranscript: z.string().optional()
});

// Response schema matching contract
const classifyResponseSchema = z.object({
  classification: z.object({
    id: z.string(),
    intent: z.enum([
      'inventory_add', 'inventory_check',
      'job_create', 'job_assign', 'job_status',
      'load_verify', 'maintenance_report',
      'receipt_scan', 'unknown'
    ]),
    confidence: z.number().min(0).max(1),
    requiresConfirmation: z.boolean(),
    suggestedAction: z.string().optional(),
    detectedEntities: z.array(z.string()).optional()
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
      // Parse and validate request
      const body = await req.json();
      const validatedData = classifyRequestSchema.parse(body);

      // Convert base64 image to blob
      const imageBlob = await base64ToBlob(validatedData.image);

      // Initialize service
      const classificationService = new IntentClassificationService();

      // Add user role to context
      const context = {
        ...validatedData.context,
        userRole: user.app_metadata?.role || 'crew'
      };

      // Classify intent
      const result = await classificationService.classifyIntent({
        imageBlob,
        userId: user.id,
        tenantId,
        context,
        voiceTranscript: validatedData.voiceTranscript
      });

      // Build response
      const response = {
        classification: {
          id: result.id,
          intent: result.intent,
          confidence: result.confidence,
          requiresConfirmation: result.requiresConfirmation,
          suggestedAction: result.suggestedAction,
          detectedEntities: result.detectedEntities
        },
        metadata: {
          processingTimeMs: Date.now(),
          modelUsed: 'gpt-4-vision-preview',
          costUsd: 0.03 // Estimated
        }
      };

      // Validate response
      const validatedResponse = classifyResponseSchema.parse(response);

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

// Utility function to convert base64 to blob
async function base64ToBlob(base64: string): Promise<Blob> {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  
  // Convert to binary
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Detect MIME type
  const mimeType = detectMimeType(bytes);
  
  return new Blob([bytes], { type: mimeType });
}

// Simple MIME type detection
function detectMimeType(bytes: Uint8Array): string {
  // Check magic numbers
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
  
  return 'image/jpeg'; // Default
}