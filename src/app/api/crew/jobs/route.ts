/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for getting crew member's assigned jobs
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 150
 * migrations_touched: ['jobs', 'job_assignments']
 * state_machine: null
 * estimated_llm_cost: {
 *   "GET": "$0.00 (no AI calls)"
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
 * exports: ['GET']
 * voice_considerations: Job list can be read via voice
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/crew/api/test_jobs_get_contract.test.ts'
 * }
 * tasks: [
 *   'Implement GET handler for crew jobs',
 *   'Support date filtering',
 *   'Include job details and equipment',
 *   'Return formatted job list'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { CrewWorkflowService } from '@/domains/crew/services/crew-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Query params schema
const jobsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// Response schema
const jobsResponseSchema = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    customerName: z.string(),
    propertyAddress: z.string(),
    scheduledTime: z.string(),
    status: z.enum(['assigned', 'started', 'in_progress', 'completed']),
    specialInstructions: z.string().optional(),
    requiredEquipment: z.array(z.string()),
    loadVerified: z.boolean(),
    thumbnailUrl: z.string().optional()
  })),
  dailyStats: z.object({
    total: z.number(),
    completed: z.number(),
    remaining: z.number()
  }),
  metadata: z.object({
    date: z.string(),
    crewId: z.string(),
    generatedAt: z.string()
  })
});

export async function GET(req: NextRequest) {
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

      // Parse query parameters
      const { searchParams } = new URL(req.url);
      const queryParams = jobsQuerySchema.parse({
        date: searchParams.get('date') || undefined
      });

      // Get crew ID from user metadata
      const crewId = user.app_metadata?.crew_id || user.id;

      // Initialize service
      const crewService = new CrewWorkflowService();

      // Get assigned jobs
      const jobs = await crewService.getAssignedJobs(
        crewId,
        tenantId,
        queryParams.date
      );

      // Calculate daily stats
      const completed = jobs.filter(j => j.status === 'completed').length;
      const dailyStats = {
        total: jobs.length,
        completed,
        remaining: jobs.length - completed
      };

      // Build response
      const response = {
        jobs: jobs.map(job => ({
          ...job,
          thumbnailUrl: `/api/images/properties/${job.id}/thumbnail`
        })),
        dailyStats,
        metadata: {
          date: queryParams.date || new Date().toISOString().split('T')[0],
          crewId,
          generatedAt: new Date().toISOString()
        }
      };

      // Validate response
      const validatedResponse = jobsResponseSchema.parse(response);

      return NextResponse.json(validatedResponse, { 
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=60' // Cache for 1 minute
        }
      });

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