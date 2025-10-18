/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/jobs/repositories/jobs.repository.ts
 * phase: 4
 * domain: jobs
 * purpose: Repository for job data access with RLS
 * spec_ref: 007-mvp-intent-driven/domains/job-execution.md
 * complexity_budget: 250
 * migrations_touched: ['001_v4_core_business_tables.sql']
 * state_machine: none
 * estimated_llm_cost: {
 *   "read": "$0.00",
 *   "write": "$0.00"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/shared/repositories/base.repository', '@/lib/supabase/client'],
 *   external: [],
 *   supabase: ['jobs', 'customers', 'properties']
 * }
 * exports: ['JobsRepository', 'JobWithRelations']
 * voice_considerations: Support voice search for job queries
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: '__tests__/domains/jobs/repositories/jobs.repository.test.ts'
 * }
 * tasks: [
 *   'Extend BaseRepository for jobs table',
 *   'Implement job-specific queries with relations',
 *   'Add voice search support',
 *   'Handle offline operations'
 * ]
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, job_status } from '@/types/database';

type JobsTable = Database['public']['Tables']['jobs'];
export type Job = JobsTable['Row'];
export type JobInsert = JobsTable['Insert'];
export type JobUpdate = JobsTable['Update'];
type JobStatusEnum = job_status;

export interface JobWithRelations extends Job {
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  property?: {
    id: string;
    name: string | null;
    address: any;
  };
}

export interface JobFilters {
  status?: string;
  customer_id?: string;
  property_id?: string;
  scheduled_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class JobsRepository {
  constructor(private client: SupabaseClient) {}

  /**
   * Find jobs with related customer and property data
   */
  async findAllWithRelations(
    tenantId: string,
    filters?: JobFilters
  ): Promise<{ data: JobWithRelations[]; count: number }> {
    let query = this.client
      .from('jobs')
      .select(`
        *,
        customer:customers!left(
          id,
          name,
          email,
          phone
        ),
        property:properties!left(
          id,
          name,
          address
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }

    if (filters?.property_id) {
      query = query.eq('property_id', filters.property_id);
    }

    if (filters?.scheduled_date) {
      query = query.eq('scheduled_date', filters.scheduled_date);
    }

    if (filters?.search) {
      // Search in title, description, and job_number
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,job_number.ilike.%${filters.search}%`);
    }

    // Order by scheduled date and time
    query = query
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching jobs with relations:', error);
      throw error;
    }

    return {
      data: (data as JobWithRelations[]) || [],
      count: count || 0
    };
  }

  /**
   * Find a single job with relations
   */
  async findByIdWithRelations(
    id: string,
    tenantId: string
  ): Promise<JobWithRelations | null> {
    const { data, error } = await this.client
      .from('jobs')
      .select(`
        *,
        customer:customers!left(
          id,
          name,
          email,
          phone
        ),
        property:properties!left(
          id,
          name,
          address
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching job with relations:', error);
      throw error;
    }

    return data as JobWithRelations;
  }

  /**
   * Find today's jobs
   */
  async findTodaysJobs(
    tenantId: string
  ): Promise<JobWithRelations[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await this.client
      .from('jobs')
      .select(`
        *,
        customer:customers!left(
          id,
          name,
          email,
          phone
        ),
        property:properties!left(
          id,
          name,
          address
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('scheduled_date', today)
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('Error fetching today\'s jobs:', error);
      throw error;
    }

    return (data as JobWithRelations[]) || [];
  }

  /**
   * Generate a unique job number
   */
  async generateJobNumber(tenantId: string): Promise<string> {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `JOB-${timestamp}-${random}`;
  }

  /**
   * Update job status
   */
  async updateStatus(
    id: string,
    status: JobStatusEnum,
    tenantId: string,
    additionalData: Partial<JobUpdate> = {}
  ): Promise<Job | null> {
    const updateData: JobUpdate = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    // Add actual start/end times based on status
    if (status === 'in_progress' && !additionalData.actual_start) {
      updateData.actual_start = new Date().toISOString();
    }
    if (status === 'completed' && !additionalData.actual_end) {
      updateData.actual_end = new Date().toISOString();
    }

    return this.update(id, updateData, { tenant_id: tenantId });
  }

  /**
   * Basic CRUD operations
   */
  async findById(id: string, filters: { tenant_id: string }): Promise<Job | null> {
    const { data, error } = await this.client
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', filters.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  async create(jobData: JobInsert): Promise<Job | null> {
    const { data, error } = await this.client
      .from('jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      console.error('Error creating job:', error);
      throw error;
    }

    return data;
  }

  async update(
    id: string,
    updateData: JobUpdate,
    filters: { tenant_id: string }
  ): Promise<Job | null> {
    const { data, error } = await this.client
      .from('jobs')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', filters.tenant_id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  async delete(id: string, filters: { tenant_id: string }): Promise<boolean> {
    const { error } = await this.client
      .from('jobs')
      .delete()
      .eq('id', id)
      .eq('tenant_id', filters.tenant_id);

    if (error) {
      console.error('Error deleting job:', error);
      throw error;
    }

    return true;
  }
}
