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
  UserTenantInfo,
  TenantStatus
} from '../types';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export class TenantService {
  private tenantRepo: TenantRepository;
  private memberRepo: TenantMemberRepository;
  private invitationRepo: TenantInvitationRepository;
  private adminClient?: SupabaseClient;

  constructor(private supabase: SupabaseClient) {
    this.tenantRepo = new TenantRepository(supabase);
    this.memberRepo = new TenantMemberRepository(supabase);
    this.invitationRepo = new TenantInvitationRepository(supabase);
  }

  /**
   * Get admin client for user metadata operations
   */
  private getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase admin credentials');
      }

      this.adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }

    return this.adminClient;
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
      try {
        // Find user by email using admin client
        const adminClient = this.getAdminClient();
        // TODO: Replace with getUserByEmail when available in SDK
        const { data, error } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        
        if (!error) {
          const users = data?.users ?? [];
          const user = users.find((u): u is typeof u & { email: string } => Boolean(u.email) && u.email === dto.adminEmail);
          
          if (user) {
            member = await this.memberRepo.create(
              tenant.id,
              {
                userId: user.id,
                role: MemberRole.TENANT_ADMIN,
                status: MemberStatus.ACTIVE
              },
              createdBy
            );

            // Update user's app_metadata
            await this.updateUserMetadata(user.id, tenant.id, [MemberRole.TENANT_ADMIN]);
          }
        }
      } catch (error) {
        console.error('Failed to find user by email:', error);
        // Continue without creating member - tenant can add admin later
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
    status?: TenantStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: TenantWithMemberCount[]; total: number }> {
    const result = await this.tenantRepo.findAll(options);
    const tenantIds = result.data.map((tenant) => tenant.id);

    if (tenantIds.length === 0) {
      return result;
    }

    const [activeMemberCounts, jobsLast30d] = await Promise.all([
      this.fetchActiveMemberCounts(tenantIds),
      this.fetchJobsCreatedLast30Days(tenantIds)
    ]);

    const enriched = result.data.map((tenant) => ({
      ...tenant,
      activeMemberCount: activeMemberCounts.get(tenant.id) ?? tenant.memberCount,
      jobsLast30d: jobsLast30d.get(tenant.id) ?? 0
    }));

    return { data: enriched, total: result.total };
  }

  /**
   * Update tenant status (system admin only)
   */
  async updateTenantStatus(
    tenantId: string,
    status: TenantStatus
  ): Promise<Tenant> {
    return this.tenantRepo.update(tenantId, { status });
  }

  private async fetchActiveMemberCounts(tenantIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    const { data, error } = await this.supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('status', MemberStatus.ACTIVE)
      .in('tenant_id', tenantIds);

    if (error) {
      console.error('[TenantService] Failed to fetch active member counts', error);
      return counts;
    }

    (data || []).forEach((row: any) => {
      const current = counts.get(row.tenant_id) ?? 0;
      counts.set(row.tenant_id, current + 1);
    });

    return counts;
  }

  private async fetchJobsCreatedLast30Days(tenantIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('jobs')
      .select('tenant_id')
      .gte('created_at', since)
      .in('tenant_id', tenantIds);

    if (error) {
      console.error('[TenantService] Failed to fetch jobs count (30d)', error);
      return counts;
    }

    (data || []).forEach((row: any) => {
      const current = counts.get(row.tenant_id) ?? 0;
      counts.set(row.tenant_id, current + 1);
    });

    return counts;
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
    const result = await this.memberRepo.findByTenant(tenantId, options);
    
    // Enrich with user data using admin client
    if (result.data.length > 0) {
      try {
        const adminClient = this.getAdminClient();
        const userIds = result.data.map(m => m.userId);
        
        // TODO: Improve performance - replace listUsers with getUserById batch calls
        // Current implementation fetches all users and filters locally, which won't scale
        // Consider: 1) Batch getUserById calls, 2) Add pagination, 3) Cache user lookups
        const { data, error } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000 // WARNING: This will break at scale
        });
        
        if (!error) {
          const users = data?.users ?? [];
          // Create a map of user data
          const userMap = new Map(
            users
              .filter(u => userIds.includes(u.id))
              .map(u => [u.id, {
                id: u.id,
                email: u.email || '',
                name: u.user_metadata?.name || u.email?.split('@')[0] || '',
                avatarUrl: u.user_metadata?.avatar_url
              }])
          );
          
          // Enrich members with user data
          result.data = result.data.map(member => ({
            ...member,
            user: userMap.get(member.userId) || {
              id: member.userId,
              email: 'Unknown',
              name: 'Unknown'
            }
          }));
        }
      } catch (error) {
        console.error('Failed to enrich user data:', error);
        // Return members without user data rather than failing
      }
    }
    
    return result;
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
    try {
      const adminClient = this.getAdminClient();
      // TODO: Replace with getUserByEmail when available in SDK
      const { data, error } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      
      if (!error) {
        const users = data?.users ?? [];
        const user = users.find((u): u is typeof u & { email: string } => Boolean(u.email) && u.email === dto.email);
        
        if (user) {
          const existingMember = await this.memberRepo.findByTenantAndUser(
            tenantId,
            user.id
          );
          if (existingMember) {
            throw new Error('User is already a member of this tenant');
          }
        }
      }
    } catch (error) {
      console.error('Failed to check existing membership:', error);
      // Continue - worst case they get an error when accepting invitation
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
    const result = await this.invitationRepo.findByTenant(tenantId, options);
    
    // Enrich with inviter data if we have invitations
    if (result.data.length > 0) {
      try {
        const adminClient = this.getAdminClient();
        const userIds = [...new Set(result.data.map(inv => inv.createdBy))].filter(Boolean);
        
        // Fetch users
        // TODO: Replace with batch getUserById calls for better performance
        const { data, error } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        
        if (!error) {
          const users = data?.users ?? [];
          // Create user map
          const userMap = new Map(
            users
              .filter(u => userIds.includes(u.id))
              .map(u => [u.id, {
                id: u.id,
                email: u.email || '',
                name: u.user_metadata?.name || u.email?.split('@')[0] || ''
              }])
          );
          
          // Enrich invitations
          const enrichedData = result.data.map(invitation => ({
            ...invitation,
            inviter: invitation.createdBy
              ? userMap.get(invitation.createdBy) ?? invitation.inviter
              : invitation.inviter
          }));
          
          return {
            data: enrichedData,
            total: result.total
          };
        }
      } catch (error) {
        console.error('Failed to enrich inviter data:', error);
      }
    }
    
    // Return without enrichment
    return result;
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
    try {
      const adminClient = this.getAdminClient();
      
      // Update user metadata
      const { error } = await adminClient.auth.admin.updateUserById(
        userId,
        {
          app_metadata: {
            tenant_id: tenantId,
            roles: roles
          }
        }
      );

      if (error) {
        console.error('Failed to update user metadata:', error);
        throw new Error(`Failed to update user metadata: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating user metadata:', error);
      // Don't fail the whole operation if metadata update fails
      // This allows testing without service role key
    }
  }

  /**
   * Helper: Remove user from tenant in metadata
   */
  private async removeUserFromTenant(
    userId: string,
    tenantId: string
  ): Promise<void> {
    try {
      // Get user's current metadata
      const adminClient = this.getAdminClient();
      const { data: { user }, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
      
      if (fetchError || !user) {
        console.error('Failed to fetch user:', fetchError);
        return;
      }

      // If this is their current tenant, clear it
      if (user.app_metadata?.tenant_id === tenantId) {
        // Find another tenant they belong to
        const otherMemberships = await this.memberRepo.findByUser(userId, {
          status: MemberStatus.ACTIVE
        });
        
        const nextTenant = otherMemberships.find(m => m.tenantId !== tenantId);
        
        const { error } = await adminClient.auth.admin.updateUserById(
          userId,
          {
            app_metadata: {
              tenant_id: nextTenant?.tenantId || null,
              roles: nextTenant ? [nextTenant.role] : []
            }
          }
        );

        if (error) {
          console.error('Failed to update user metadata:', error);
        }
      }
    } catch (error) {
      console.error('Error removing user from tenant:', error);
      // Don't fail the whole operation if metadata update fails
    }
  }
}
