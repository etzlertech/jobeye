/**
 * API endpoint to check if job load v2 feature is enabled
 * Returns feature flag status for the current tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { isJobLoadV2Enabled } from '@/lib/features/flags';
import { handleApiError } from '@/core/errors/error-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const enabled = await isJobLoadV2Enabled(context);

    return NextResponse.json({
      enabled,
      feature: 'jobLoadV2'
    });
  } catch (error) {
    return handleApiError(error);
  }
}
