import { SupabaseClient } from '@supabase/supabase-js';
import {
  Tenant,
  TenantStatus,
  TenantPlan,
  CreateTenantDTO,
  UpdateTenantDTO,
  TenantWithMemberCount
} from '../types';

export class TenantRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapFromDb(data);
  }

  /**
   * Get tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapFromDb(data);
  }

  /**
   * List all tenants (system admin only)
   */
  async findAll(options?: {
    status?: TenantStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: TenantWithMemberCount[]; total: number }> {
    let query = this.supabase
      .from('tenants')
      .select(`
        *,
        tenant_members(count)
      `, { count: 'exact' });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      const term = options.search.trim();
      if (term.length > 0) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},slug.ilike.${like}`);
      }
    }

    if (options?.offset !== undefined && options?.limit) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    } else if (options?.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    // Map and include member count
    const tenants = (data || []).map(row => ({
      ...this.mapFromDb(row),
      memberCount: row.tenant_members?.[0]?.count || 0
    }));

    return {
      data: tenants,
      total: count || 0
    };
  }

  /**
   * Create new tenant
   */
  async create(dto: CreateTenantDTO, createdBy: string): Promise<Tenant> {
    // Validate slug is unique
    const existing = await this.findBySlug(dto.slug);
    if (existing) {
      throw new Error('Tenant with this slug already exists');
    }

    const { data, error } = await this.supabase
      .from('tenants')
      .insert({
        name: dto.name,
        slug: dto.slug,
        status: TenantStatus.ACTIVE,
        plan: dto.plan || TenantPlan.FREE,
        settings: dto.settings || {},
        created_by: createdBy
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Update tenant
   */
  async update(id: string, dto: UpdateTenantDTO): Promise<Tenant> {
    const updates: any = {};
    
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.plan !== undefined) updates.plan = dto.plan;
    if (dto.settings !== undefined) updates.settings = dto.settings;

    const { data, error } = await this.supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);

    if (error) throw error;

    return count === 0;
  }

  /**
   * Get tenants for a user
   */
  async findByUserId(userId: string): Promise<Tenant[]> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select(`
        *,
        tenant_members!inner(
          user_id,
          status
        )
      `)
      .eq('tenant_members.user_id', userId)
      .eq('tenant_members.status', 'active');

    if (error) throw error;

    return (data || []).map(row => this.mapFromDb(row));
  }

  /**
   * Map database row to domain model
   */
  private mapFromDb(data: any): Tenant {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      status: data.status as TenantStatus,
      plan: data.plan as TenantPlan,
      settings: data.settings || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by
    };
  }
}
