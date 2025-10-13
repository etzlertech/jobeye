/**
 * Tenant Domain Types
 */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: TenantPlan;
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  PENDING = 'pending'
}

export enum TenantPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  TRIAL = 'trial'
}

export interface TenantSettings {
  features: {
    maxUsers?: number;
    maxItems?: number;
    advancedReporting?: boolean;
  };
  branding?: {
    primaryColor?: string;
    logo?: string;
  };
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: string;
  invitedAt?: string;
  invitedBy?: string;
  updatedAt: string;
  // Include user info when fetched with join
  user?: {
    id: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  };
}

export enum MemberRole {
  MEMBER = 'member',
  TENANT_ADMIN = 'tenant_admin'
}

export enum MemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  DEACTIVATED = 'deactivated'
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  userId?: string;
  role: MemberRole;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  acceptedAt?: string;
  // Include tenant info when needed
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  // Include inviter info when fetched with join
  inviter?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

// System-wide roles (stored in JWT metadata)
export enum SystemRole {
  SYSTEM_ADMIN = 'system_admin',
  USER = 'user'
}

// Create/Update DTOs
export interface CreateTenantDTO {
  name: string;
  slug: string;
  plan?: TenantPlan;
  settings?: TenantSettings;
  adminEmail?: string; // For system admin to assign initial admin
}

export interface UpdateTenantDTO {
  name?: string;
  status?: TenantStatus;
  plan?: TenantPlan;
  settings?: TenantSettings;
}

export interface CreateMemberDTO {
  userId: string;
  role: MemberRole;
  status?: MemberStatus;
}

export interface UpdateMemberDTO {
  role?: MemberRole;
  status?: MemberStatus;
}

export interface CreateInvitationDTO {
  email: string;
  role: MemberRole;
  expiresIn?: number; // Hours until expiration
}

export interface JoinRequestDTO {
  tenantSlug: string;
  message?: string;
}

// API Response types
export interface TenantWithMemberCount extends Tenant {
  memberCount: number;
}

export interface MemberWithUser extends TenantMember {
  user: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  };
}

export interface InvitationWithDetails extends TenantInvitation {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  inviter: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface UserTenantInfo {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt?: string;
}
