/**
 * GET /api/crew/jobs/[jobId]
 * Get job details for a crew member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
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
    const { tenantId, user, userId: sessionUserId } = context;
    const userId = sessionUserId ?? request.headers.get('x-user-id');
    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing user context' }, { status: 400 });
    }

    const { jobId } = params;

    // Get job details with assignment verification
    const { data: assignment, error: assignmentError } = await supabase
      .from('job_assignments')
      .select(`
        job_id,
        assigned_at,
        jobs (
          id,
          job_number,
          scheduled_start,
          scheduled_end,
          status,
          description,
          voice_notes,
          priority,
          customers (
            id,
            name
          ),
          properties (
            id,
            address
          ),
          job_templates (
            id,
            name,
            estimated_duration
          )
        )
      `)
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (assignmentError || !assignment || !assignment.jobs) {
      return NextResponse.json(
        { error: 'Job not found or not assigned to you' },
        { status: 404 }
      );
    }

    const job = assignment.jobs;

    // Get items for this job from item_transactions
    const { data: itemTransactions, error: itemsError } = await supabase
      .from('item_transactions')
      .select(`
        id,
        item_id,
        transaction_type,
        quantity,
        notes,
        items (
          id,
          name,
          item_type,
          category,
          description,
          current_quantity,
          unit_of_measure,
          thumbnail_url,
          primary_image_url
        )
      `)
      .eq('job_id', jobId);

    const items = (itemTransactions || [])
      .filter(t => t.items !== null)
      .map(t => ({
        id: t.items.id,
        name: t.items.name,
        item_type: t.items.item_type,
        category: t.items.category,
        description: t.items.description,
        quantity: Number(t.quantity),
        unit_of_measure: t.items.unit_of_measure,
        transaction_type: t.transaction_type,
        thumbnail_url: t.items.thumbnail_url,
        primary_image_url: t.items.primary_image_url,
        notes: t.notes
      }));

    // Transform the job data to match frontend interface
    const scheduledStart = job.scheduled_start ? new Date(job.scheduled_start) : null;
    const scheduledEnd = job.scheduled_end ? new Date(job.scheduled_end) : null;

    // Map items to requiredEquipment format
    const requiredEquipment = items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category || 'equipment',
      verified: false // TODO: Track verification status
    }));

    // Format property address - handle both string and object formats
    let propertyAddress = 'Unknown Address';
    if (job.properties?.address) {
      if (typeof job.properties.address === 'string') {
        propertyAddress = job.properties.address;
      } else if (typeof job.properties.address === 'object' && job.properties.address.street) {
        propertyAddress = job.properties.address.street;
      }
    }

    const jobDetail = {
      id: job.id,
      customerName: job.customers?.name || 'Unknown Customer',
      customerPhone: '', // TODO: Add phone to query
      propertyAddress: propertyAddress,
      propertyType: 'residential', // TODO: Add property type to query
      scheduledDate: scheduledStart?.toISOString() || '',
      scheduledTime: scheduledStart?.toISOString() || '',
      status: job.status === 'scheduled' ? 'assigned' : job.status,
      templateName: job.job_templates?.name || 'Custom Job',
      specialInstructions: job.description || job.voice_notes || '',
      voiceInstructions: job.voice_notes || undefined,
      voiceInstructionsUrl: undefined, // TODO: Add voice URL support
      estimatedDuration: job.job_templates?.estimated_duration || 60,
      actualStartTime: undefined,
      actualEndTime: undefined,
      startPhotoUrl: undefined,
      completionPhotoUrl: undefined,
      requiredEquipment: requiredEquipment,
      loadVerified: false, // TODO: Track load verification
      priority: job.priority || 'medium',
      notes: job.description
    };

    return NextResponse.json({ job: jobDetail });

  } catch (error) {
    console.error('[Crew Job Details] Unexpected error', error);
    return handleApiError(error);
  }
}
