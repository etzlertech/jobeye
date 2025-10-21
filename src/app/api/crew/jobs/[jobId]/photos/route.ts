/**
 * GET /api/crew/jobs/[jobId]/photos
 * Get photos for a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, userId } = context;

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing user context' }, { status: 400 });
    }

    // TODO: Implement photo fetching when photo storage is set up
    // For now, return empty array
    return NextResponse.json({
      photos: []
    });

  } catch (error) {
    console.error('[Crew Job Photos] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
