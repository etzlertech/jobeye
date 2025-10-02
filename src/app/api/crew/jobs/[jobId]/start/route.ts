/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/[jobId]/start/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for starting a job
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 150
 * migrations_touched: ['jobs']
 * state_machine: {
 *   transition: 'assigned->started'
 * }
 * estimated_llm_cost: {
 *   "POST": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/crew/services/crew-workflow.service',
 *     '@/lib/auth/with-auth',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: [],
 *   supabase: ['jobs', 'job_assignments']
 * }
 * exports: ['POST']
 * voice_considerations: Can be triggered by voice command
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/crew/api/test_jobs_start_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for job start',
 *   'Validate crew assignment',
 *   'Update job status',
 *   'Handle offline queueing'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { CrewWorkflowService } from '@/domains/crew/services/crew-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Request validation schema
const startJobRequestSchema = z.object({
  startPhotoUrl: z.string().url().optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }).optional()
});

// Response schema
const startJobResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  job: z.object({
    id: z.string(),
    status: z.string(),
    startedAt: z.string()
  }).optional(),
  offline: z.boolean().optional()
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
      const validatedData = startJobRequestSchema.parse(body);

      // Get crew ID from user metadata
      const crewId = user.app_metadata?.crew_id || user.id;

      // Initialize service
      const crewService = new CrewWorkflowService();

      // Start job
      const result = await crewService.startJob(
        jobId,
        crewId,
        tenantId,
        validatedData.startPhotoUrl
      );

      // Build response
      let response: any = {
        success: result.success,
        message: result.message
      };

      if (result.success) {
        response.job = {
          id: jobId,
          status: 'started',
          startedAt: new Date().toISOString()
        };

        // Check if offline
        if (result.message.includes('queued for sync')) {
          response.offline = true;
        }
      }

      // Validate response
      const validatedResponse = startJobResponseSchema.parse(response);

      return NextResponse.json(
        validatedResponse,
        { status: result.success ? 200 : 400 }
      );

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