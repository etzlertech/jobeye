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

type UsersExtendedRow = Database['public']['Tables']['users_extended']['Row'];
type UsersExtendedUpdate = Database['public']['Tables']['users_extended']['Update'];

export class UserRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private usersTable() {
    return this.supabase.from('users_extended') as any;
  }

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
    const { data, error } = await this.usersTable()
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
  ): Promise<UsersExtendedRow | null> {
    const updatePayload: UsersExtendedUpdate = {
      ...payload,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.usersTable()
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

    return data as UsersExtendedRow | null;
  }

  async updateUserImages(
    context: RequestContext,
    userId: string,
    payload: UpdateUserImagesPayload
  ): Promise<UsersExtendedRow | null> {
    const updatePayload: UsersExtendedUpdate = {
      primary_image_url: payload.primaryImageUrl,
      medium_url: payload.mediumImageUrl,
      thumbnail_url: payload.thumbnailImageUrl,
      avatar_url: payload.primaryImageUrl,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.usersTable()
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

    return data as UsersExtendedRow | null;
  }
}
