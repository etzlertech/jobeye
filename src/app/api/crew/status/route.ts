/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/status/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint to get crew member status
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
 *   supabase: ['crews', 'job_assignments']
 * }
 * exports: ['GET']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/crew/status.test.ts'
 * }
 * tasks: [
 *   'Get crew member status',
 *   'Include job counts',
 *   'Support demo mode'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const isDemo = request.headers.get('x-is-demo') === 'true';
    const userId = request.headers.get('x-user-id');

    if (isDemo) {
      return NextResponse.json({
        status: {
          memberName: 'John Doe',
          currentJob: null,
          totalJobsToday: 3,
          completedJobs: 0,
          hoursWorked: 0
        }
      });
    }

    const supabase = await createServerClient();
    const today = new Date().toISOString().split('T')[0];

    // Get crew member details and job stats
    const { data: crewData } = await supabase
      .from('crews')
      .select('id, name')
      .eq('id', userId)
      .single();

    const { data: assignments } = await supabase
      .from('job_assignments')
      .select('job_id, jobs!inner(status, scheduled_date)')
      .eq('crew_id', userId)
      .eq('jobs.scheduled_date', today);

    const totalJobs = assignments?.length || 0;
    const completedJobs = assignments?.filter(
      (a: any) => a.jobs?.status === 'completed'
    ).length || 0;

    const currentJob = assignments?.find(
      (a: any) => a.jobs?.status === 'in_progress'
    );

    return NextResponse.json({
      status: {
        memberName: crewData?.name || 'Crew Member',
        currentJob: currentJob?.job_id || null,
        totalJobsToday: totalJobs,
        completedJobs,
        hoursWorked: completedJobs * 1.5 // Estimate
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}