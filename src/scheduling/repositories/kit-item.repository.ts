/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/kit-item.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for kit item CRUD operations
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
 *   - KitItemRepository
 * voice_considerations:
 *   - Support item lookups for verification
 *   - Simple quantity updates via voice
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/kit-item.repository.test.ts
 * tasks:
 *   - Implement kit item CRUD
 *   - Handle required vs optional items
 *   - Support quantity management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type KitItem = Database['public']['Tables']['kit_items']['Row'];
type KitItemInsert = Database['public']['Tables']['kit_items']['Insert'];
type KitItemUpdate = Database['public']['Tables']['kit_items']['Update'];

export interface KitItemFilters {
  kit_id?: string;
  item_type?: KitItem['item_type'];
  is_required?: boolean;
  limit?: number;
  offset?: number;
}

export class KitItemRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<KitItem | null> {
    const { data, error } = await this.supabase
      .from('kit_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: KitItemFilters): Promise<KitItem[]> {
    let query = this.supabase.from('kit_items').select('*');

    if (filters?.kit_id) {
      query = query.eq('kit_id', filters.kit_id);
    }

    if (filters?.item_type) {
      query = query.eq('item_type', filters.item_type);
    }

    if (filters?.is_required !== undefined) {
      query = query.eq('is_required', filters.is_required);
    }

    query = query.order('item_type', { ascending: true })
                 .order('created_at', { ascending: true });

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

  async create(item: KitItemInsert): Promise<KitItem> {
    const { data, error } = await this.supabase
      .from('kit_items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(items: KitItemInsert[]): Promise<KitItem[]> {
    const { data, error } = await this.supabase
      .from('kit_items')
      .insert(items)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: KitItemUpdate): Promise<KitItem> {
    const { data, error } = await this.supabase
      .from('kit_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kit_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async findByKit(kitId: string): Promise<KitItem[]> {
    const { data, error } = await this.supabase
      .from('kit_items')
      .select('*')
      .eq('kit_id', kitId)
      .order('is_required', { ascending: false })
      .order('item_type', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findRequiredByKit(kitId: string): Promise<KitItem[]> {
    const { data, error } = await this.supabase
      .from('kit_items')
      .select('*')
      .eq('kit_id', kitId)
      .eq('is_required', true)
      .order('item_type', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async updateQuantity(id: string, quantity: number): Promise<KitItem> {
    return this.update(id, { quantity });
  }

  async toggleRequired(id: string, isRequired: boolean): Promise<KitItem> {
    return this.update(id, { is_required: isRequired });
  }

  async deleteByKit(kitId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kit_items')
      .delete()
      .eq('kit_id', kitId);

    if (error) throw error;
    return true;
  }

  async replaceKitItems(kitId: string, newItems: KitItemInsert[]): Promise<KitItem[]> {
    // Delete existing items
    await this.deleteByKit(kitId);
    
    // Insert new items
    if (newItems.length === 0) return [];
    
    return this.createMany(newItems);
  }

  async countByType(kitId: string): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('kit_items')
      .select('item_type')
      .eq('kit_id', kitId);

    if (error) throw error;

    const counts: Record<string, number> = {
      equipment: 0,
      material: 0,
      tool: 0
    };

    (data || []).forEach(item => {
      counts[item.item_type] = (counts[item.item_type] || 0) + 1;
    });

    return counts;
  }
}