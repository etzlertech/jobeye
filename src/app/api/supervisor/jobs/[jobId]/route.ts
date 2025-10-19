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

    // Fetch item transactions to get assigned items
    const { data: transactions, error: txError } = await supabase
      .from('item_transactions')
      .select(`
        id,
        item_id,
        transaction_type,
        quantity,
        created_at,
        items!inner(
          id,
          name,
          item_type,
          category,
          primary_image_url
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
    }

    // Group by item_id to get latest status per item
    const itemsMap = new Map();
    (transactions || []).forEach((tx: any) => {
      if (!itemsMap.has(tx.item_id)) {
        itemsMap.set(tx.item_id, {
          id: tx.id,
          item_id: tx.item_id,
          item_name: tx.items.name,
          item_type: tx.items.item_type,
          status: tx.transaction_type === 'check_in' ? 'returned' : 'loaded',
          quantity: tx.quantity,
          item: {
            id: tx.items.id,
            name: tx.items.name,
            category: tx.items.category,
            primary_image_url: tx.items.primary_image_url
          }
        });
      }
    });

    // Filter to only show currently assigned items (not returned)
    const enrichedChecklistItems = Array.from(itemsMap.values())
      .filter(item => item.status === 'loaded');

    // Fetch job assignments with user details
    // Use service client to bypass RLS issues
    const serviceClient = createServiceClient();

    console.log('============================================');
    console.log('[GET /api/supervisor/jobs/[jobId]] COMMIT: c2140b2 - USE SERVICE CLIENT FOR ASSIGNMENTS');
    console.log('[GET /api/supervisor/jobs/[jobId]] Fetching assignments for job:', jobId);
    const { data: assignmentsData, error: assignmentsError } = await serviceClient
      .from('job_assignments')
      .select(`
        user_id,
        assigned_at,
        assigned_by
      `)
      .eq('job_id', jobId);

    console.log('[GET /api/supervisor/jobs/[jobId]] Assignments query result:', {
      assignmentsCount: assignmentsData?.length || 0,
      error: assignmentsError,
      data: assignmentsData
    });
    console.log('============================================');

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
    }

    const assignments = await Promise.all(
      (assignmentsData || []).map(async (assignment: any) => {
        // Get user_extended data using service client (include image URLs)
        const { data: userData, error: userError } = await serviceClient
          .from('users_extended')
          .select('id, display_name, first_name, last_name, thumbnail_url, medium_url, primary_image_url')
          .eq('id', assignment.user_id)
          .single();

        // Get email from auth.users using service client
        const { data: authData } = await serviceClient.auth.admin.getUserById(assignment.user_id);

        console.log('[GET /api/supervisor/jobs/[jobId]] User data fetch:', {
          userId: assignment.user_id,
          userData,
          userError,
          email: authData?.user?.email
        });

        return {
          user_id: assignment.user_id,
          assigned_at: assignment.assigned_at,
          assigned_by: assignment.assigned_by,
          user: userData ? {
            ...userData,
            email: authData?.user?.email || 'Unknown'
          } : {
            id: assignment.user_id,
            email: authData?.user?.email || 'Unknown',
            display_name: 'Unknown User',
            first_name: 'Unknown',
            last_name: 'User'
          }
        };
      })
    );

    // Calculate load statistics from transactions
    const totalItems = enrichedChecklistItems.length;
    const loadedItems = enrichedChecklistItems.filter(
      (item: any) => item.status === 'loaded'
    ).length;
    const verifiedItems = 0; // No verification tracking yet in item_transactions

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
