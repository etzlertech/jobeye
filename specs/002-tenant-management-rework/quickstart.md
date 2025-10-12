# Quickstart: Tenant Management

## Overview
This guide demonstrates the key tenant management workflows from different user perspectives.

## Prerequisites
- Supabase project with auth enabled
- Database migrations applied (see `/migrations/tenant-tables.sql`)
- Metadata backfill script run for existing users

## Scenarios

### 1. System Admin: Create New Tenant

```bash
# As system admin, create a new tenant
curl -X POST http://localhost:3000/api/system/tenants \
  -H "Authorization: Bearer $SYSTEM_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "starter",
    "adminEmail": "admin@acme.com"
  }'

# Response
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "status": "active",
  "plan": "starter"
}
```

### 2. Tenant Admin: Invite Team Member

```bash
# As tenant admin, invite a new member
curl -X POST http://localhost:3000/api/tenant/invitations \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "role": "member"
  }'

# Response  
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "email": "john@example.com",
  "role": "member",
  "status": "pending",
  "expiresAt": "2025-10-19T12:00:00Z"
}
```

### 3. User: Accept Invitation

```bash
# User receives invitation email with token
# Accept invitation (authenticated)
curl -X POST http://localhost:3000/api/user/invitations/$TOKEN/accept \
  -H "Authorization: Bearer $USER_TOKEN"

# Response
{
  "success": true,
  "tenant": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corp",
    "role": "member",
    "status": "active"
  }
}
```

### 4. User: Request to Join Tenant

```bash
# User requests access to a tenant
curl -X POST http://localhost:3000/api/user/tenant-request \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "acme-corp",
    "message": "I am the new developer starting this week"
  }'

# Response
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "tenantSlug": "acme-corp",
  "status": "pending",
  "requestedAt": "2025-10-12T10:30:00Z"
}
```

### 5. Tenant Admin: Approve Join Request

```bash
# List pending requests
curl http://localhost:3000/api/tenant/requests \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN"

# Approve request
curl -X POST http://localhost:3000/api/tenant/requests/$REQUEST_ID/approve \
  -H "Authorization: Bearer $TENANT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "member"}'
```

### 6. Context Resolution in Application

```typescript
// In API route or server component
import { getRequestContext } from '@/lib/auth/context';

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    console.log('Tenant:', context.tenantId);
    console.log('Roles:', context.roles);
    console.log('Source:', context.source); // 'session' or 'header'
    
    // Use context for data filtering
    const items = await getItemsForTenant(context.tenantId);
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: 'No tenant context' }, { status: 401 });
  }
}
```

### 7. UI Components

```typescript
// Display tenant badge
import { TenantBadge } from '@/components/tenant/TenantBadge';

export function Header() {
  return (
    <header>
      <TenantBadge />
      {/* Shows: "Acme Corp • Member" */}
    </header>
  );
}

// Guard component usage
import { TenantGuard } from '@/components/tenant/TenantGuard';

export function AdminPanel() {
  return (
    <TenantGuard requiredRole="tenant_admin">
      {/* Only visible to tenant admins */}
      <TenantSettings />
    </TenantGuard>
  );
}
```

### 8. Metadata Backfill (One-time)

```bash
# Run the backfill script for existing users
npm run scripts:backfill-metadata

# What it does:
# 1. Finds all existing users
# 2. Checks their current tenant associations
# 3. Updates auth.users app_metadata with:
#    - tenant_id: Their primary tenant
#    - roles: ['member'] or ['tenant_admin'] based on current data
# 4. Logs all changes for audit trail
```

## Testing Checklist

- [ ] System admin can create tenant
- [ ] Tenant admin can invite users
- [ ] Users can accept invitations
- [ ] Users can request tenant access
- [ ] Tenant admin can approve/reject requests
- [ ] Context resolution works in API routes
- [ ] UI shows correct tenant/role info
- [ ] Cannot access other tenant's data
- [ ] Header fallback works with warning
- [ ] Metadata backfill completes successfully

## Common Issues

### "No tenant context"
- Check JWT includes app_metadata
- Ensure metadata backfill was run
- Verify session is valid

### "Not authorized"  
- Confirm user has required role
- Check tenant membership is active
- Verify RLS policies are correct

### "Tenant not found"
- Ensure tenant slug is correct
- Check tenant status is active
- Verify user has access to tenant