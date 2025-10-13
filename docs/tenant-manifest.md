# Tenant Management System Implementation Manifest

## Overview
This document outlines the comprehensive tenant management system implementation for JobEye, transitioning from header-based authentication to session-based JWT authentication with full multi-tenancy support.

## Architecture Summary

### Authentication Flow
1. **Primary**: JWT app_metadata (tenant_id, roles) from Supabase Auth
2. **Fallback**: x-tenant-id header (dev mode only)
3. **Context**: getRequestContext() provides unified access

### Database Schema
```
tenants                    - Organization records
tenant_members            - User-tenant relationships
tenant_invitations        - Pending invitations
```

### Key Components
- **TenantService**: Core business logic
- **TenantRepository/MemberRepository/InvitationRepository**: Data access
- **TenantBadge/TenantGuard**: UI components
- **getRequestContext**: Unified context resolution

## Implementation Tasks

### Phase 1: Session Context & Metadata ✅
- [x] Create getRequestContext helper with session/header fallback
- [x] Design tenant tables and RLS policies
- [x] Create metadata backfill script
- [x] Implement tenant repositories

### Phase 2: Tenant Domain Foundation ✅
- [x] Build TenantService with all operations
- [x] Create tenant member management
- [x] Implement invitation system
- [x] Add API routes for tenant operations

### Phase 3: UI Integration 🚧
- [x] Create TenantBadge component
- [x] Create TenantGuard component for role-based UI
- [ ] Build system admin console UI
- [ ] Build tenant admin approval screens
- [ ] Refactor CRUD pages to use getRequestContext
- [ ] Update demo pages to detect session context first

### Phase 4: Testing & Cutover 📋
- [ ] Run metadata backfill script
- [ ] Create seed data for tenant/user/invitation flows
- [ ] Write integration tests for role-based access
- [ ] Remove/feature-flag header fallback after validation
- [ ] Fix TypeScript pre-commit errors

## API Endpoints

### User Context
- `GET /api/user/tenants` - List user's tenants
- `GET /api/user/invitations` - List pending invitations
- `POST /api/user/invitations/[token]/accept` - Accept invitation
- `POST /api/user/tenants/[tenantId]/switch` - Switch active tenant
- `POST /api/user/tenants/[tenantId]/leave` - Leave tenant

### Tenant Management
- `GET /api/tenants/[tenantId]` - Get tenant details
- `PUT /api/tenants/[tenantId]` - Update tenant
- `GET /api/tenants/[tenantId]/members` - List members
- `POST /api/tenants/[tenantId]/members` - Add member
- `PUT /api/tenants/[tenantId]/members/[memberId]` - Update member
- `DELETE /api/tenants/[tenantId]/members/[memberId]` - Remove member
- `GET /api/tenants/[tenantId]/invitations` - List invitations
- `POST /api/tenants/[tenantId]/invitations` - Create invitation
- `DELETE /api/tenants/[tenantId]/invitations/[invitationId]` - Cancel invitation

### System Admin
- `GET /api/system/tenants` - List all tenants
- `POST /api/system/tenants` - Create tenant

## Role-Based Access Control

### Roles
- **system_admin**: Full system access
- **tenant_admin**: Full tenant access
- **member**: Standard user access

### Permissions Matrix
| Operation | system_admin | tenant_admin | member |
|-----------|--------------|--------------|---------|
| Create tenant | ✅ | ❌ | ❌ |
| Update tenant | ✅ | ✅ | ❌ |
| View tenant | ✅ | ✅ | ✅ |
| Manage members | ✅ | ✅ | ❌ |
| Create jobs | ✅ | ✅ | ✅ |
| View jobs | ✅ | ✅ | ✅ |

## Migration Strategy

### Phase 1: Dual Mode Support
1. Deploy with header fallback enabled
2. Begin updating user metadata
3. Monitor both authentication methods

### Phase 2: Metadata Population
1. Run backfill script for existing users
2. Update sign-up flow to set metadata
3. Verify all users have tenant assignments

### Phase 3: Session-Only Mode
1. Feature flag to disable header fallback
2. Update all clients to use session auth
3. Remove header dependencies

## Testing Checklist

### Unit Tests
- [ ] TenantService operations
- [ ] Repository methods
- [ ] Context resolution logic

### Integration Tests
- [ ] User tenant switching
- [ ] Invitation flow
- [ ] Role-based access

### E2E Tests
- [ ] Complete tenant onboarding
- [ ] Member management flow
- [ ] Permission boundaries

## Security Considerations

1. **RLS Policies**: All tenant data protected by row-level security
2. **Admin Operations**: Service role key required for metadata updates
3. **Invitation Tokens**: Secure random tokens with expiration
4. **Session Management**: JWT rotation and refresh handling

## Performance Optimizations

1. **User Caching**: Cache user-tenant relationships
2. **Batch Operations**: Bulk member/invitation operations
3. **Indexed Queries**: Proper database indexing
4. **Connection Pooling**: Reuse Supabase clients

## Monitoring & Observability

1. **Auth Metrics**: Track session vs header usage
2. **Tenant Metrics**: Monitor tenant creation and growth
3. **Error Tracking**: Log authentication failures
4. **Performance**: Track API response times

## Rollback Plan

1. **Feature Flags**: Disable new auth flow
2. **Header Fallback**: Re-enable x-tenant-id
3. **Database Rollback**: Keep tenant tables intact
4. **Client Updates**: Revert to header-based auth

## Success Criteria

1. All users have tenant assignments
2. Zero authentication failures
3. Role-based access working correctly
4. Performance metrics stable
5. No security vulnerabilities

## Next Steps

1. Complete remaining UI components
2. Run metadata backfill script
3. Begin integration testing
4. Plan production rollout