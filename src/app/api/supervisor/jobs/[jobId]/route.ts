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
        ),
        checklist_items:job_checklist_items(
          id,
          item_id,
          status,
          item:items(
            id,
            name,
            category,
            primary_image_url
          )
        )
      `)
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    // Calculate load statistics
    const checklistItems = data.checklist_items || [];
    const activeItems = checklistItems.filter((item: any) => item.status !== 'missing');
    const totalItems = activeItems.length;
    const loadedItems = activeItems.filter(
      (item: any) => item.status === 'loaded' || item.status === 'verified'
    ).length;
    const verifiedItems = activeItems.filter(
      (item: any) => item.status === 'verified'
    ).length;

    // Map field names for frontend
    const job = {
      ...data,
      primaryImageUrl: data.primary_image_url,
      mediumUrl: data.medium_url,
      thumbnailUrl: data.thumbnail_url,
      total_items: totalItems,
      loaded_items: loadedItems,
      verified_items: verifiedItems,
      completion_percentage: totalItems > 0 ? Math.round((loadedItems / totalItems) * 100) : 0
    };

    return NextResponse.json({ job });

  } catch (error) {
    return handleApiError(error);
  }
}
