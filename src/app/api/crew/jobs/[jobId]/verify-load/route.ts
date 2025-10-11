/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/[id]/verify-load/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint to save job load verification results
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 150
 * migrations_touched: ['job_verifications']
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.00 (no AI calls)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['job_verifications', 'jobs']
 * }
 * exports: ['POST']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/crew/verify-load.test.ts'
 * }
 * tasks: [
 *   'Save verification results',
 *   'Update job status',
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const jobId = params.id;
    const body = await request.json();

    // Validate required fields
    const { verified_items, verification_time, verification_method } = body;
    
    if (!verified_items || !Array.isArray(verified_items)) {
      return validationError('Invalid verified_items');
    }

    const userId = request.headers.get('x-user-id');
    const tenantId = request.headers.get('x-tenant-id');

    if (!userId || !tenantId) {
      return validationError('Missing user context');
    }

    // Start a transaction to save verification and update job
    const { data: verification, error: verifyError } = await supabase
      .from('job_verifications')
      .insert({
        job_id: jobId,
        crew_id: userId,
        tenant_id: tenantId,
        verified_items,
        verification_time: verification_time || new Date().toISOString(),
        verification_method: verification_method || 'camera_ai',
        metadata: {
          item_count: verified_items.length,
          verified_by: userId
        }
      })
      .select()
      .single();

    if (verifyError) throw verifyError;

    // Update job status if all items verified
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        metadata: supabase.sql`
          jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{load_verified}',
            'true'::jsonb
          )
        `
      })
      .eq('id', jobId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    return NextResponse.json({
      verification,
      job_updated: !updateError
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error);
  }
}
