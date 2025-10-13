/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/kit.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for kit CRUD operations
 * spec_ref: .specify/features/003-scheduling-kits/data-model.md
 * complexity_budget: 250
 * state_machine: none
 * estimated_llm_cost: 0.02
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - /src/types/supabase.ts
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - KitRepository
 * voice_considerations:
 *   - Support voice identifier lookups
 *   - Return simplified kit names for voice feedback
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/kit.repository.test.ts
 * tasks:
 *   - Implement kit CRUD with company filtering
 *   - Support category and voice identifier queries
 *   - Include kit item relationships
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Kit = Database['public']['Tables']['kits']['Row'];
type KitInsert = Database['public']['Tables']['kits']['Insert'];
type KitUpdate = Database['public']['Tables']['kits']['Update'];
type KitItem = Database['public']['Tables']['kit_items']['Row'];

export interface KitFilters {
  category?: string;
  is_active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface KitWithItems extends Kit {
  kit_items?: KitItem[];
}

export class KitRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Kit | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findByIdWithItems(id: string): Promise<KitWithItems | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select(`
        *,
        kit_items (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findByCode(kitCode: string, tenantId: string): Promise<Kit | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select('*')
      .eq('kit_code', kitCode)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: KitFilters): Promise<Kit[]> {
    let query = this.supabase.from('kits').select('*');

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,kit_code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    query = query.order('name', { ascending: true });

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

  async create(kit: KitInsert): Promise<Kit> {
    const { data, error } = await this.supabase
      .from('kits')
      .insert(kit)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(kits: KitInsert[]): Promise<Kit[]> {
    const { data, error } = await this.supabase
      .from('kits')
      .insert(kits)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: KitUpdate): Promise<Kit> {
    const { data, error } = await this.supabase
      .from('kits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kits')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async findByCategory(category: string): Promise<Kit[]> {
    const { data, error } = await this.supabase
      .from('kits')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findActive(): Promise<Kit[]> {
    const { data, error } = await this.supabase
      .from('kits')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async toggleActive(id: string, isActive: boolean): Promise<Kit> {
    return this.update(id, { is_active: isActive });
  }

  async updateMetadata(id: string, metadata: any): Promise<Kit> {
    const kit = await this.findById(id);
    if (!kit) throw new Error('Kit not found');

    return this.update(id, {
      metadata: { ...kit.metadata, ...metadata }
    });
  }

  async findByVoiceIdentifier(voiceIdentifier: string, tenantId: string): Promise<Kit | null> {
    const { data, error } = await this.supabase
      .from('kits')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('metadata->voice_identifier', voiceIdentifier)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async searchKits(searchTerm: string, tenantId: string): Promise<Kit[]> {
    const { data, error } = await this.supabase
      .from('kits')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(
        `name.ilike.%${searchTerm}%,kit_code.ilike.%${searchTerm}%,metadata->voice_identifier.ilike.%${searchTerm}%`
      )
      .eq('is_active', true)
      .limit(10);

    if (error) throw error;
    return data || [];
  }

  async countByCategory(tenantId: string): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('kits')
      .select('category')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach(kit => {
      const category = kit.category || 'uncategorized';
      counts[category] = (counts[category] || 0) + 1;
    });

    return counts;
  }
}