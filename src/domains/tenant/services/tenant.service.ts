import { SupabaseClient } from '@supabase/supabase-js';
import {
  TenantRepository,
  TenantMemberRepository,
  TenantInvitationRepository
} from '../repositories';
import {
  Tenant,
  TenantMember,
  TenantInvitation,
  CreateTenantDTO,
  UpdateTenantDTO,
  CreateMemberDTO,
  UpdateMemberDTO,
  CreateInvitationDTO,
  MemberRole,
  MemberStatus,
  InvitationStatus,
  TenantWithMemberCount,
  MemberWithUser,
  InvitationWithDetails,
  UserTenantInfo
} from '../types';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export class TenantService {
  private tenantRepo: TenantRepository;
  private memberRepo: TenantMemberRepository;
  private invitationRepo: TenantInvitationRepository;

  constructor(private supabase: SupabaseClient) {
    this.tenantRepo = new TenantRepository(supabase);
    this.memberRepo = new TenantMemberRepository(supabase);
    this.invitationRepo = new TenantInvitationRepository(supabase);
  }

  /**
   * Create new tenant with initial admin
   */
  async createTenant(
    dto: CreateTenantDTO,
    createdBy: string
  ): Promise<{ tenant: Tenant; member?: TenantMember }> {
    // Create the tenant
    const tenant = await this.tenantRepo.create(dto, createdBy);

    // If admin email provided, create initial admin member
    let member: TenantMember | undefined;
    if (dto.adminEmail) {
      // Find user by email
      const { data: users, error } = await this.supabase
        .from('auth.users')
        .select('id')
        .eq('email', dto.adminEmail)
        .limit(1);

      if (!error && users && users.length > 0) {
        member = await this.memberRepo.create(
          tenant.id,
          {
            userId: users[0].id,
            role: MemberRole.TENANT_ADMIN,
            status: MemberStatus.ACTIVE
          },
          createdBy
        );

        // Update user's app_metadata
        await this.updateUserMetadata(users[0].id, tenant.id, [MemberRole.TENANT_ADMIN]);
      }
    }

    return { tenant, member };
  }

  /**
   * Update tenant details
   */
  async updateTenant(
    tenantId: string,
    dto: UpdateTenantDTO,
    requestorId: string
  ): Promise<Tenant> {
    // Verify requestor is tenant admin
    const member = await this.memberRepo.findByTenantAndUser(tenantId, requestorId);
    if (!member || member.role !== MemberRole.TENANT_ADMIN || member.status !== MemberStatus.ACTIVE) {
      throw new Error('Unauthorized: Must be active tenant admin');
    }

    return this.tenantRepo.update(tenantId, dto);
  }

  /**
   * List all tenants (system admin only)
   */
  async listTenants(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: TenantWithMemberCount[]; total: number }> {
    return this.tenantRepo.findAll(options as any);
  }

  /**
   * Get tenant by ID or slug
   */
  async getTenant(idOrSlug: string): Promise<Tenant | null> {
    // Check if it's a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    
    if (isUuid) {
      return this.tenantRepo.findById(idOrSlug);
    } else {
      return this.tenantRepo.findBySlug(idOrSlug);
    }
  }

  /**
   * Get user's tenants with roles
   */
  async getUserTenants(userId: string): Promise<UserTenantInfo[]> {
    const memberships = await this.memberRepo.findByUser(userId);
    const tenants = await this.tenantRepo.findByUserId(userId);

    return memberships.map(membership => {
      const tenant = tenants.find(t => t.id === membership.tenantId);
      if (!tenant) return null;

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt
      };
    }).filter(Boolean) as UserTenantInfo[];
  }

  /**
   * List tenant members
   */
  async listMembers(
    tenantId: string,
    options?: {
      status?: MemberStatus;
      role?: MemberRole;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: MemberWithUser[]; total: number }> {
    return this.memberRepo.findByTenant(tenantId, options);
  }

  /**
   * Add member to tenant (direct add, no invitation)
   */
  async addMember(
    tenantId: string,
    dto: CreateMemberDTO,
    addedBy: string
  ): Promise<TenantMember> {
    const member = await this.memberRepo.create(tenantId, dto, addedBy);

    // Update user's metadata if active
    if (member.status === MemberStatus.ACTIVE) {
      await this.updateUserMetadata(member.userId, tenantId, [member.role]);
    }

    return member;
  }

  /**
   * Update member role/status
   */
  async updateMember(
    memberId: string,
    dto: UpdateMemberDTO,
    updatedBy: string
  ): Promise<TenantMember> {
    const member = await this.memberRepo.update(memberId, dto);

    // Update user's metadata if role changed
    if (dto.role || dto.status) {
      await this.updateUserMetadata(
        member.userId,
        member.tenantId,
        [member.role]
      );
    }

    return member;
  }

  /**
   * Remove member from tenant
   */
  async removeMember(
    memberId: string,
    removedBy: string
  ): Promise<void> {
    const member = await this.memberRepo.findById(memberId);
    if (!member) throw new Error('Member not found');

    // Check if can be removed
    const canRemove = await this.memberRepo.canRemoveMember(member.tenantId, memberId);
    if (!canRemove) {
      throw new Error('Cannot remove last tenant admin');
    }

    // Hard delete the membership
    await this.memberRepo.delete(memberId);

    // Update user metadata to remove tenant
    await this.removeUserFromTenant(member.userId, member.tenantId);
  }

  /**
   * Create invitation
   */
  async createInvitation(
    tenantId: string,
    dto: CreateInvitationDTO,
    createdBy: string
  ): Promise<TenantInvitation> {
    // Check if user is already a member
    const { data: users } = await this.supabase
      .from('auth.users')
      .select('id')
      .eq('email', dto.email)
      .limit(1);

    if (users && users.length > 0) {
      const existingMember = await this.memberRepo.findByTenantAndUser(
        tenantId,
        users[0].id
      );
      if (existingMember) {
        throw new Error('User is already a member of this tenant');
      }
    }

    return this.invitationRepo.create(tenantId, dto, createdBy);
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<TenantMember> {
    // Get invitation with details
    const invitation = await this.invitationRepo.findByTokenWithDetails(token);
    if (!invitation) {
      throw new Error('Invalid invitation');
    }

    // Validate invitation
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error('Invitation is no longer valid');
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      // Mark as expired
      await this.invitationRepo.cancel(invitation.id);
      throw new Error('Invitation has expired');
    }

    // Check if already a member
    const existingMember = await this.memberRepo.findByTenantAndUser(
      invitation.tenantId,
      userId
    );
    if (existingMember) {
      throw new Error('Already a member of this tenant');
    }

    // Accept the invitation
    await this.invitationRepo.accept(invitation.id, userId);

    // Create member record
    const member = await this.memberRepo.create(
      invitation.tenantId,
      {
        userId,
        role: invitation.role,
        status: MemberStatus.ACTIVE
      },
      invitation.createdBy
    );

    // Update user metadata
    await this.updateUserMetadata(userId, invitation.tenantId, [invitation.role]);

    return member;
  }

  /**
   * List invitations for a tenant
   */
  async listInvitations(
    tenantId: string,
    options?: {
      status?: InvitationStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: TenantInvitation[]; total: number }> {
    return this.invitationRepo.findByTenant(tenantId, options);
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string): Promise<TenantInvitation> {
    return this.invitationRepo.cancel(invitationId);
  }

  /**
   * Switch user's active tenant
   */
  async switchTenant(userId: string, tenantId: string): Promise<void> {
    // Verify user is member of the tenant
    const member = await this.memberRepo.findByTenantAndUser(tenantId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new Error('Not an active member of this tenant');
    }

    // Update user's metadata
    await this.updateUserMetadata(userId, tenantId, [member.role]);
  }

  /**
   * Leave tenant (user action)
   */
  async leaveTenant(userId: string, tenantId: string): Promise<void> {
    const member = await this.memberRepo.findByTenantAndUser(tenantId, userId);
    if (!member) throw new Error('Not a member of this tenant');

    // Check if can leave
    const canRemove = await this.memberRepo.canRemoveMember(tenantId, member.id);
    if (!canRemove) {
      throw new Error('Cannot leave: You are the last admin');
    }

    // Remove membership
    await this.memberRepo.delete(member.id);

    // Update user metadata
    await this.removeUserFromTenant(userId, tenantId);
  }

  /**
   * Helper: Update user's app_metadata
   */
  private async updateUserMetadata(
    userId: string,
    tenantId: string,
    roles: string[]
  ): Promise<void> {
    // This would normally use admin API, but for now we'll skip
    // as it requires service role key configuration
    console.log('Would update user metadata:', { userId, tenantId, roles });
  }

  /**
   * Helper: Remove user from tenant in metadata
   */
  private async removeUserFromTenant(
    userId: string,
    tenantId: string
  ): Promise<void> {
    // This would normally use admin API
    console.log('Would remove user from tenant:', { userId, tenantId });
  }
}