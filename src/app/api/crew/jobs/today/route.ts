/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/today/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint to fetch today's jobs for crew members
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 200
 * migrations_touched: ['jobs', 'job_assignments']
 * state_machine: null
 * estimated_llm_cost: {
 *   "GET": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['jobs', 'job_assignments', 'customers', 'properties']
 * }
 * exports: ['GET']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/crew/jobs-today.test.ts'
 * }
 * tasks: [
 *   'Fetch assigned jobs for crew member',
 *   'Include customer and property details',
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';

// Force dynamic rendering - prevents static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user, userId: sessionUserId } = context;
    const userId = sessionUserId ?? request.headers.get('x-user-id');
    const supabase = user
      ? await createServerClient()
      : createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing user context' }, { status: 400 });
    }

    // Get jobs assigned to this crew member for today
    const { data: assignments, error } = await supabase
      .from('job_assignments')
      .select(`
        job_id,
        assigned_at,
        jobs (
          id,
          scheduled_date,
          scheduled_time,
          status,
          special_instructions,
          template_id,
          customers (
            id,
            name
          ),
          properties (
            id,
            address
          ),
          job_templates (
            id,
            name,
            estimated_duration
          )
        )
      `)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('jobs.scheduled_date', today)
      .order('jobs.scheduled_time', { ascending: true });

    if (error) throw error;

    // Transform the data
    const jobs = (assignments || []).map(assignment => {
      const job = assignment.jobs;
      return {
        id: job.id,
        customer_name: job.customers?.name || 'Unknown Customer',
        property_address: job.properties?.address || 'Unknown Address',
        scheduled_date: job.scheduled_date,
        scheduled_time: job.scheduled_time,
        status: job.status,
        special_instructions: job.special_instructions,
        template_name: job.job_templates?.name || 'Custom Job',
        estimated_duration: job.job_templates?.estimated_duration || 'N/A',
        assigned_at: assignment.assigned_at
      };
    });

    return NextResponse.json({
      jobs,
      total_count: jobs.length,
      date: today
    });

  } catch (error) {
    return handleApiError(error);
  }
}
