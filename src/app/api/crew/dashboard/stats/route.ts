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
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/core/errors/error-handler';
import { createServerClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/auth/context';

// Force dynamic rendering - prevents static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const userId = context.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Missing user context' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: assignments, error: jobError } = await supabase
      .from('job_assignments')
      .select('job_id, jobs(status, scheduled_start)')
      .eq('user_id', userId)
      .gte('jobs.scheduled_start', today)
      .lt('jobs.scheduled_start', `${today}T23:59:59`);

    if (jobError) throw jobError;

    const totalJobs = assignments?.length ?? 0;
    const completedJobs =
      assignments?.filter(a => a.jobs?.status === 'completed').length ?? 0;
    const inProgressJobs =
      assignments?.filter(a => a.jobs?.status === 'in_progress').length ?? 0;
    const remainingJobs = totalJobs - completedJobs - inProgressJobs;

    return NextResponse.json({
      stats: {
        todayJobs: {
          total: totalJobs,
          completed: completedJobs,
          inProgress: inProgressJobs,
          remaining: Math.max(remainingJobs, 0)
        },
        equipment: {
          verified: false,
          missingItems: [],
          issuesReported: 0
        },
        vehicle: {
          fuelLevel: null,
          maintenanceAlerts: 0
        }
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
