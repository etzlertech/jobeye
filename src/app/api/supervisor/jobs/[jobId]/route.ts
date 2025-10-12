/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/jobs/[jobId]/route.ts
 * phase: 4
 * domain: jobs
 * purpose: API endpoints for individual job operations
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 150
 * migrations_touched: ['jobs']
 * state_machine: none
 * estimated_llm_cost: {
 *   "read": "$0.00",
 *   "write": "$0.00"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler', '@/domains/jobs/repositories/jobs.repository'],
 *   external: ['next/server'],
 *   supabase: ['jobs']
 * }
 * exports: ['GET', 'PUT', 'DELETE']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/supervisor/jobs/[jobId].test.ts'
 * }
 * tasks: [
 *   'Get single job',
 *   'Update job',
 *   'Delete job'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, notFound, validationError } from '@/core/errors/error-handler';
import { JobsRepository } from '@/domains/jobs/repositories/jobs.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo-company';
    
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    let supabase;
    if (isDemoRequest) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const jobsRepo = new JobsRepository(supabase);
    const job = await jobsRepo.findByIdWithRelations(params.jobId, tenantId);

    if (!job) {
      return notFound('Job not found');
    }

    return NextResponse.json({ job });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo-company';
    const body = await request.json();
    
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    let supabase;
    if (isDemoRequest) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const jobsRepo = new JobsRepository(supabase);

    // Check if job exists
    const existingJob = await jobsRepo.findById(params.jobId, { tenant_id: tenantId });
    if (!existingJob) {
      return notFound('Job not found');
    }

    // Update job
    const updatedJob = await jobsRepo.update(
      params.jobId,
      {
        ...body,
        updated_at: new Date().toISOString()
      },
      { tenant_id: tenantId }
    );

    if (!updatedJob) {
      throw new Error('Failed to update job');
    }

    // Fetch with relations
    const jobWithRelations = await jobsRepo.findByIdWithRelations(params.jobId, tenantId);

    return NextResponse.json({ 
      job: jobWithRelations,
      message: 'Job updated successfully'
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'demo-company';
    
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    let supabase;
    if (isDemoRequest) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const jobsRepo = new JobsRepository(supabase);

    // Check if job exists
    const existingJob = await jobsRepo.findById(params.jobId, { tenant_id: tenantId });
    if (!existingJob) {
      return notFound('Job not found');
    }

    // Check if job can be deleted (not in progress or completed)
    if (['in_progress', 'completed'].includes(existingJob.status)) {
      return validationError('Cannot delete job in this status', {
        status: existingJob.status
      });
    }

    // Delete job
    const deleted = await jobsRepo.delete(params.jobId, { tenant_id: tenantId });

    if (!deleted) {
      throw new Error('Failed to delete job');
    }

    return NextResponse.json({ 
      message: 'Job deleted successfully'
    });

  } catch (error) {
    return handleApiError(error);
  }
}