import { SupabaseClient } from '@supabase/supabase-js';
import {
  TenantInvitation,
  InvitationStatus,
  MemberRole,
  CreateInvitationDTO,
  InvitationWithDetails
} from '../types';

export class TenantInvitationRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get invitation by ID
   */
  async findById(id: string): Promise<TenantInvitation | null> {
    const { data, error } = await this.supabase
      .from('tenant_invitations')
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
   * Get invitation by token
   */
  async findByToken(token: string): Promise<TenantInvitation | null> {
    const { data, error } = await this.supabase
      .from('tenant_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapFromDb(data);
  }

  /**
   * Get invitation with details (tenant and inviter info)
   */
  async findByTokenWithDetails(token: string): Promise<InvitationWithDetails | null> {
    const { data, error } = await this.supabase
      .from('tenant_invitations')
      .select(`
        *,
        tenant:tenants!tenant_invitations_tenant_id_fkey (
          id,
          name,
          slug
        ),
        inviter:auth.users!tenant_invitations_created_by_fkey (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      ...this.mapFromDb(data),
      tenant: data.tenant,
      inviter: data.inviter ? {
        id: data.inviter.id,
        email: data.inviter.email,
        name: data.inviter.raw_user_meta_data?.name
      } : undefined
    };
  }

  /**
   * List invitations for a tenant
   */
  async findByTenant(
    tenantId: string,
    options?: {
      status?: InvitationStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: TenantInvitation[]; total: number }> {
    let query = this.supabase
      .from('tenant_invitations')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.offset !== undefined && options?.limit) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    } else if (options?.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    const invitations = (data || []).map(row => this.mapFromDb(row));

    return {
      data: invitations,
      total: count || 0
    };
  }

  /**
   * Get invitations for an email address
   */
  async findByEmail(email: string, status?: InvitationStatus): Promise<TenantInvitation[]> {
    let query = this.supabase
      .from('tenant_invitations')
      .select('*')
      .eq('email', email.toLowerCase());

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(row => this.mapFromDb(row));
  }

  /**
   * Check if email has pending invitation
   */
  async hasPendingInvitation(tenantId: string, email: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('tenant_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('email', email.toLowerCase())
      .eq('status', InvitationStatus.PENDING);

    if (error) throw error;

    return (count || 0) > 0;
  }

  /**
   * Create new invitation
   */
  async create(
    tenantId: string,
    dto: CreateInvitationDTO,
    createdBy: string
  ): Promise<TenantInvitation> {
    // Check if already has pending invitation
    if (await this.hasPendingInvitation(tenantId, dto.email)) {
      throw new Error('User already has a pending invitation');
    }

    // Calculate expiration
    const hoursUntilExpiry = dto.expiresIn || 168; // Default 7 days
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hoursUntilExpiry);

    const { data, error } = await this.supabase
      .from('tenant_invitations')
      .insert({
        tenant_id: tenantId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        status: InvitationStatus.PENDING,
        expires_at: expiresAt.toISOString(),
        created_by: createdBy
      })
      .select()
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Accept invitation
   */
  async accept(id: string, userId?: string): Promise<TenantInvitation> {
    const updates: any = {
      status: InvitationStatus.ACCEPTED,
      accepted_at: new Date().toISOString()
    };

    if (userId) {
      updates.user_id = userId;
    }

    const { data, error } = await this.supabase
      .from('tenant_invitations')
      .update(updates)
      .eq('id', id)
      .eq('status', InvitationStatus.PENDING) // Only pending can be accepted
      .select()
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Cancel invitation
   */
  async cancel(id: string): Promise<TenantInvitation> {
    const { data, error } = await this.supabase
      .from('tenant_invitations')
      .update({ status: InvitationStatus.CANCELLED })
      .eq('id', id)
      .eq('status', InvitationStatus.PENDING) // Only pending can be cancelled
      .select()
      .single();

    if (error) throw error;

    return this.mapFromDb(data);
  }

  /**
   * Expire old invitations
   */
  async expireOldInvitations(): Promise<number> {
    const { data, error } = await this.supabase
      .from('tenant_invitations')
      .update({ status: InvitationStatus.EXPIRED })
      .eq('status', InvitationStatus.PENDING)
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw error;

    return data?.length || 0;
  }

  /**
   * Delete invitation (hard delete)
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('tenant_invitations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Map database row to domain model
   */
  private mapFromDb(data: any): TenantInvitation {
    return {
      id: data.id,
      tenantId: data.tenant_id,
      email: data.email,
      userId: data.user_id,
      role: data.role as MemberRole,
      status: data.status as InvitationStatus,
      token: data.token,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      createdBy: data.created_by,
      acceptedAt: data.accepted_at
    };
  }
}