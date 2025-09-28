/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/jobs/[jobId]/load-list/route.ts
 * phase: 4
 * domain: job
 * purpose: API endpoint for managing job load lists
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 150
 * dependencies:
 *   - internal: JobLoadListService, createServerClient
 *   - external: next
 * exports: GET, PATCH
 * voice_considerations:
 *   - Return voice-friendly summaries
 *   - Support voice status updates
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/app/api/jobs/[jobId]/load-list/__tests__/route.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { JobLoadListService } from '@/domains/job/services/job-load-list-service';
import { VoiceLogger } from '@/core/logger/voice-logger';

interface RouteContext {
  params: {
    jobId: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const logger = new VoiceLogger();
  const { jobId } = params;

  try {
    // Get authenticated user
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const loadListService = new JobLoadListService(supabase, undefined, undefined, logger);
    
    // Check if summary is requested
    const url = new URL(request.url);
    const summary = url.searchParams.get('summary') === 'true';

    if (summary) {
      const loadSummary = await loadListService.getLoadListSummary(jobId);
      return NextResponse.json(loadSummary);
    }

    // Get full load list
    const loadList = await loadListService.getLoadList(jobId);
    
    return NextResponse.json({
      job_id: jobId,
      items: loadList,
      total_count: loadList.length
    });

  } catch (error) {
    await logger.error('Failed to get load list', error as Error, { jobId });
    
    return NextResponse.json(
      { error: 'Failed to retrieve load list' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const logger = new VoiceLogger();
  const { jobId } = params;

  try {
    // Get authenticated user
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const loadListService = new JobLoadListService(supabase, undefined, undefined, logger);

    // Handle different update types
    if (body.action === 'update_status') {
      const { item_id, status } = body;
      
      if (!item_id || !status) {
        return NextResponse.json(
          { error: 'Missing required fields: item_id and status' },
          { status: 400 }
        );
      }

      const success = await loadListService.updateItemStatus(
        jobId,
        item_id,
        status,
        user.id
      );

      return NextResponse.json({
        success,
        message: success ? 'Status updated' : 'Failed to update status',
        voice_response: success 
          ? `Item marked as ${status}`
          : 'Unable to update item status'
      });
    }

    if (body.action === 'manual_override') {
      const { item_id, status, reason } = body;
      
      if (!item_id || !status || !reason) {
        return NextResponse.json(
          { error: 'Missing required fields: item_id, status, and reason' },
          { status: 400 }
        );
      }

      const success = await loadListService.applyManualOverride(
        jobId,
        item_id,
        status,
        reason,
        user.id
      );

      return NextResponse.json({
        success,
        message: success ? 'Override applied' : 'Failed to apply override',
        voice_response: success 
          ? `Override applied: ${status}`
          : 'Unable to apply override'
      });
    }

    if (body.action === 'assign_container') {
      const { item_id, container_id } = body;
      
      if (!item_id || !container_id) {
        return NextResponse.json(
          { error: 'Missing required fields: item_id and container_id' },
          { status: 400 }
        );
      }

      const success = await loadListService.assignItemToContainer(
        jobId,
        item_id,
        container_id,
        user.id
      );

      return NextResponse.json({
        success,
        message: success ? 'Container assigned' : 'Failed to assign container'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    await logger.error('Failed to update load list', error as Error, { jobId });
    
    return NextResponse.json(
      { error: 'Failed to update load list' },
      { status: 500 }
    );
  }
}