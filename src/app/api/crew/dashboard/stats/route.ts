/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/dashboard/stats/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint to get crew dashboard statistics
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 100
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "GET": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: []
 * }
 * exports: ['GET']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/crew/dashboard-stats.test.ts'
 * }
 * tasks: [
 *   'Return dashboard statistics',
 *   'Include equipment and vehicle status',
 *   'Support demo mode'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/core/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const isDemo = request.headers.get('x-is-demo') === 'true';

    if (isDemo || true) { // Always return demo data for now
      return NextResponse.json({
        stats: {
          todayJobs: {
            total: 3,
            completed: 0,
            inProgress: 0,
            remaining: 3
          },
          equipment: {
            verified: false,
            missingItems: [],
            issuesReported: 0
          },
          vehicle: {
            fuelLevel: 85,
            maintenanceAlerts: 0
          }
        }
      });
    }

  } catch (error) {
    return handleApiError(error);
  }
}