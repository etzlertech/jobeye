/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/intent/feedback/route.ts
 * phase: 3
 * domain: intent
 * purpose: API endpoint for submitting intent classification feedback
 * spec_ref: 007-mvp-intent-driven/contracts/intent-api.md
 * complexity_budget: 100
 * migrations_touched: ['041_intent_classifications.sql']
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.00 (no AI calls)"
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
 * voice_considerations: Feedback improves future voice+visual accuracy
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/intent/api/test_feedback_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for feedback',
 *   'Validate feedback data',
 *   'Update classification record',
 *   'Return success response'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { IntentClassificationService } from '@/domains/intent/services/intent-classification.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Request validation schema
const feedbackRequestSchema = z.object({
  classificationId: z.string().uuid('Invalid classification ID'),
  feedback: z.enum(['correct', 'incorrect']),
  correctedIntent: z.enum([
    'inventory_add', 'inventory_check',
    'job_create', 'job_assign', 'job_status',
    'load_verify', 'maintenance_report',
    'receipt_scan', 'unknown'
  ]).optional()
});

// Response schema
const feedbackResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  updatedClassification: z.object({
    id: z.string(),
    userFeedback: z.enum(['correct', 'incorrect']),
    correctedIntent: z.string().optional()
  })
});

export async function POST(req: NextRequest) {
  return withAuth(req, async (user, tenantId) => {
    let body: any;
    try {
      // Parse and validate request
      body = await req.json();
      const validatedData = feedbackRequestSchema.parse(body);

      // Validate that correctedIntent is provided when feedback is 'incorrect'
      if (validatedData.feedback === 'incorrect' && !validatedData.correctedIntent) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: 'correctedIntent is required when feedback is incorrect'
          },
          { status: 400 }
        );
      }

      // Initialize service
      const classificationService = new IntentClassificationService();

      // Process feedback
      await classificationService.processFeedback(
        validatedData.classificationId,
        tenantId,
        validatedData.feedback,
        validatedData.correctedIntent
      );

      // Build response
      const response = {
        success: true,
        message: 'Feedback processed successfully',
        updatedClassification: {
          id: validatedData.classificationId,
          userFeedback: validatedData.feedback,
          correctedIntent: validatedData.correctedIntent
        }
      };

      // Validate response
      const validatedResponse = feedbackResponseSchema.parse(response);

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

      // Handle offline queue error
      if (error instanceof Error && error.message === 'Feedback queued for sync') {
        return NextResponse.json(
          {
            success: true,
            message: 'Feedback queued for sync when online',
            updatedClassification: {
              id: body.classificationId,
              userFeedback: body.feedback,
              correctedIntent: body.correctedIntent
            }
          },
          { status: 202 } // Accepted for later processing
        );
      }

      // Handle other errors
      return handleApiError(error);
    }
  });
}