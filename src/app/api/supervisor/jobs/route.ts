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
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';
import { JobsRepository } from '@/domains/jobs/repositories/jobs.repository';
import { TaskTemplateRepository } from '@/domains/task-template/repositories/TaskTemplateRepository';
import { TaskTemplateItemAssociationRepository } from '@/domains/task-template/repositories/TaskTemplateItemAssociationRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import { createTaskTemplateService } from '@/domains/task-template/services/TaskTemplateService';
import { getRequestContext } from '@/lib/auth/context';
import type { Database } from '@/types/database';

// Force dynamic rendering - prevents static analysis during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Health check
    const searchParams = request.nextUrl.searchParams;
    if (searchParams.get('health') === 'true') {
      return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const resolveClient = async (): Promise<SupabaseClient> =>
      user ? await createServerClient() : createServiceClient();
    
    // Debug test
    if (searchParams.get('debug') === 'true') {
      try {
        const supabase = await resolveClient();

        // Simple test query
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title')
          .eq('tenant_id', tenantId)
          .limit(1);
          
        return NextResponse.json({ 
          debug: true,
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
    
    // Simple mode without relations
    if (searchParams.get('simple') === 'true') {
      try {
        const supabase = await resolveClient();

        const { data: jobs, error, count } = await supabase
          .from('jobs')
          .select(`
            *,
            customer:customers(name),
            property:properties(name, address)
          `, { count: 'exact' })
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch all checklist items for all jobs in one query
        const jobIds = (jobs || []).map(job => job.id);
        const { data: allChecklistItems } = await supabase
          .from('job_checklist_items')
          .select('id, job_id, status')
          .in('job_id', jobIds);

        // Group checklist items by job_id
        const checklistByJob = new Map();
        (allChecklistItems || []).forEach((item: any) => {
          if (!checklistByJob.has(item.job_id)) {
            checklistByJob.set(item.job_id, []);
          }
          checklistByJob.get(item.job_id).push(item);
        });

        // Add load status to each job
        const jobsWithLoadStatus = (jobs || []).map((job: any) => {
          const checklistItems = checklistByJob.get(job.id) || [];
          // Only count items that aren't marked as 'missing'
          const activeItems = checklistItems.filter((item: any) => item.status !== 'missing');
          const totalItems = activeItems.length;
          const loadedItems = activeItems.filter(
            (item: any) => item.status === 'loaded' || item.status === 'verified'
          ).length;
          const verifiedItems = activeItems.filter(
            (item: any) => item.status === 'verified'
          ).length;

          return {
            ...job,
            total_items: totalItems,
            loaded_items: loadedItems,
            verified_items: verifiedItems,
            completion_percentage: totalItems > 0 ? Math.round((loadedItems / totalItems) * 100) : 0
          };
        });

        console.log('Simple mode jobs with load status:', jobsWithLoadStatus.map(j => ({
          id: j.id,
          title: j.title,
          total_items: j.total_items,
          loaded_items: j.loaded_items
        })));

        return NextResponse.json({
          jobs: jobsWithLoadStatus,
          total_count: count || 0
        });
      } catch (simpleError) {
        console.error('Simple query error:', simpleError);
        return handleApiError(simpleError);
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

    // Log for debugging
    console.log('Jobs API - TenantID:', tenantId);
    
    // Get appropriate Supabase client
    const supabase = await resolveClient();
    
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
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const supabase: SupabaseClient = user
      ? await createServerClient()
      : createServiceClient();
    const body = await request.json();
    
    console.log('Jobs API POST request body:', JSON.stringify(body, null, 2));
    console.log('Body keys:', Object.keys(body));
    console.log('customer_id value:', body.customer_id);
    console.log('customer_id type:', typeof body.customer_id);

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
      priority: body.priority || 'low',
      job_number: body.job_number // Ensure job_number is included
    };

    // Validate required fields - customer_id is NOT NULL in database
    const requiredFields = ['title', 'customer_id'];
    const missingFields = requiredFields.filter(field => !jobData[field]);

    if (missingFields.length > 0) {
      return validationError('Missing required fields', { 
        missing_fields: missingFields,
        note: 'customer_id is required and cannot be null'
      });
    }
    
    // Ensure customer_id is not null (double check)
    if (!jobData.customer_id) {
      return validationError('customer_id is required', {
        message: 'Jobs table requires a valid customer_id'
      });
    }

    // Create job
    const job = await jobsRepo.create(jobData);

    if (!job) {
      throw new Error('Failed to create job');
    }

    // If template_id provided, instantiate template tasks
    let tasks = [];
    if (body.template_id) {
      try {
        const templateRepo = new TaskTemplateRepository(supabase);
        const taskRepo = new WorkflowTaskRepository(supabase);
        const associationRepo = new TaskTemplateItemAssociationRepository(supabase);
        const workflowAssocRepo = new WorkflowTaskItemAssociationRepository(supabase);
        const templateService = createTaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);

        const result = await templateService.instantiateTemplate(body.template_id, job.id);

        if (result.ok) {
          tasks = result.value;
          console.log(`Successfully created ${tasks.length} tasks from template for job ${job.id}`);
        } else {
          console.error('Failed to instantiate template:', result.error);
          // Don't fail the job creation if template instantiation fails
          // Just log the error
        }
      } catch (templateError) {
        console.error('Template instantiation error:', templateError);
        // Don't fail the job creation if template instantiation fails
      }
    }

    // Return the created job with tasks
    return NextResponse.json({
      job: job,
      tasks: tasks,
      message: tasks.length > 0
        ? `Job created successfully with ${tasks.length} tasks`
        : 'Job created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Jobs API POST error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    return handleApiError(error);
  }
}
