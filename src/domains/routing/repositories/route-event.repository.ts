/**
 * T055: RouteEventRepository
 * Repository for managing GPS tracking events along routes with geofencing support
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface RouteEvent {
  id: string;
  tenant_id: string;
  route_id: string;
  waypoint_id?: string;
  event_type: 'gps_ping' | 'arrival_detected' | 'departure' | 'geofence_entry' | 'geofence_exit' | 'break_start' | 'break_end' | 'deviation';
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  speed_kmh?: number;
  heading_degrees?: number;
  battery_level?: number;
  timestamp: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export class RouteEventRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<RouteEvent | null> {
    const { data, error } = await this.supabase
      .from('route_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByRouteId(routeId: string, options?: {
    startTime?: string;
    endTime?: string;
    eventTypes?: RouteEvent['event_type'][];
    limit?: number;
  }): Promise<RouteEvent[]> {
    let query = this.supabase
      .from('route_events')
      .select('*')
      .eq('route_id', routeId)
      .order('timestamp', { ascending: true });

    if (options?.startTime) {
      query = query.gte('timestamp', options.startTime);
    }

    if (options?.endTime) {
      query = query.lte('timestamp', options.endTime);
    }

    if (options?.eventTypes && options.eventTypes.length > 0) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findByWaypointId(waypointId: string): Promise<RouteEvent[]> {
    const { data, error } = await this.supabase
      .from('route_events')
      .select('*')
      .eq('waypoint_id', waypointId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findLatestByRouteId(routeId: string): Promise<RouteEvent | null> {
    const { data, error } = await this.supabase
      .from('route_events')
      .select('*')
      .eq('route_id', routeId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  }

  async findByEventType(routeId: string, eventType: RouteEvent['event_type']): Promise<RouteEvent[]> {
    const { data, error } = await this.supabase
      .from('route_events')
      .select('*')
      .eq('route_id', routeId)
      .eq('event_type', eventType)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findGpsTrail(routeId: string, sinceTimestamp?: string): Promise<RouteEvent[]> {
    let query = this.supabase
      .from('route_events')
      .select('*')
      .eq('route_id', routeId)
      .eq('event_type', 'gps_ping')
      .order('timestamp', { ascending: true });

    if (sinceTimestamp) {
      query = query.gte('timestamp', sinceTimestamp);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async create(event: Omit<RouteEvent, 'id' | 'created_at'>): Promise<RouteEvent> {
    const { data, error } = await this.supabase
      .from('route_events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(events: Omit<RouteEvent, 'id' | 'created_at'>[]): Promise<RouteEvent[]> {
    const { data, error } = await this.supabase
      .from('route_events')
      .insert(events)
      .select();

    if (error) throw error;
    return data || [];
  }

  async deleteByRouteId(routeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('route_events')
      .delete()
      .eq('route_id', routeId);

    if (error) throw error;
  }

  async deleteOlderThan(daysOld: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { error } = await this.supabase
      .from('route_events')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
  }
}