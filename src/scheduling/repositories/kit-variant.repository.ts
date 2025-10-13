/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/kit-variant.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for kit variant CRUD operations
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
 *   - KitVariantRepository
 * voice_considerations:
 *   - Support seasonal variant lookups
 *   - Simple variant switching via voice
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/kit-variant.repository.test.ts
 * tasks:
 *   - Implement variant CRUD operations
 *   - Handle default variant logic
 *   - Support seasonal variant queries
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type KitVariant = Database['public']['Tables']['kit_variants']['Row'];
type KitVariantInsert = Database['public']['Tables']['kit_variants']['Insert'];
type KitVariantUpdate = Database['public']['Tables']['kit_variants']['Update'];

export interface KitVariantFilters {
  kit_id?: string;
  is_default?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export class KitVariantRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<KitVariant | null> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: KitVariantFilters): Promise<KitVariant[]> {
    let query = this.supabase.from('kit_variants').select('*');

    if (filters?.kit_id) {
      query = query.eq('kit_id', filters.kit_id);
    }

    if (filters?.is_default !== undefined) {
      query = query.eq('is_default', filters.is_default);
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,variant_code.ilike.%${filters.search}%`
      );
    }

    query = query.order('is_default', { ascending: false })
                 .order('name', { ascending: true });

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

  async create(variant: KitVariantInsert): Promise<KitVariant> {
    // If this is the first variant or marked as default, ensure no other defaults
    if (variant.is_default) {
      await this.clearDefaultForKit(variant.kit_id);
    }

    const { data, error } = await this.supabase
      .from('kit_variants')
      .insert(variant)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(variants: KitVariantInsert[]): Promise<KitVariant[]> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .insert(variants)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: KitVariantUpdate): Promise<KitVariant> {
    // If setting as default, clear other defaults first
    if (updates.is_default === true) {
      const variant = await this.findById(id);
      if (variant) {
        await this.clearDefaultForKit(variant.kit_id);
      }
    }

    const { data, error } = await this.supabase
      .from('kit_variants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kit_variants')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async findByKit(kitId: string): Promise<KitVariant[]> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .select('*')
      .eq('kit_id', kitId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findDefaultByKit(kitId: string): Promise<KitVariant | null> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .select('*')
      .eq('kit_id', kitId)
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findByCode(kitId: string, variantCode: string): Promise<KitVariant | null> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .select('*')
      .eq('kit_id', kitId)
      .eq('variant_code', variantCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async setDefault(id: string): Promise<KitVariant> {
    return this.update(id, { is_default: true });
  }

  async clearDefaultForKit(kitId: string): Promise<void> {
    const { error } = await this.supabase
      .from('kit_variants')
      .update({ is_default: false })
      .eq('kit_id', kitId)
      .eq('is_default', true);

    if (error) throw error;
  }

  async deleteByKit(kitId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('kit_variants')
      .delete()
      .eq('kit_id', kitId);

    if (error) throw error;
    return true;
  }

  async findSeasonalVariant(kitId: string, season: string): Promise<KitVariant | null> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .select('*')
      .eq('kit_id', kitId)
      .or(
        `variant_code.ilike.%${season}%,name.ilike.%${season}%,metadata->season.ilike.%${season}%`
      )
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async countByKit(tenantId: string): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('kit_variants')
      .select('kit_id')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data || []).forEach(variant => {
      counts[variant.kit_id] = (counts[variant.kit_id] || 0) + 1;
    });

    return counts;
  }
}