/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/jobs/[jobId]/assign/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoint for assigning crew to jobs
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 150
 * migrations_touched: ['job_assignments']
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/supervisor/services/supervisor-workflow.service',
 *     '@/lib/auth/with-auth',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: [],
 *   supabase: ['job_assignments', 'jobs']
 * }
 * exports: ['POST']
 * voice_considerations: Can be triggered by voice commands
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/supervisor/api/test_jobs_assign_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for crew assignment',
 *   'Validate job exists and crew limits',
 *   'Create assignments',
 *   'Return assignment result'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupervisorWorkflowService } from '@/domains/supervisor/services/supervisor-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Request validation schema
const assignRequestSchema = z.object({
  crewIds: z.array(z.string().uuid()).min(1, 'At least one crew member required')
});

// Response schema
const assignResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  assignments: z.array(z.object({
    jobId: z.string(),
    crewId: z.string(),
    assignedAt: z.string()
  })).optional(),
  crewLimitViolations: z.array(z.object({
    crewId: z.string(),
    currentJobs: z.number(),
    limit: z.number()
  })).optional()
});

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

      // Validate job ID
      const jobIdSchema = z.string().uuid();
      const jobId = jobIdSchema.parse(params.jobId);

      // Parse and validate request
      const body = await req.json();
      const validatedData = assignRequestSchema.parse(body);

      // Initialize service
      const supervisorService = new SupervisorWorkflowService();

      // Assign crew to job
      const result = await supervisorService.assignCrewToJob(
        jobId,
        validatedData.crewIds,
        tenantId,
        user.id
      );

      // Build response based on result
      let response: any = {
        success: result.success,
        message: result.message
      };

      if (result.success && result.data) {
        // Successfully assigned
        response.assignments = validatedData.crewIds.map(crewId => ({
          jobId: result.data.jobId,
          crewId,
          assignedAt: new Date().toISOString()
        }));
      } else if (!result.success && result.action === 'crew_limit_exceeded') {
        // Crew limit violations
        response.crewLimitViolations = result.data;
      }

      // Validate response
      const validatedResponse = assignResponseSchema.parse(response);

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