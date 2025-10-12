import { SupabaseClient } from '@supabase/supabase-js';
import {
  TenantMember,
  MemberRole,
  MemberStatus,
  MemberWithUser,
  CreateMemberDTO,
  UpdateMemberDTO
} from '../types';

export class TenantMemberRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get member by ID
   */
  async findById(id: string): Promise<TenantMember | null> {
    const { data, error } = await this.supabase
      .from('tenant_members')
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
   * Get member by tenant and user
   */
  async findByTenantAndUser(tenantId: string, userId: string): Promise<TenantMember | null> {
    const { data, error } = await this.supabase
      .from('tenant_members')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapFromDb(data);
  }

  /**
   * List members for a tenant with user details
   */
  async findByTenant(
    tenantId: string,
    options?: {
      status?: MemberStatus;
      role?: MemberRole;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: MemberWithUser[]; total: number }> {
    let query = this.supabase
      .from('tenant_members')
      .select(`
        *,
        user:auth.users!tenant_members_user_id_fkey (
          id,
          email,
          raw_user_meta_data
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.role) {
      query = query.eq('role', options.role);
    }

    if (options?.offset !== undefined && options?.limit) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    } else if (options?.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('joined_at', { ascending: false, nullsFirst: false });

    const { data, error, count } = await query;

    if (error) throw error;

    const members = (data || []).map(row => ({
      ...this.mapFromDb(row),
      user: row.user ? {
        id: row.user.id,
        email: row.user.email,
        name: row.user.raw_user_meta_data?.name,
        avatarUrl: row.user.raw_user_meta_data?.avatar_url
      } : undefined
    }));

    return {
      data: members,
      total: count || 0
    };
  }

  /**
   * Get user's memberships across all tenants
   */
  async findByUser(
    userId: string,
    options?: { status?: MemberStatus }
  ): Promise<TenantMember[]> {
    let query = this.supabase
      .from('tenant_members')
      .select('*')
      .eq('user_id', userId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(row => this.mapFromDb(row));
  }

  /**
   * Count members in a tenant
   */
  async countByTenant(tenantId: string, status?: MemberStatus): Promise<number> {
    let query = this.supabase
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  }

  /**
   * Count tenant admins
   */
  async countAdmins(tenantId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', MemberRole.TENANT_ADMIN)
      .eq('status', MemberStatus.ACTIVE);

    if (error) throw error;

    return count || 0;
  }

  /**
   * Create new member
   */
  async create(
    tenantId: string,
    dto: CreateMemberDTO,
    invitedBy?: string
  ): Promise<TenantMember> {
    // Check if member already exists
    const existing = await this.findByTenantAndUser(tenantId, dto.userId);
    if (existing) {
      throw new Error('User is already a member of this tenant');
    }

    const now = new Date().toISOString();
    const isActive = dto.status === MemberStatus.ACTIVE;

    const { data, error } = await this.supabase
      .from('tenant_members')
      .insert({
        tenant_id: tenantId,
        user_id: dto.userId,
        role: dto.role,
        status: dto.status || MemberStatus.PENDING,
        invited_at: now,
        invited_by: invitedBy,
        joined_at: isActive ? now : null
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Update member
   */
  async update(id: string, dto: UpdateMemberDTO): Promise<TenantMember> {
    const updates: any = {};

    if (dto.role !== undefined) updates.role = dto.role;
    if (dto.status !== undefined) updates.status = dto.status;

    // Set joined_at when activating
    if (dto.status === MemberStatus.ACTIVE) {
      const existing = await this.findById(id);
      if (existing && !existing.joinedAt) {
        updates.joined_at = new Date().toISOString();
      }
    }

    const { data, error } = await this.supabase
      .from('tenant_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Activate pending member
   */
  async activate(id: string): Promise<TenantMember> {
    return this.update(id, { status: MemberStatus.ACTIVE });
  }

  /**
   * Deactivate member
   */
  async deactivate(id: string): Promise<TenantMember> {
    return this.update(id, { status: MemberStatus.DEACTIVATED });
  }

  /**
   * Delete member (hard delete)
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('tenant_members')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Check if user can be removed (not last admin)
   */
  async canRemoveMember(tenantId: string, memberId: string): Promise<boolean> {
    // Get the member to check
    const member = await this.findById(memberId);
    if (!member) return false;

    // If not an admin, can always be removed
    if (member.role !== MemberRole.TENANT_ADMIN) return true;

    // Check if there are other active admins
    const adminCount = await this.countAdmins(tenantId);
    return adminCount > 1;
  }

  /**
   * Map database row to domain model
   */
  private mapFromDb(data: any): TenantMember {
    return {
      id: data.id,
      tenantId: data.tenant_id,
      userId: data.user_id,
      role: data.role as MemberRole,
      status: data.status as MemberStatus,
      joinedAt: data.joined_at,
      invitedAt: data.invited_at,
      invitedBy: data.invited_by,
      updatedAt: data.updated_at
    };
  }
}