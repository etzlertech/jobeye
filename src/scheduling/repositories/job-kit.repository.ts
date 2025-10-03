/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/job-kit.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for job-kit assignment operations
 * spec_ref: .specify/features/003-scheduling-kits/data-model.md
 * complexity_budget: 200
 * state_machine: none
 * estimated_llm_cost: 0.01
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - /src/types/supabase.ts
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - JobKitRepository
 * voice_considerations:
 *   - Support verification status updates via voice
 *   - Simple kit assignment queries
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/job-kit.repository.test.ts
 * tasks:
 *   - Implement job-kit CRUD operations
 *   - Handle verification workflows
 *   - Support variant assignments
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type JobKit = Database['public']['Tables']['job_kits']['Row'];
type JobKitInsert = Database['public']['Tables']['job_kits']['Insert'];
type JobKitUpdate = Database['public']['Tables']['job_kits']['Update'];

export interface JobKitFilters {
  job_id?: string;
  kit_id?: string;
  verified?: boolean;
  verification_status?: JobKit['verification_status'];
  assigned_by?: string;
  limit?: number;
  offset?: number;
}

export interface JobKitWithDetails extends JobKit {
  kit?: Database['public']['Tables']['kits']['Row'];
  variant?: Database['public']['Tables']['kit_variants']['Row'];
}

export class JobKitRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<JobKit | null> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findByIdWithDetails(id: string): Promise<JobKitWithDetails | null> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .select(`
        *,
        kit:kits(*),
        variant:kit_variants(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: JobKitFilters): Promise<JobKit[]> {
    let query = this.supabase.from('job_kits').select('*');

    if (filters?.job_id) {
      query = query.eq('job_id', filters.job_id);
    }

    if (filters?.kit_id) {
      query = query.eq('kit_id', filters.kit_id);
    }

    if (filters?.assigned_by) {
      query = query.eq('assigned_by', filters.assigned_by);
    }

    if (filters?.verification_status) {
      query = query.eq('verification_status', filters.verification_status);
    }

    if (filters?.verified === true) {
      query = query.not('verified_at', 'is', null);
    } else if (filters?.verified === false) {
      query = query.is('verified_at', null);
    }

    query = query.order('assigned_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async create(jobKit: JobKitInsert): Promise<JobKit> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .insert(jobKit)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(jobKits: JobKitInsert[]): Promise<JobKit[]> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .insert(jobKits)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: JobKitUpdate): Promise<JobKit> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('job_kits')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async findByJob(jobId: string): Promise<JobKit[]> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .select('*')
      .eq('job_id', jobId)
      .order('assigned_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByJobAndKit(jobId: string, kitId: string): Promise<JobKit | null> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .select('*')
      .eq('job_id', jobId)
      .eq('kit_id', kitId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async verify(
    id: string, 
    verifiedBy: string, 
    status: JobKit['verification_status'] = 'verified'
  ): Promise<JobKit> {
    return this.update(id, {
      verified_at: new Date().toISOString(),
      verified_by: verifiedBy,
      verification_status: status
    });
  }

  async findUnverifiedByJob(jobId: string): Promise<JobKit[]> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .select('*')
      .eq('job_id', jobId)
      .is('verified_at', null)
      .order('assigned_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async deleteByJob(jobId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('job_kits')
      .delete()
      .eq('job_id', jobId);

    if (error) throw error;
    return true;
  }

  async countByStatus(tenantId: string): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('job_kits')
      .select('verification_status')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const counts: Record<string, number> = {
      pending: 0,
      verified: 0,
      partial: 0,
      failed: 0
    };

    (data || []).forEach(jobKit => {
      const status = jobKit.verification_status || 'pending';
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }

  async updateNotes(id: string, notes: string): Promise<JobKit> {
    return this.update(id, { notes });
  }
}