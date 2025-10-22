import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';
import { JobsRepository } from '@/domains/jobs/repositories/jobs.repository';
import { z } from 'zod';
import type { Database } from '@/types/database';

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
    const assignedToolsAndMaterials = Array.from(itemsMap.values())
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

    // Calculate statistics for assigned tools/materials
    const totalItems = assignedToolsAndMaterials.length;
    const loadedItems = assignedToolsAndMaterials.filter(
      (item: any) => item.status === 'loaded'
    ).length;
    const verifiedItems = 0; // No verification tracking yet in item_transactions

    console.log('Work order item stats:', {
      jobId,
      totalAssignedItems: assignedToolsAndMaterials.length,
      activeItems: totalItems,
      loadedItems,
      verifiedItems,
      assignmentsCount: assignments.length
    });

    // Map field names for frontend (API field names preserved for compatibility)
    const job = {
      ...data,
      primaryImageUrl: data.primary_image_url,
      mediumUrl: data.medium_url,
      thumbnailUrl: data.thumbnail_url,
      checklist_items: assignedToolsAndMaterials, // API field name preserved; represents assigned tools/materials
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

type JobUpdatePayload = Database['public']['Tables']['jobs']['Update'] & {
  scheduled_date?: string;
  scheduled_time?: string;
};

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  scheduled_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
    .optional(),
  scheduledStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
    .optional(),
  scheduled_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
    .optional(),
  scheduledEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
    .optional()
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const jobId = params.jobId;
    const body = await request.json();
    const validated = updateSchema.parse(body);

    if (!Object.values(validated).some((value) => value !== undefined)) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    const jobsRepo = new JobsRepository(supabase);
    const existingJob = await jobsRepo.findById(jobId, { tenant_id: tenantId });

    if (!existingJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const updatePayload: JobUpdatePayload = {
      updated_at: new Date().toISOString()
    };

    if (validated.title !== undefined) {
      updatePayload.title = validated.title;
    }

    if (validated.description !== undefined) {
      updatePayload.description = validated.description;
    }

    if (validated.status !== undefined) {
      updatePayload.status = validated.status as Database['public']['Enums']['job_status'];
    }

    if (validated.priority !== undefined) {
      updatePayload.priority = validated.priority as Database['public']['Enums']['job_priority'];
    }

    const incomingSchedule =
      validated.scheduled_start ||
      validated.scheduledStart ||
      undefined;

    let scheduleDate = validated.scheduledDate;
    let scheduleTime = validated.scheduledTime;

    if (incomingSchedule) {
      const [incomingDate, incomingTimeRaw] = incomingSchedule.split('T');
      if (incomingDate) {
        scheduleDate = scheduleDate ?? incomingDate;
      }
      if (incomingTimeRaw) {
        const trimmed = incomingTimeRaw.slice(0, 5);
        if (/^\d{2}:\d{2}$/.test(trimmed)) {
          scheduleTime = scheduleTime ?? trimmed;
        }
      }
    }

    const existingDate =
      (existingJob as Record<string, any>).scheduled_date ||
      (existingJob as Record<string, any>).scheduled_start?.split?.('T')?.[0];
    const existingTimeRaw =
      (existingJob as Record<string, any>).scheduled_time ||
      (existingJob as Record<string, any>).scheduled_start?.split?.('T')?.[1];

    if (scheduleDate || scheduleTime) {
      const resolvedDate = scheduleDate ?? existingDate;
      const resolvedTime =
        scheduleTime ??
        (typeof existingTimeRaw === 'string'
          ? existingTimeRaw.slice(0, 5)
          : undefined) ??
        '09:00';

      if (!resolvedDate || !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
        return NextResponse.json(
          { error: 'Invalid schedule payload' },
          { status: 400 }
        );
      }

      const dateCheck = new Date(`${resolvedDate}T00:00:00Z`);
      if (Number.isNaN(dateCheck.getTime())) {
        return NextResponse.json(
          { error: 'Invalid schedule payload' },
          { status: 400 }
        );
      }

      if (!/^\d{2}:\d{2}$/.test(resolvedTime)) {
        return NextResponse.json(
          { error: 'Invalid schedule payload' },
          { status: 400 }
        );
      }

      const scheduledStart = `${resolvedDate}T${resolvedTime}:00`;
      updatePayload.scheduled_start = scheduledStart;
      updatePayload.scheduled_date = resolvedDate;
      updatePayload.scheduled_time = resolvedTime;
    }

    // Handle scheduled_end
    const incomingEnd =
      validated.scheduled_end ||
      validated.scheduledEnd ||
      undefined;

    if (incomingEnd) {
      updatePayload.scheduled_end = incomingEnd;
    }

    const updatedJob = await jobsRepo.update(
      jobId,
      updatePayload,
      { tenant_id: tenantId }
    );

    if (!updatedJob) {
      return NextResponse.json(
        { error: 'Job update failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid schedule payload', details: error.errors },
        { status: 400 }
      );
    }

    return handleApiError(error);
  }
}
