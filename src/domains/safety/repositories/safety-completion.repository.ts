/**
 * T052: SafetyCompletionRepository
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SafetyCompletion {
  id: string;
  tenant_id?: string;
  checklist_id: string;
  job_id?: string;
  user_id: string;
  completed_at: string;
  items_completed: Array<any>;
  item_completions?: Array<any>;
  status?: string;
  total_items?: number;
  completed_items?: number;
  location?: { lat: number; lng: number };
  signature?: string;
  notes?: string;
}

// Alias for backwards compatibility
export type SafetyChecklistCompletion = SafetyCompletion;

export class SafetyCompletionRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<SafetyCompletion | null> {
    const { data, error } = await this.supabase
      .from('safety_checklist_completions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async findByJobId(jobId: string): Promise<SafetyCompletion[]> {
    const { data, error } = await this.supabase
      .from('safety_checklist_completions')
      .select('*')
      .eq('job_id', jobId);
    if (error) throw error;
    return data || [];
  }

  async findByUserId(userId: string): Promise<SafetyCompletion[]> {
    const { data, error } = await this.supabase
      .from('safety_checklist_completions')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<SafetyCompletion[]> {
    const { data, error } = await this.supabase
      .from('safety_checklist_completions')
      .select('*')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());
    if (error) throw error;
    return data || [];
  }

  async create(completion: Omit<SafetyCompletion, 'id'>): Promise<SafetyCompletion> {
    const { data, error } = await this.supabase
      .from('safety_checklist_completions')
      .insert(completion)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
