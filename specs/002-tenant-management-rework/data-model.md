# Data Model: Tenant Management

## Overview
Core data structures for multi-tenant system with role-based access control.

## Entities

### Tenant
Represents an organization/company in the system.

```typescript
interface Tenant {
  id: string;                    // UUID
  name: string;                  // Company name
  slug: string;                  // URL-friendly identifier (unique)
  status: TenantStatus;          // active, suspended, cancelled
  plan: TenantPlan;              // free, starter, pro, enterprise
  settings: TenantSettings;      // JSON configuration
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  createdBy: string;             // User ID who created
}

enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled'
}

enum TenantPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

interface TenantSettings {
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
```

### TenantMember
Links users to tenants with specific roles.

```typescript
interface TenantMember {
  id: string;                    // UUID
  tenantId: string;              // FK to tenants
  userId: string;                // FK to auth.users
  role: MemberRole;              // member, tenant_admin
  status: MemberStatus;          // active, pending, deactivated
  joinedAt: string;              // ISO timestamp
  invitedAt?: string;            // ISO timestamp
  invitedBy?: string;            // User ID who invited
  updatedAt: string;             // ISO timestamp
}

enum MemberRole {
  MEMBER = 'member',
  TENANT_ADMIN = 'tenant_admin'
}

enum MemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  DEACTIVATED = 'deactivated'
}
```

### TenantInvitation
Tracks pending invitations to join tenants.

```typescript
interface TenantInvitation {
  id: string;                    // UUID
  tenantId: string;              // FK to tenants
  email: string;                 // Invited email
  userId?: string;               // FK if user exists
  role: MemberRole;              // Intended role
  status: InvitationStatus;      // pending, accepted, expired, cancelled
  token: string;                 // Secure random token
  expiresAt: string;             // ISO timestamp
  createdAt: string;             // ISO timestamp
  createdBy: string;             // User ID who created
  acceptedAt?: string;           // ISO timestamp
}

enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}
```

### SystemRole
System-wide roles (stored in auth metadata, not database).

```typescript
interface UserMetadata {
  tenantId?: string;             // Current active tenant
  roles: SystemRole[];           // System-wide roles
}

enum SystemRole {
  SYSTEM_ADMIN = 'system_admin', // Can manage all tenants
  USER = 'user'                  // Regular user
}
```

## Database Schema

### tenants
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
```

### tenant_members
```sql
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure user can only have one membership per tenant
  UNIQUE(tenant_id, user_id)
);

-- Indexes
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_status ON tenant_members(status);
```

### tenant_invitations
```sql
CREATE TABLE tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  
  -- Prevent duplicate pending invitations
  UNIQUE(tenant_id, email, status) WHERE status = 'pending'
);

-- Indexes
CREATE INDEX idx_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX idx_invitations_email ON tenant_invitations(email);
CREATE INDEX idx_invitations_token ON tenant_invitations(token);
CREATE INDEX idx_invitations_status ON tenant_invitations(status);
```

## State Transitions

### Tenant Lifecycle
```
created -> active -> suspended -> active
                  -> cancelled (terminal)
```

### Member Lifecycle
```
invited (invitation created) -> pending (user exists) -> active
                            -> expired
                            -> cancelled
active -> deactivated -> active
```

### Invitation Lifecycle
```
pending -> accepted (creates tenant_member)
        -> expired (after expiry time)
        -> cancelled (by admin)
```

## Validation Rules

### Tenant
- name: Required, 2-100 characters
- slug: Required, lowercase, alphanumeric + hyphens, 3-50 chars
- status: Must be valid enum value
- plan: Must be valid enum value

### TenantMember
- role: Must be valid enum value
- status: Must be valid enum value
- joined_at: Set when status changes to active
- Cannot have duplicate active memberships

### TenantInvitation
- email: Valid email format
- expires_at: Must be future date (default 7 days)
- token: Cryptographically secure random
- Cannot have duplicate pending invitations for same email/tenant

## Access Patterns

### By Tenant Admin
- View all members of their tenant
- Invite new members
- Change member roles (except their own)
- Deactivate members
- Cancel pending invitations

### By System Admin
- View all tenants
- Create new tenants
- Assign tenant admins
- Move users between tenants
- Suspend/reactivate tenants

### By Regular User
- View tenants they belong to
- Request access to tenants
- Accept invitations
- Leave tenants (deactivate membership)

## RLS Policies

### tenants
- System admins: Full access
- Tenant admins: Read own tenant, update settings
- Members: Read own tenant only

### tenant_members  
- System admins: Full access
- Tenant admins: Manage own tenant members
- Users: Read own memberships, update own status

### tenant_invitations
- System admins: Full access  
- Tenant admins: Manage own tenant invitations
- Users: Read invitations for their email