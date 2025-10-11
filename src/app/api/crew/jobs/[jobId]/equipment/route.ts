/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/[jobId]/equipment/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for job equipment management using jobs.checklist_items
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "GET": "$0.00",
 *   "PUT": "$0.00"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['jobs']
 * }
 * exports: ['GET', 'PUT']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/crew/job-equipment.test.ts'
 * }
 * tasks: [
 *   'Get equipment list from job checklist_items',
 *   'Update equipment checklist items',
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';

interface EquipmentItem {
  name: string;
  checked: boolean;
  category?: 'primary' | 'safety' | 'support' | 'materials';
  quantity?: number;
  verified_at?: string;
  icon?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;

    // Get job with checklist_items
    const { data: job, error } = await supabase
      .from('jobs')
      .select('id, checklist_items')
      .eq('id', jobId)
      .single();

    if (error) throw error;

    // checklist_items is a JSONB array of equipment items
    const equipment = job?.checklist_items || [];

    return NextResponse.json({
      equipment: equipment,
      job_id: jobId
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;
    const body = await request.json();

    const { equipment } = body;

    if (!Array.isArray(equipment)) {
      return NextResponse.json(
        { error: 'Equipment array is required' },
        { status: 400 }
      );
    }

    // Update the job's checklist_items
    const { data, error } = await supabase
      .from('jobs')
      .update({ checklist_items: equipment })
      .eq('id', jobId)
      .select('checklist_items')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      equipment: data.checklist_items
    });

  } catch (error) {
    return handleApiError(error);
  }
}

// Note: POST and DELETE are not needed since we update the entire checklist array with PUT
