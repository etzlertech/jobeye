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

    // Fetch checklist items separately to avoid nested query issues
    const { data: checklistData, error: checklistError } = await supabase
      .from('job_checklist_items')
      .select(`
        id,
        item_id,
        item_name,
        item_type,
        status,
        quantity
      `)
      .eq('job_id', jobId);

    if (checklistError) {
      console.error('Error fetching checklist items:', checklistError);
    }

    // For each checklist item, fetch the related item details if item_id exists
    const enrichedChecklistItems = await Promise.all(
      (checklistData || []).map(async (checklistItem: any) => {
        if (checklistItem.item_id) {
          const { data: itemData } = await supabase
            .from('items')
            .select('id, name, category, primary_image_url')
            .eq('id', checklistItem.item_id)
            .single();

          return {
            ...checklistItem,
            item: itemData || {
              id: checklistItem.item_id,
              name: checklistItem.item_name || 'Unknown Item',
              category: checklistItem.item_type || 'material',
              primary_image_url: null
            }
          };
        }

        // If no item_id, use the stored item_name
        return {
          ...checklistItem,
          item: {
            id: null,
            name: checklistItem.item_name || 'Unknown Item',
            category: checklistItem.item_type || 'material',
            primary_image_url: null
          }
        };
      })
    );

    // Fetch job assignments with user details
    console.log('[GET /api/supervisor/jobs/[jobId]] Fetching assignments for job:', jobId);
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('job_assignments')
      .select(`
        assigned_user_id,
        assigned_at,
        assigned_by
      `)
      .eq('job_id', jobId);

    console.log('[GET /api/supervisor/jobs/[jobId]] Assignments query result:', {
      assignmentsCount: assignmentsData?.length || 0,
      error: assignmentsError,
      data: assignmentsData
    });

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
    }

    // Fetch user details for assignments
    const assignments = await Promise.all(
      (assignmentsData || []).map(async (assignment: any) => {
        const { data: userData } = await supabase
          .from('users_extended')
          .select('id, email, full_name')
          .eq('id', assignment.assigned_user_id)
          .single();

        return {
          user_id: assignment.assigned_user_id,
          assigned_at: assignment.assigned_at,
          assigned_by: assignment.assigned_by,
          user: userData || {
            id: assignment.assigned_user_id,
            email: 'Unknown',
            full_name: 'Unknown User'
          }
        };
      })
    );

    // Calculate load statistics using enriched items
    const activeItems = enrichedChecklistItems.filter((item: any) => item.status !== 'missing');
    const totalItems = activeItems.length;
    const loadedItems = activeItems.filter(
      (item: any) => item.status === 'loaded' || item.status === 'verified'
    ).length;
    const verifiedItems = activeItems.filter(
      (item: any) => item.status === 'verified'
    ).length;

    console.log('Job checklist stats:', {
      jobId,
      totalChecklistItems: enrichedChecklistItems.length,
      activeItems: totalItems,
      loadedItems,
      verifiedItems,
      assignmentsCount: assignments.length
    });

    // Map field names for frontend
    const job = {
      ...data,
      primaryImageUrl: data.primary_image_url,
      mediumUrl: data.medium_url,
      thumbnailUrl: data.thumbnail_url,
      checklist_items: enrichedChecklistItems,
      total_items: totalItems,
      loaded_items: loadedItems,
      verified_items: verifiedItems,
      completion_percentage: totalItems > 0 ? Math.round((loadedItems / totalItems) * 100) : 0,
      assignments: assignments
    };

    console.log('[GET /api/supervisor/jobs/[jobId]] Returning job with assignments:', {
      jobId: job.id,
      assignmentsCount: job.assignments.length
    });

    return NextResponse.json({ job });

  } catch (error) {
    return handleApiError(error);
  }
}
