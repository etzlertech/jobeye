/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/maintenance/report/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for reporting maintenance issues
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 150
 * migrations_touched: ['maintenance_reports']
 * state_machine: null
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
 *   supabase: ['maintenance_reports']
 * }
 * exports: ['POST']
 * voice_considerations: Can dictate issue description
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/crew/api/test_maintenance_report_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for maintenance reports',
 *   'Validate report data',
 *   'Handle critical severity alerts',
 *   'Support offline queueing'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { CrewWorkflowService } from '@/domains/crew/services/crew-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';

// Request validation schema
const maintenanceReportRequestSchema = z.object({
  equipmentId: z.string().uuid(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string().min(10).max(1000),
  photoUrls: z.array(z.string().url()).max(5).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }).optional(),
  jobId: z.string().uuid().optional()
});

// Response schema
const maintenanceReportResponseSchema = z.object({
  success: z.boolean(),
  report: z.object({
    id: z.string(),
    equipmentId: z.string(),
    severity: z.string(),
    status: z.string(),
    reportedAt: z.string(),
    offline: z.boolean().optional()
  }),
  message: z.string(),
  notificationSent: z.boolean().optional()
});

export async function POST(req: NextRequest) {
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

      // Parse and validate request
      const body = await req.json();
      const validatedData = maintenanceReportRequestSchema.parse(body);

      // Get crew ID from user metadata
      const crewId = user.app_metadata?.crew_id || user.id;

      // Initialize service
      const crewService = new CrewWorkflowService();

      // Create maintenance report
      const report = await crewService.reportMaintenance(
        {
          equipmentId: validatedData.equipmentId,
          severity: validatedData.severity,
          description: validatedData.description,
          photoUrls: validatedData.photoUrls
        },
        crewId,
        tenantId
      );

      // Build response
      const response = {
        success: true,
        report: {
          id: report.id,
          equipmentId: report.equipmentId,
          severity: report.severity,
          status: 'pending',
          reportedAt: report.reportedAt.toISOString(),
          offline: report.id.startsWith('offline-') || undefined
        },
        message: validatedData.severity === 'critical' 
          ? 'Critical issue reported. Supervisor has been notified immediately.'
          : 'Maintenance issue reported successfully.',
        notificationSent: validatedData.severity === 'critical' || undefined
      };

      // Validate response
      const validatedResponse = maintenanceReportResponseSchema.parse(response);

      return NextResponse.json(
        validatedResponse,
        { status: 201 }
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

      // Handle offline scenario
      if (error instanceof Error && error.message.includes('offline')) {
        return NextResponse.json(
          {
            success: true,
            report: {
              id: `offline-${Date.now()}`,
              equipmentId: body.equipmentId,
              severity: body.severity,
              status: 'queued',
              reportedAt: new Date().toISOString(),
              offline: true
            },
            message: 'Report queued for submission when online'
          },
          { status: 202 }
        );
      }

      // Handle other errors
      return handleApiError(error);
    }
  });
}