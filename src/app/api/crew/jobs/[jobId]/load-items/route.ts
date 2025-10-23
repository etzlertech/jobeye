/**
 * @file /src/app/api/crew/jobs/[jobId]/load-items/route.ts
 * @phase 3
 * @domain crew
 * @purpose API endpoint to fetch current load item states for a job
 * @complexity_budget 150
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { JobLoadRepository } from '@/domains/crew/repositories/job-load.repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/crew/jobs/[jobId]/load-items
 * Returns all items for a job with their current verification states
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const jobId = params.jobId;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createServerClient();

    // Get items with their current states
    const loadRepo = new JobLoadRepository(supabase as any);
    const items = await loadRepo.getRequiredItems(jobId);

    // Transform to simpler format for client
    const itemStates = items.map(item => ({
      id: item.id,
      name: item.name,
      item_type: item.item_type,
      quantity: item.quantity,
      is_required: item.is_required,
      status: item.status, // 'pending', 'verified', 'loaded', 'missing'
      task_id: item.task_id,
    }));

    console.log(`[LoadItems API] Fetched ${itemStates.length} items for job ${jobId}`);

    return NextResponse.json({
      success: true,
      items: itemStates,
    });
  } catch (error: any) {
    console.error('[LoadItems API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch load items'
      },
      { status: 500 }
    );
  }
}
