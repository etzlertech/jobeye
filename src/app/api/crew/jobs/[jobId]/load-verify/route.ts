/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/[jobId]/load-verify/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for verifying equipment load
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 200
 * migrations_touched: ['jobs']
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.02-0.05 (VLM for verification)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/crew/services/crew-workflow.service',
 *     '@/lib/auth/with-auth',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: [],
 *   supabase: ['jobs', 'job_equipment']
 * }
 * exports: ['POST']
 * voice_considerations: Can announce verification results
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/crew/api/test_load_verify_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for load verification',
 *   'Support both AI and manual verification',
 *   'Update job verification status',
 *   'Return verification results'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { CrewWorkflowService } from '@/domains/crew/services/crew-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Request validation schema
const loadVerifyRequestSchema = z.object({
  method: z.enum(['ai_vision', 'manual']),
  photoData: z.string().optional(), // Base64 image for AI verification
  manualItems: z.array(z.string()).optional(), // Item IDs for manual verification
  notes: z.string().max(500).optional()
});

// Response schema
const loadVerifyResponseSchema = z.object({
  verified: z.boolean(),
  method: z.enum(['ai_vision', 'manual', 'voice']),
  verifiedItems: z.array(z.string()),
  missingItems: z.array(z.string()),
  confidence: z.number().optional(),
  photoUrl: z.string().optional(),
  message: z.string(),
  costUsd: z.number().optional()
});

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  return withAuth(req, async (user, tenantId) => {
    try {
      // Check role permission
      const userRole = user.app_metadata?.role;
      if (userRole !== 'crew' && userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Validate job ID
      const jobIdSchema = z.string().uuid();
      const jobId = jobIdSchema.parse(params.jobId);

      // Parse and validate request
      const body = await req.json();
      const validatedData = loadVerifyRequestSchema.parse(body);

      // Validate method-specific requirements
      if (validatedData.method === 'ai_vision' && !validatedData.photoData) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: 'photoData is required for AI vision verification'
          },
          { status: 400 }
        );
      }

      if (validatedData.method === 'manual' && !validatedData.manualItems) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: 'manualItems is required for manual verification'
          },
          { status: 400 }
        );
      }

      // Get crew ID from user metadata
      const crewId = user.app_metadata?.crew_id || user.id;

      // Initialize service
      const crewService = new CrewWorkflowService();

      // Perform verification
      let result;
      if (validatedData.method === 'ai_vision' && validatedData.photoData) {
        // Convert base64 to blob
        const photoBlob = await base64ToBlob(validatedData.photoData);
        result = await crewService.verifyLoad(
          jobId,
          photoBlob,
          crewId,
          tenantId
        );
      } else {
        // Manual verification
        result = await crewService.verifyLoad(
          jobId,
          new Blob(), // Empty blob for manual
          crewId,
          tenantId,
          validatedData.manualItems
        );
      }

      // Build response
      const response = {
        verified: result.verified,
        method: result.method,
        verifiedItems: result.verifiedItems,
        missingItems: result.missingItems,
        confidence: result.confidence,
        photoUrl: result.photoUrl,
        message: result.verified 
          ? 'All equipment verified successfully'
          : `Missing items: ${result.missingItems.join(', ')}`,
        costUsd: validatedData.method === 'ai_vision' ? 0.03 : undefined
      };

      // Validate response
      const validatedResponse = loadVerifyResponseSchema.parse(response);

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
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: 'image/jpeg' });
}