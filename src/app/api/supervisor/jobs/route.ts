/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/jobs/route.ts
 * phase: 4
 * domain: jobs
 * purpose: API endpoints for job management
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 200
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
 *   supabase: ['jobs', 'customers', 'properties']
 * }
 * exports: ['GET', 'POST']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/supervisor/jobs.test.ts'
 * }
 * tasks: [
 *   'List jobs for company with filters',
 *   'Create new job',
 *   'Support customer and property relations'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';
import { JobsRepository } from '@/domains/jobs/repositories/jobs.repository';

export async function GET(request: NextRequest) {
  try {
    // Health check
    const searchParams = request.nextUrl.searchParams;
    if (searchParams.get('health') === 'true') {
      return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    
    // Debug test
    if (searchParams.get('debug') === 'true') {
      try {
        const isDemoRequest = !request.headers.get('authorization');
        let supabase;
        if (isDemoRequest) {
          supabase = createServiceClient();
        } else {
          supabase = await createServerClient();
        }
        
        // Simple test query
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title')
          .eq('tenant_id', 'demo-company')
          .limit(1);
          
        return NextResponse.json({ 
          debug: true,
          isDemoRequest,
          hasSupabase: !!supabase,
          queryResult: { data, error }
        });
      } catch (debugError) {
        return NextResponse.json({ 
          debug: true, 
          error: String(debugError),
          stack: (debugError as Error).stack
        });
      }
    }
    
    // Get query parameters
    const customerId = searchParams.get('customer_id');
    const propertyId = searchParams.get('property_id');
    const status = searchParams.get('status');
    const scheduledDate = searchParams.get('scheduled_date');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // For demo pages, use a default tenant ID if not provided
    const tenantId = request.headers.get('x-tenant-id') || 'demo-company';
    
    // Log for debugging
    console.log('Jobs API - TenantID:', tenantId);
    
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    let supabase;
    if (isDemoRequest) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    
    const jobsRepo = new JobsRepository(supabase);
    
    // Build filters
    const filters = {
      customer_id: customerId || undefined,
      property_id: propertyId || undefined,
      status: status || undefined,
      scheduled_date: scheduledDate || undefined,
      search: search || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0
    };

    // Fetch jobs with relations
    const { data: jobs, count } = await jobsRepo.findAllWithRelations(tenantId, filters);

    return NextResponse.json({
      jobs: jobs || [],
      total_count: count || 0
    });

  } catch (error) {
    console.error('Jobs API GET error:', error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get appropriate Supabase client
    const isDemoRequest = !request.headers.get('authorization');
    let supabase;
    if (isDemoRequest) {
      supabase = createServiceClient();
    } else {
      supabase = await createServerClient();
    }
    const body = await request.json();

    // Get tenant ID from headers, use demo default if not provided
    const tenantId = request.headers.get('x-tenant-id') || 'demo-company';
    
    const jobsRepo = new JobsRepository(supabase);

    // Generate job number if not provided
    if (!body.job_number) {
      body.job_number = await jobsRepo.generateJobNumber(tenantId);
    }

    // Set default values
    const jobData = {
      ...body,
      tenant_id: tenantId,
      status: body.status || 'draft',
      priority: body.priority || 'medium',
      created_by: body.created_by || 'demo-user'
    };

    // Validate required fields
    const requiredFields = ['title', 'customer_id'];
    const missingFields = requiredFields.filter(field => !jobData[field]);

    if (missingFields.length > 0) {
      return validationError('Missing required fields', { 
        missing_fields: missingFields 
      });
    }

    // Create job
    const job = await jobsRepo.create(jobData);

    if (!job) {
      throw new Error('Failed to create job');
    }

    // Fetch with relations
    const jobWithRelations = await jobsRepo.findByIdWithRelations(job.id, tenantId);

    return NextResponse.json({ 
      job: jobWithRelations,
      message: 'Job created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Jobs API POST error:', error);
    return handleApiError(error);
  }
}