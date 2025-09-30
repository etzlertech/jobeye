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
  total_distance_km?: number;
  estimated_duration_min?: number;
}

export class DailyRouteRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string) {
    const { data, error } = await this.supabase.from('daily_routes').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async findByDate(date: string, userId: string) {
    const { data, error } = await this.supabase.from('daily_routes').select('*').eq('route_date', date).eq('assigned_to', userId);
    if (error) throw error;
    return data || [];
  }

  async create(route: Omit<DailyRoute, 'id'>) {
    const { data, error } = await this.supabase.from('daily_routes').insert(route).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<DailyRoute>) {
    const { data, error } = await this.supabase.from('daily_routes').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
}
