/**
 * T053: DailyRouteRepository
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface DailyRoute {
  id: string;
  tenant_id: string;
  route_date: string;
  assigned_to: string;
  status: string;
  total_jobs?: number;
  total_distance_km?: number;
  estimated_duration_mins?: number;
  optimization_used?: boolean;
  created_at?: string;
  updated_at?: string;
}

export class DailyRouteRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<DailyRoute | null> {
    const { data, error } = await this.supabase.from('daily_routes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as DailyRoute | null) ?? null;
  }

  async findByDate(date: string, userId: string): Promise<DailyRoute[]> {
    const { data, error } = await this.supabase
      .from('daily_routes')
      .select('*')
      .eq('route_date', date)
      .eq('assigned_to', userId);
    if (error) throw error;
    return (data as DailyRoute[] | null) ?? [];
  }

  async create(route: Omit<DailyRoute, 'id' | 'created_at' | 'updated_at'>): Promise<DailyRoute> {
    const { data, error } = await this.supabase
      .from('daily_routes')
      .insert(route)
      .select()
      .single();
    if (error) throw error;
    return data as DailyRoute;
  }

  async update(id: string, updates: Partial<DailyRoute>): Promise<DailyRoute> {
    const { data, error } = await this.supabase
      .from('daily_routes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as DailyRoute;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('daily_routes').delete().eq('id', id);
    if (error) throw error;
  }

  async countOptimizationsForDispatcher(dispatcherId: string, routeDate: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('daily_routes')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', dispatcherId)
      .eq('route_date', routeDate)
      .eq('optimization_used', true);

    if (error) throw error;
    return count ?? 0;
  }
}
