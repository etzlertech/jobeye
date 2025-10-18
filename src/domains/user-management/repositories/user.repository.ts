/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/domains/user-management/repositories/user.repository.ts
 * phase: 2
 * domain: user-management
 * purpose: Data access helpers for users_extended table
 * spec_ref: docs/PLAN-USER-MANAGEMENT-WITH-IMAGES.md#phase-3-domain-layer-day-2-morning
 * complexity_budget: 160
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { RequestContext } from '@/lib/auth/context';
import type {
  UpdateUserImagesPayload,
  UpdateUserPayload,
  UserListFilters
} from '../types';

interface ListUsersResult {
  rows: Database['public']['Tables']['users_extended']['Row'][];
  total: number;
}

export class UserRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listUsers(
    context: RequestContext,
    filters: UserListFilters
  ): Promise<ListUsersResult> {
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    const query = this.supabase
      .from('users_extended')
      .select('*', { count: 'exact' })
      .eq('tenant_id', context.tenantId)
      .order('display_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (filters.role) {
      query.eq('role', filters.role);
    }

    if (filters.status === 'active') {
      query.eq('is_active', true);
    } else if (filters.status === 'inactive') {
      query.eq('is_active', false);
    }

    if (filters.search) {
      const searchTerm = filters.search.trim();
      if (searchTerm.length > 0) {
        const pattern = `%${searchTerm}%`;
        query.or(
          [
            `display_name.ilike.${pattern}`,
            `first_name.ilike.${pattern}`,
            `last_name.ilike.${pattern}`,
            `phone.ilike.${pattern}`
          ].join(',')
        );
      }
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      rows: data ?? [],
      total: count ?? 0
    };
  }

  async getUserById(
    context: RequestContext,
    userId: string
  ): Promise<Database['public']['Tables']['users_extended']['Row'] | null> {
    const { data, error } = await this.supabase
      .from('users_extended')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  async updateUser(
    context: RequestContext,
    userId: string,
    payload: UpdateUserPayload
  ): Promise<Database['public']['Tables']['users_extended']['Row'] | null> {
    const updatePayload = {
      ...payload,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('users_extended')
      .update(updatePayload)
      .eq('tenant_id', context.tenantId)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  async updateUserImages(
    context: RequestContext,
    userId: string,
    payload: UpdateUserImagesPayload
  ): Promise<Database['public']['Tables']['users_extended']['Row'] | null> {
    const { data, error } = await this.supabase
      .from('users_extended')
      .update({
        primary_image_url: payload.primaryImageUrl,
        medium_url: payload.mediumImageUrl,
        thumbnail_url: payload.thumbnailImageUrl,
        avatar_url: payload.primaryImageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', context.tenantId)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }
}
