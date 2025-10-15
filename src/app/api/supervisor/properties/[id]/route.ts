import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const { id } = params;

    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        customer:customer_id (
          name
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    // Map field names for frontend
    const property = {
      ...data,
      primaryImageUrl: data.primary_image_url,
      mediumUrl: data.medium_url,
      thumbnailUrl: data.thumbnail_url
    };

    return NextResponse.json({ property });

  } catch (error) {
    return handleApiError(error);
  }
}
