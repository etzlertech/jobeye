/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/jobs/create/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoint for creating new jobs
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 200
 * migrations_touched: ['jobs', 'job_assignments']
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
 *   supabase: ['jobs', 'job_assignments']
 * }
 * exports: ['POST']
 * voice_considerations: Voice instructions can be included
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/supervisor/api/test_jobs_create_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for job creation',
 *   'Validate job data and crew limits',
 *   'Create job with assignments',
 *   'Return created job'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupervisorWorkflowService } from '@/domains/supervisor/services/supervisor-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Request validation schema
const jobCreateRequestSchema = z.object({
  customerId: z.string().uuid(),
  propertyId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  templateId: z.string().uuid().optional(),
  specialInstructions: z.string().max(1000).optional(),
  voiceInstructions: z.string().max(1000).optional(),
  assignedCrewIds: z.array(z.string().uuid()).optional(),
  requiredEquipment: z.array(z.string()).optional()
});

// Response schema
const jobCreateResponseSchema = z.object({
  success: z.boolean(),
  job: z.object({
    id: z.string(),
    customerId: z.string(),
    propertyId: z.string(),
    scheduledDate: z.string(),
    scheduledTime: z.string(),
    status: z.string(),
    createdAt: z.string(),
    assignedCrews: z.array(z.string()).optional()
  }).optional(),
  message: z.string(),
  crewLimitViolations: z.array(z.object({
    crewId: z.string(),
    currentJobs: z.number(),
    limit: z.number()
  })).optional()
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
      const validatedData = jobCreateRequestSchema.parse(body);

      // Validate scheduled date is not in the past
      const scheduledDate = new Date(validatedData.scheduledDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (scheduledDate < today) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: 'Scheduled date cannot be in the past'
          },
          { status: 400 }
        );
      }

      // Initialize service
      const supervisorService = new SupervisorWorkflowService();

      // Create job
      const result = await supervisorService.createJob(
        validatedData,
        tenantId,
        user.id
      );

      // Build response based on result
      let response: any = {
        success: result.success,
        message: result.message
      };

      if (result.success && result.data) {
        // Successfully created
        response.job = {
          id: result.data.id,
          customerId: result.data.customer_id,
          propertyId: result.data.property_id,
          scheduledDate: result.data.scheduled_date,
          scheduledTime: result.data.scheduled_time,
          status: result.data.status,
          createdAt: result.data.created_at,
          assignedCrews: validatedData.assignedCrewIds
        };
      } else if (!result.success && result.action === 'crew_limit_exceeded') {
        // Crew limit violations
        response.crewLimitViolations = result.data;
      }

      // Validate response
      const validatedResponse = jobCreateResponseSchema.parse(response);

      return NextResponse.json(
        validatedResponse,
        { status: result.success ? 201 : 400 }
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