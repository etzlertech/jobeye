/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/crew-assignment.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for crew assignment operations
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
 *   - CrewAssignmentRepository
 * voice_considerations:
 *   - Voice confirmation of assignments
 *   - Simple crew queries by voice
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/crew-assignment.repository.test.ts
 * tasks:
 *   - Implement crew CRUD operations
 *   - Handle unique constraints on event/user pairs
 *   - Support voice confirmations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type CrewAssignment = Database['public']['Tables']['crew_assignments']['Row'];
type CrewAssignmentInsert = Database['public']['Tables']['crew_assignments']['Insert'];
type CrewAssignmentUpdate = Database['public']['Tables']['crew_assignments']['Update'];

export interface CrewAssignmentFilters {
  schedule_event_id?: string;
  user_id?: string;
  role?: CrewAssignment['role'];
  date_from?: string;
  date_to?: string;
  confirmed?: boolean;
  limit?: number;
  offset?: number;
}

export class CrewAssignmentRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<CrewAssignment | null> {
    const { data, error } = await this.supabase
      .from('crew_assignments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: CrewAssignmentFilters): Promise<CrewAssignment[]> {
    let query = this.supabase.from('crew_assignments').select('*');

    if (filters?.schedule_event_id) {
      query = query.eq('schedule_event_id', filters.schedule_event_id);
    }

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }

    if (filters?.date_from && filters?.date_to) {
      query = query.gte('assigned_at', filters.date_from)
                   .lte('assigned_at', filters.date_to);
    }

    if (filters?.confirmed === true) {
      query = query.not('confirmed_at', 'is', null);
    } else if (filters?.confirmed === false) {
      query = query.is('confirmed_at', null);
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

  async create(assignment: CrewAssignmentInsert): Promise<CrewAssignment> {
    const { data, error } = await this.supabase
      .from('crew_assignments')
      .insert(assignment)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(assignments: CrewAssignmentInsert[]): Promise<CrewAssignment[]> {
    const { data, error } = await this.supabase
      .from('crew_assignments')
      .insert(assignments)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: CrewAssignmentUpdate): Promise<CrewAssignment> {
    const { data, error } = await this.supabase
      .from('crew_assignments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('crew_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async findByEvent(scheduleEventId: string): Promise<CrewAssignment[]> {
    const { data, error } = await this.supabase
      .from('crew_assignments')
      .select('*')
      .eq('schedule_event_id', scheduleEventId)
      .order('role', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByUser(userId: string): Promise<CrewAssignment[]> {
    const { data, error } = await this.supabase
      .from('crew_assignments')
      .select('*')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async confirmAssignment(id: string, voiceConfirmed: boolean = false): Promise<CrewAssignment> {
    return this.update(id, {
      confirmed_at: new Date().toISOString(),
      voice_confirmed: voiceConfirmed
    });
  }

  async findByEventAndUser(scheduleEventId: string, userId: string): Promise<CrewAssignment | null> {
    const { data, error } = await this.supabase
      .from('crew_assignments')
      .select('*')
      .eq('schedule_event_id', scheduleEventId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async deleteByEvent(scheduleEventId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('crew_assignments')
      .delete()
      .eq('schedule_event_id', scheduleEventId);

    if (error) throw error;
    return true;
  }

  async countByRole(tenantId: string, role: CrewAssignment['role']): Promise<number> {
    const { count, error } = await this.supabase
      .from('crew_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', role);

    if (error) throw error;
    return count || 0;
  }
}