import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const { jobId } = params;

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customer_id (
          name
        ),
        property:property_id (
          name,
          address
        )
      `)
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    // Map field names for frontend
    const job = {
      ...data,
      primaryImageUrl: data.primary_image_url,
      mediumUrl: data.medium_url,
      thumbnailUrl: data.thumbnail_url
    };

    return NextResponse.json({ job });

  } catch (error) {
    return handleApiError(error);
  }
}
