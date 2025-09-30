/**
 * T054: RouteWaypointRepository
 * Repository for managing route waypoints with CRUD operations and RLS compliance
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface RouteWaypoint {
  id: string;
  tenant_id: string;
  route_id: string;
  job_id?: string;
  waypoint_type: 'job' | 'break' | 'refuel' | 'depot';
  sequence: number;
  address: string;
  latitude: number;
  longitude: number;
  estimated_arrival?: string;
  actual_arrival?: string;
  arrival_photo_id?: string;
  status: 'pending' | 'en-route' | 'arrived' | 'completed' | 'skipped';
  travel_time_mins?: number;
  distance_km?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export class RouteWaypointRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<RouteWaypoint | null> {
    const { data, error } = await this.supabase
      .from('route_waypoints')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByRouteId(routeId: string): Promise<RouteWaypoint[]> {
    const { data, error } = await this.supabase
      .from('route_waypoints')
      .select('*')
      .eq('route_id', routeId)
      .order('sequence', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByJobId(jobId: string): Promise<RouteWaypoint | null> {
    const { data, error } = await this.supabase
      .from('route_waypoints')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  }

  async findByStatus(routeId: string, status: RouteWaypoint['status']): Promise<RouteWaypoint[]> {
    const { data, error } = await this.supabase
      .from('route_waypoints')
      .select('*')
      .eq('route_id', routeId)
      .eq('status', status)
      .order('sequence', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async create(waypoint: Omit<RouteWaypoint, 'id' | 'created_at' | 'updated_at'>): Promise<RouteWaypoint> {
    const { data, error } = await this.supabase
      .from('route_waypoints')
      .insert(waypoint)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(waypoints: Omit<RouteWaypoint, 'id' | 'created_at' | 'updated_at'>[]): Promise<RouteWaypoint[]> {
    const { data, error } = await this.supabase
      .from('route_waypoints')
      .insert(waypoints)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: Partial<RouteWaypoint>): Promise<RouteWaypoint> {
    const { data, error } = await this.supabase
      .from('route_waypoints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: RouteWaypoint['status'], arrivalData?: { actual_arrival?: string; arrival_photo_id?: string }): Promise<RouteWaypoint> {
    const updates: Partial<RouteWaypoint> = { status };
    if (arrivalData?.actual_arrival) updates.actual_arrival = arrivalData.actual_arrival;
    if (arrivalData?.arrival_photo_id) updates.arrival_photo_id = arrivalData.arrival_photo_id;

    return this.update(id, updates);
  }

  async reorderSequence(routeId: string, waypointIdOrder: string[]): Promise<void> {
    // Update each waypoint with new sequence number
    for (let i = 0; i < waypointIdOrder.length; i++) {
      await this.update(waypointIdOrder[i], { sequence: i + 1 });
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('route_waypoints')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteByRouteId(routeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('route_waypoints')
      .delete()
      .eq('route_id', routeId);

    if (error) throw error;
  }
}