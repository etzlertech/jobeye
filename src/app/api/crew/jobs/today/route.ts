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
 *   'Support demo mode'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');
    const today = new Date().toISOString().split('T')[0];

    if (isDemo) {
      // Return mock jobs for demo mode
      const mockJobs = [
        {
          id: '1',
          customer_name: 'Johnson Family',
          property_address: '123 Main St, Anytown, USA',
          scheduled_date: today,
          scheduled_time: '9:00 AM',
          status: 'assigned',
          special_instructions: 'Gate code: 1234',
          template_name: 'Standard Lawn Service',
          estimated_duration: '45 mins'
        },
        {
          id: '2',
          customer_name: 'Smith Residence',
          property_address: '456 Oak Ave, Somewhere, USA',
          scheduled_date: today,
          scheduled_time: '10:30 AM',
          status: 'assigned',
          special_instructions: 'Dog in backyard - friendly',
          template_name: 'Full Service Package',
          estimated_duration: '1 hour'
        },
        {
          id: '3',
          customer_name: 'Green Acres HOA',
          property_address: '789 Park Blvd, Elsewhere, USA',
          scheduled_date: today,
          scheduled_time: '1:00 PM',
          status: 'assigned',
          special_instructions: 'Common areas only',
          template_name: 'Commercial Property',
          estimated_duration: '2 hours'
        }
      ];

      return NextResponse.json({
        jobs: mockJobs,
        total_count: mockJobs.length,
        date: today
      });
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
      .eq('crew_id', userId)
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