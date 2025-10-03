/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/kit-override-log.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for kit override log operations
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
 *   - KitOverrideLogRepository
 * voice_considerations:
 *   - Log voice-initiated overrides
 *   - Track notification SLA for voice urgency
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/kit-override-log.repository.test.ts
 * tasks:
 *   - Implement override log CRUD
 *   - Track notification delivery and SLA
 *   - Support analytics queries
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type KitOverrideLog = Database['public']['Tables']['kit_override_logs']['Row'];
type KitOverrideLogInsert = Database['public']['Tables']['kit_override_logs']['Insert'];
type KitOverrideLogUpdate = Database['public']['Tables']['kit_override_logs']['Update'];

export interface KitOverrideLogFilters {
  job_id?: string;
  kit_id?: string;
  technician_id?: string;
  supervisor_id?: string;
  voice_initiated?: boolean;
  date_from?: string;
  date_to?: string;
  sla_met?: boolean;
  limit?: number;
  offset?: number;
}

export interface OverrideAnalytics {
  total_overrides: number;
  by_item: Record<string, { count: number; reasons: string[] }>;
  by_technician: Record<string, number>;
  sla_performance: {
    met: number;
    missed: number;
    average_latency_ms: number;
  };
  notification_success_rate: number;
}

export class KitOverrideLogRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<KitOverrideLog | null> {
    const { data, error } = await this.supabase
      .from('kit_override_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: KitOverrideLogFilters): Promise<KitOverrideLog[]> {
    let query = this.supabase.from('kit_override_logs').select('*');

    if (filters?.job_id) {
      query = query.eq('job_id', filters.job_id);
    }

    if (filters?.kit_id) {
      query = query.eq('kit_id', filters.kit_id);
    }

    if (filters?.technician_id) {
      query = query.eq('technician_id', filters.technician_id);
    }

    if (filters?.supervisor_id) {
      query = query.eq('supervisor_id', filters.supervisor_id);
    }

    if (filters?.voice_initiated !== undefined) {
      query = query.eq('voice_initiated', filters.voice_initiated);
    }

    if (filters?.sla_met !== undefined) {
      query = query.eq('sla_met', filters.sla_met);
    }

    if (filters?.date_from && filters?.date_to) {
      query = query.gte('created_at', filters.date_from)
                   .lte('created_at', filters.date_to);
    }

    query = query.order('created_at', { ascending: false });

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

  async create(override: KitOverrideLogInsert): Promise<KitOverrideLog> {
    const { data, error } = await this.supabase
      .from('kit_override_logs')
      .insert(override)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: KitOverrideLogUpdate): Promise<KitOverrideLog> {
    const { data, error } = await this.supabase
      .from('kit_override_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kit_override_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async updateNotificationStatus(
    id: string,
    status: string,
    method: string,
    latencyMs?: number
  ): Promise<KitOverrideLog> {
    const updates: KitOverrideLogUpdate = {
      notification_status: status,
      notification_method: method
    };

    if (status === 'delivered') {
      updates.supervisor_notified_at = new Date().toISOString();
      
      if (latencyMs !== undefined) {
        updates.notification_latency_ms = latencyMs;
        updates.sla_met = latencyMs <= 30000; // 30 second SLA
      }
    }

    return this.update(id, updates);
  }

  async addNotificationAttempt(
    id: string,
    attempt: {
      method: string;
      status: string;
      timestamp: string;
      error?: string;
    }
  ): Promise<KitOverrideLog> {
    const override = await this.findById(id);
    if (!override) throw new Error('Override not found');

    const attempts = override.notification_attempts || [];
    attempts.push(attempt);

    return this.update(id, {
      notification_attempts: attempts
    });
  }

  async findByJob(jobId: string): Promise<KitOverrideLog[]> {
    const { data, error } = await this.supabase
      .from('kit_override_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findByTechnician(technicianId: string, limit: number = 10): Promise<KitOverrideLog[]> {
    const { data, error } = await this.supabase
      .from('kit_override_logs')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getAnalytics(tenantId: string, startDate: string, endDate: string): Promise<OverrideAnalytics> {
    const { data, error } = await this.supabase
      .rpc('get_override_analytics', {
        p_tenant_id: tenantId,
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (error) throw error;

    // Parse the JSON response from the RPC function
    const result = data as any;
    
    return {
      total_overrides: result.total_overrides || 0,
      by_item: result.by_item || {},
      by_technician: result.by_technician || {},
      sla_performance: {
        met: result.sla_met_count || 0,
        missed: result.sla_missed_count || 0,
        average_latency_ms: result.avg_latency_ms || 0
      },
      notification_success_rate: result.notification_success_rate || 0
    };
  }

  async findFrequentOverrides(tenantId: string, days: number = 30): Promise<Array<{
    item_id: string;
    count: number;
    reasons: string[];
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('kit_override_logs')
      .select('item_id, override_reason')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    // Aggregate by item_id
    const itemMap = new Map<string, { count: number; reasons: Set<string> }>();
    
    (data || []).forEach(override => {
      if (!override.item_id) return;
      
      if (!itemMap.has(override.item_id)) {
        itemMap.set(override.item_id, { count: 0, reasons: new Set() });
      }
      
      const item = itemMap.get(override.item_id)!;
      item.count++;
      item.reasons.add(override.override_reason);
    });

    // Convert to array and sort by count
    return Array.from(itemMap.entries())
      .map(([item_id, data]) => ({
        item_id,
        count: data.count,
        reasons: Array.from(data.reasons)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10
  }
}