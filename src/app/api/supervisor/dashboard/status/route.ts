/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/dashboard/status/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoint for supervisor dashboard status
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 150
 * migrations_touched: ['jobs', 'crews', 'inventory', 'activity_logs']
 * state_machine: null
 * estimated_llm_cost: {
 *   "GET": "$0.00 (no AI calls)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '@/domains/supervisor/services/supervisor-workflow.service',
 *     '@/lib/auth/with-auth',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: [],
 *   supabase: ['jobs', 'crews', 'inventory', 'activity_logs']
 * }
 * exports: ['GET']
 * voice_considerations: Status can be read aloud via TTS
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/supervisor/api/test_dashboard_status_contract.test.ts'
 * }
 * tasks: [
 *   'Implement GET handler for dashboard status',
 *   'Aggregate job statistics',
 *   'Get crew status',
 *   'Return comprehensive dashboard data'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupervisorWorkflowService } from '@/domains/supervisor/services/supervisor-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Response schema
const dashboardStatusResponseSchema = z.object({
  todayJobs: z.object({
    total: z.number(),
    assigned: z.number(),
    inProgress: z.number(),
    completed: z.number()
  }),
  crewStatus: z.array(z.object({
    id: z.string(),
    name: z.string(),
    currentJob: z.string().optional(),
    jobsCompleted: z.number(),
    jobsRemaining: z.number()
  })),
  inventoryAlerts: z.array(z.object({
    itemId: z.string(),
    itemName: z.string(),
    alertType: z.enum(['low_stock', 'missing', 'maintenance_due']),
    severity: z.enum(['high', 'medium', 'low'])
  })),
  recentActivity: z.array(z.object({
    timestamp: z.string(),
    type: z.string(),
    description: z.string(),
    userId: z.string()
  })),
  metadata: z.object({
    generatedAt: z.string(),
    timezone: z.string()
  })
});

export async function GET(req: NextRequest) {
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

      // TODO: Full implementation requires crews, job_assignments, inventory, and activity_logs tables
      // For now, return stub data until database schema is complete

      const response = {
        todayJobs: {
          total: 0,
          assigned: 0,
          inProgress: 0,
          completed: 0
        },
        crewStatus: [],
        inventoryAlerts: [],
        recentActivity: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      // Validate response
      const validatedResponse = dashboardStatusResponseSchema.parse(response);

      return NextResponse.json(validatedResponse, {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=30' // Cache for 30 seconds
        }
      });

    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Response validation error',
            details: error.errors
          },
          { status: 500 }
        );
      }

      // Handle other errors
      return handleApiError(error);
    }
  });
}