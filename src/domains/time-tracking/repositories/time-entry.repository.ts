/**
 * T063: TimeEntryRepository (Extension)
 * Repository for managing time entries with auto clock-out detection and geofencing
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface TimeEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  job_id?: string;
  route_id?: string;
  clock_in_time: string;
  clock_out_time?: string;
  clock_in_latitude?: number;
  clock_in_longitude?: number;
  clock_out_latitude?: number;
  clock_out_longitude?: number;
  total_hours?: number;
  break_duration_mins?: number;
  entry_type: 'manual' | 'auto_detected' | 'voice_command' | 'geofence';
  auto_clocked_out: boolean;
  auto_clockout_trigger?: string; // Description of trigger (e.g., "5pm+500m+30min")
  requires_supervisor_review: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class TimeEntryRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<TimeEntry | null> {
    const { data, error } = await this.supabase
      .from('time_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByUserId(
    userId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      jobId?: string;
      routeId?: string;
      limit?: number;
    }
  ): Promise<TimeEntry[]> {
    let query = this.supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .order('clock_in_time', { ascending: false });

    if (options?.startDate) {
      query = query.gte('clock_in_time', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('clock_in_time', options.endDate);
    }

    if (options?.jobId) {
      query = query.eq('job_id', options.jobId);
    }

    if (options?.routeId) {
      query = query.eq('route_id', options.routeId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findByJobId(jobId: string): Promise<TimeEntry[]> {
    const { data, error } = await this.supabase
      .from('time_entries')
      .select('*')
      .eq('job_id', jobId)
      .order('clock_in_time', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByRouteId(routeId: string): Promise<TimeEntry[]> {
    const { data, error } = await this.supabase
      .from('time_entries')
      .select('*')
      .eq('route_id', routeId)
      .order('clock_in_time', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findActiveEntry(userId: string): Promise<TimeEntry | null> {
    const { data, error } = await this.supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  }

  async findPendingReview(limit?: number): Promise<TimeEntry[]> {
    let query = this.supabase
      .from('time_entries')
      .select('*')
      .eq('requires_supervisor_review', true)
      .is('reviewed_at', null)
      .order('clock_in_time', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findAutoClockOutCandidates(options: {
    after5pm: boolean;
    distanceThresholdMeters: number;
    inactivityMins: number;
  }): Promise<TimeEntry[]> {
    // Get all active entries (not clocked out)
    const { data, error } = await this.supabase
      .from('time_entries')
      .select('*')
      .is('clock_out_time', null)
      .order('clock_in_time', { ascending: true });

    if (error) throw error;

    const now = new Date();
    const candidates: TimeEntry[] = [];

    for (const entry of data || []) {
      const clockInTime = new Date(entry.clock_in_time);
      const hoursSinceClockIn = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      // Check if after 5pm
      if (options.after5pm && now.getHours() < 17) continue;

      // Check if inactive for threshold
      const minsSinceClockIn = (now.getTime() - clockInTime.getTime()) / (1000 * 60);
      if (minsSinceClockIn < options.inactivityMins) continue;

      // Note: Distance check would require current location, which is not stored in time_entry
      // This would typically be checked in the service layer with current GPS data

      candidates.push(entry);
    }

    return candidates;
  }

  async create(entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'total_hours'>): Promise<TimeEntry> {
    const { data, error } = await this.supabase
      .from('time_entries')
      .insert(entry)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<TimeEntry>): Promise<TimeEntry> {
    const { data, error } = await this.supabase
      .from('time_entries')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async clockOut(
    id: string,
    clockOutData: {
      clock_out_time: string;
      clock_out_latitude?: number;
      clock_out_longitude?: number;
      break_duration_mins?: number;
      auto_clocked_out?: boolean;
      auto_clockout_trigger?: string;
    }
  ): Promise<TimeEntry> {
    const entry = await this.findById(id);
    if (!entry) throw new Error('Time entry not found');

    const clockInTime = new Date(entry.clock_in_time);
    const clockOutTime = new Date(clockOutData.clock_out_time);
    const totalMillis = clockOutTime.getTime() - clockInTime.getTime();
    const breakMillis = (clockOutData.break_duration_mins || 0) * 60 * 1000;
    const totalHours = (totalMillis - breakMillis) / (1000 * 60 * 60);

    const updates: Partial<TimeEntry> = {
      clock_out_time: clockOutData.clock_out_time,
      total_hours: Math.max(0, totalHours),
      clock_out_latitude: clockOutData.clock_out_latitude,
      clock_out_longitude: clockOutData.clock_out_longitude,
      break_duration_mins: clockOutData.break_duration_mins,
    };

    if (clockOutData.auto_clocked_out) {
      updates.auto_clocked_out = true;
      updates.auto_clockout_trigger = clockOutData.auto_clockout_trigger;
      updates.requires_supervisor_review = true; // Auto clock-outs need review
    }

    return this.update(id, updates);
  }

  async reviewEntry(id: string, reviewedBy: string, approved: boolean, notes?: string): Promise<TimeEntry> {
    const updates: Partial<TimeEntry> = {
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      requires_supervisor_review: !approved,
    };

    if (notes) {
      updates.notes = notes;
    }

    return this.update(id, updates);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('time_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getTotalHoursByUser(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    total_hours: number;
    entries_count: number;
    manual_entries: number;
    auto_entries: number;
    pending_review: number;
  }> {
    const entries = await this.findByUserId(userId, { startDate, endDate });

    const total_hours = entries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
    const entries_count = entries.length;
    const manual_entries = entries.filter((e) => e.entry_type === 'manual').length;
    const auto_entries = entries.filter((e) => e.auto_clocked_out).length;
    const pending_review = entries.filter((e) => e.requires_supervisor_review && !e.reviewed_at).length;

    return {
      total_hours,
      entries_count,
      manual_entries,
      auto_entries,
      pending_review,
    };
  }

  async getTotalHoursByJob(jobId: string): Promise<number> {
    const entries = await this.findByJobId(jobId);
    return entries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
  }

  async getAutoClockOutStats(startDate?: string, endDate?: string): Promise<{
    total_auto_clockouts: number;
    approved: number;
    pending_review: number;
    avg_duration_hours: number;
  }> {
    let query = this.supabase
      .from('time_entries')
      .select('*')
      .eq('auto_clocked_out', true);

    if (startDate) {
      query = query.gte('clock_in_time', startDate);
    }

    if (endDate) {
      query = query.lte('clock_in_time', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const entries = data || [];
    const total_auto_clockouts = entries.length;
    const approved = entries.filter((e) => e.reviewed_at && !e.requires_supervisor_review).length;
    const pending_review = entries.filter((e) => e.requires_supervisor_review && !e.reviewed_at).length;
    const total_hours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const avg_duration_hours = total_auto_clockouts > 0 ? total_hours / total_auto_clockouts : 0;

    return {
      total_auto_clockouts,
      approved,
      pending_review,
      avg_duration_hours,
    };
  }
}