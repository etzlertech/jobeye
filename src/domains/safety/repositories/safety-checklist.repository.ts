/**
 * T051: SafetyChecklistRepository
 * @file /src/domains/safety/repositories/safety-checklist.repository.ts
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SafetyChecklist {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  required_for: Array<{ type: string; value: string }>;
  items: Array<{
    id: string;
    task: string;
    type: string;
    photo_required: boolean;
    critical: boolean;
    sequence: number;
  }>;
  frequency: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export class SafetyChecklistRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<SafetyChecklist | null> {
    const { data, error } = await this.supabase
      .from('safety_checklists')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findAll(): Promise<SafetyChecklist[]> {
    const { data, error } = await this.supabase
      .from('safety_checklists')
      .select('*')
      .eq('active', true);

    if (error) throw error;
    return data || [];
  }

  async findByJobType(jobType: string): Promise<SafetyChecklist[]> {
    const { data, error } = await this.supabase
      .from('safety_checklists')
      .select('*')
      .contains('required_for', [{ type: 'job_type', value: jobType }]);

    if (error) throw error;
    return data || [];
  }

  async create(checklist: Omit<SafetyChecklist, 'id' | 'created_at' | 'updated_at'>): Promise<SafetyChecklist> {
    const { data, error } = await this.supabase
      .from('safety_checklists')
      .insert(checklist)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<SafetyChecklist>): Promise<SafetyChecklist> {
    const { data, error } = await this.supabase
      .from('safety_checklists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('safety_checklists')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}