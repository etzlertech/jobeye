/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/jobs/[jobId]/verify-checklist/route.ts
 * phase: 4
 * domain: job
 * purpose: API endpoint for verifying required tools/materials with vision
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 150
 * dependencies:
 *   - internal: ChecklistVerificationService, createServerClient
 *   - external: next
 * exports: POST
 * voice_considerations:
 *   - Return voice-friendly verification summaries
 *   - Support voice confirmations
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/app/api/jobs/[jobId]/verify-checklist/__tests__/route.test.ts
 * note: Route name preserved for backward compatibility; verifies required tools/materials for work orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
// NOTE: ChecklistVerificationService was part of retired job_checklist_items system
// This route is preserved for backward compatibility but deprecated
// Use item_transactions pattern via /api/crew/jobs/[jobId]/equipment instead

interface RouteContext {
  params: {
    jobId: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { jobId } = params;

  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          voice_response: 'Please sign in to verify required items'
        },
        { status: 401 }
      );
    }

    // This endpoint is deprecated - the job_checklist_items table was retired 2025-10-19
    // Clients should migrate to the new item_transactions pattern
    return NextResponse.json(
      {
        error: 'Endpoint deprecated',
        message: 'This endpoint is deprecated. Please use /api/crew/jobs/[jobId]/equipment for tools and materials verification.',
        deprecated_since: '2025-10-19',
        migration_guide: 'See RETIRED_CHECKLIST_SYSTEM.md for migration details',
        replacement_endpoint: `/api/crew/jobs/${jobId}/equipment`,
        voice_response: 'This verification method is no longer supported. Please update your app to use the new equipment tracking system.'
      },
      { status: 410 } // 410 Gone - indicates the resource is permanently unavailable
    );

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process request',
        voice_response: 'Sorry, an error occurred. Please try again.'
      },
      { status: 500 }
    );
  }
}