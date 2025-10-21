/**
 * GET /api/crew/jobs/[jobId]
 * Get job details for a crew member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import { getRequestContext } from '@/lib/auth/context';
import { JobLoadRepository } from '@/domains/crew/repositories/job-load.repository';

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

    // Get items for this job using JobLoadRepository (dual-read from workflow tables + JSONB)
    const loadRepo = new JobLoadRepository(supabase);
    const items = await loadRepo.getRequiredItems(jobId);

    // Transform the job data to match frontend interface
    const scheduledStart = job.scheduled_start ? new Date(job.scheduled_start) : null;
    const scheduledEnd = job.scheduled_end ? new Date(job.scheduled_end) : null;

    // Map items to requiredEquipment format
    const requiredEquipment = items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.item_type === 'equipment' ? 'equipment' : 'materials',
      verified: item.status === 'verified'
    }));

    // Format property address - handle both string and object formats
    let propertyAddress = 'Unknown Address';
    if (job.properties?.address) {
      if (typeof job.properties.address === 'string') {
        propertyAddress = job.properties.address;
      } else if (typeof job.properties.address === 'object') {
        // Handle JSONB address objects
        const addr = job.properties.address as any;
        if (addr.street) {
          const parts = [addr.street];
          if (addr.city) parts.push(addr.city);
          if (addr.state) parts.push(addr.state);
          if (addr.zip) parts.push(addr.zip);
          propertyAddress = parts.join(', ');
        } else {
          // Fallback for malformed address objects
          propertyAddress = JSON.stringify(addr).substring(0, 100);
        }
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
