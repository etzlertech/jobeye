/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/day-plan.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for day plan CRUD operations with RLS support
 * spec_ref: .specify/features/003-scheduling-kits/data-model.md
 * complexity_budget: 300
 * state_machine: none
 * estimated_llm_cost: 0.02
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - /src/types/supabase.ts
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - DayPlanRepository
 * voice_considerations:
 *   - Support voice-created day plans via voice_session_id
 *   - Return simplified responses for voice feedback
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/day-plan.repository.test.ts
 * tasks:
 *   - Implement CRUD operations with company_id filtering
 *   - Support offline caching for read operations
 *   - Handle voice session linking
 *   - Implement pagination and filtering
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type DayPlan = Database['public']['Tables']['day_plans']['Row'];
type DayPlanInsert = Database['public']['Tables']['day_plans']['Insert'];
type DayPlanUpdate = Database['public']['Tables']['day_plans']['Update'];

export interface DayPlanFilters {
  user_id?: string;
  plan_date?: string;
  date_from?: string;
  date_to?: string;
  status?: DayPlan['status'];
  limit?: number;
  offset?: number;
}

export interface DayPlanWithEvents extends DayPlan {
  schedule_events?: Database['public']['Tables']['schedule_events']['Row'][];
}

export class DayPlanRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<DayPlan | null> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findByIdWithEvents(id: string): Promise<DayPlanWithEvents | null> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .select(`
        *,
        schedule_events (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: DayPlanFilters): Promise<DayPlan[]> {
    let query = this.supabase.from('day_plans').select('*');

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.plan_date) {
      query = query.eq('plan_date', filters.plan_date);
    }

    if (filters?.date_from && filters?.date_to) {
      query = query.gte('plan_date', filters.date_from)
                   .lte('plan_date', filters.date_to);
    } else if (filters?.date_from) {
      query = query.gte('plan_date', filters.date_from);
    } else if (filters?.date_to) {
      query = query.lte('plan_date', filters.date_to);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('plan_date', { ascending: false })
                 .order('created_at', { ascending: false });

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

  // Alias for findAll to match API route usage
  async findByFilters(filters?: DayPlanFilters): Promise<DayPlan[]> {
    return this.findAll(filters);
  }

  async create(dayPlan: DayPlanInsert): Promise<DayPlan> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .insert(dayPlan)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(dayPlans: DayPlanInsert[]): Promise<DayPlan[]> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .insert(dayPlans)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: DayPlanUpdate): Promise<DayPlan> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('day_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async findByUserAndDate(userId: string, planDate: string): Promise<DayPlan | null> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findActiveByUser(userId: string): Promise<DayPlan[]> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['published', 'in_progress'])
      .order('plan_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async updateStatus(id: string, status: DayPlan['status']): Promise<DayPlan> {
    return this.update(id, { status });
  }

  async startDay(id: string): Promise<DayPlan> {
    return this.update(id, {
      status: 'in_progress',
      actual_start_time: new Date().toISOString()
    });
  }

  async endDay(id: string): Promise<DayPlan> {
    return this.update(id, {
      status: 'completed',
      actual_end_time: new Date().toISOString()
    });
  }

  async updateRouteData(id: string, routeData: any, totalDistance?: number, estimatedDuration?: number): Promise<DayPlan> {
    const updates: DayPlanUpdate = { route_data: routeData };
    
    if (totalDistance !== undefined) {
      updates.total_distance_miles = totalDistance;
    }
    
    if (estimatedDuration !== undefined) {
      updates.estimated_duration_minutes = estimatedDuration;
    }

    return this.update(id, updates);
  }

  async findByVoiceSession(voiceSessionId: string): Promise<DayPlan | null> {
    const { data, error } = await this.supabase
      .from('day_plans')
      .select('*')
      .eq('voice_session_id', voiceSessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async countByStatus(companyId: string, status?: DayPlan['status']): Promise<number> {
    let query = this.supabase
      .from('day_plans')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (status) {
      query = query.eq('status', status);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;
  }
}