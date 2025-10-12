# Research: Tenant Management Rework

## Executive Summary
Research findings for implementing session-based tenant management with Supabase Auth, replacing the current header-based approach while maintaining backwards compatibility.

## Key Decisions

### 1. JWT Metadata Strategy
**Decision**: Use Supabase app_metadata for tenant_id and roles
**Rationale**: 
- app_metadata is only editable server-side, ensuring security
- Automatically included in JWT tokens
- Accessible in both client and server contexts
**Alternatives considered**: 
- user_metadata: Rejected - can be modified by users
- Custom claims: Rejected - requires custom JWT signing

### 2. Role Model
**Decision**: Three-tier role system (system_admin, tenant_admin, member)
**Rationale**:
- Simple hierarchy covers all use cases
- Maps directly to UI/API permission boundaries
- Easy to extend with additional roles later
**Alternatives considered**:
- Permission-based (RBAC): Rejected - over-complex for current needs
- Two-tier (admin/user): Rejected - doesn't handle system-level operations

### 3. Migration Strategy
**Decision**: Parallel operation with feature flags
**Rationale**:
- Zero downtime migration
- Can roll back instantly if issues arise
- Allows gradual tenant-by-tenant migration
**Alternatives considered**:
- Big bang migration: Rejected - too risky
- Database triggers: Rejected - complex to debug

### 4. Context Resolution
**Decision**: getRequestContext helper with fallback chain
**Rationale**:
- Single source of truth for tenant/role resolution
- Clear fallback pattern with logging
- Works in all server contexts (API routes, SSR, middleware)
**Alternatives considered**:
- Middleware-only: Rejected - doesn't work in all contexts
- Hook-only: Rejected - server-side needs differ from client

### 5. Database Design
**Decision**: Normalized tables with RLS policies
**Rationale**:
- Follows Supabase best practices
- Enables fine-grained access control
- Supports audit trails
**Tables**:
- tenants: Core tenant information
- tenant_members: User-tenant relationships with roles
- tenant_invitations: Pending access requests

### 6. Testing Approach
**Decision**: Integration tests for complete flows
**Rationale**:
- Tenant operations span multiple services
- Need to verify RLS policies work correctly
- User flows are the critical paths
**Test scenarios**:
- Tenant creation and setup
- User invitation and approval
- Role-based access verification
- Migration from header to session

## Technical Implementation Notes

### Supabase Auth Metadata
```typescript
// Setting metadata (admin only)
const { data, error } = await supabase.auth.admin.updateUserById(
  userId,
  {
    app_metadata: { 
      tenant_id: tenantId,
      roles: ['tenant_admin']
    }
  }
)

// Reading metadata (client/server)
const { data: { user } } = await supabase.auth.getUser()
const tenantId = user?.app_metadata?.tenant_id
const roles = user?.app_metadata?.roles || []
```

### RLS Policy Patterns
```sql
-- Example: Users can only see their tenant's data
CREATE POLICY "Users can view own tenant items" ON items
  FOR SELECT USING (
    tenant_id = auth.jwt() ->> 'app_metadata'::text -> 'tenant_id'
  );

-- System admins bypass tenant isolation
CREATE POLICY "System admins can view all" ON items
  FOR ALL USING (
    auth.jwt() ->> 'app_metadata'::text -> 'roles' @> '["system_admin"]'
  );
```

### Context Helper Pattern
```typescript
export async function getRequestContext(request: Request) {
  // 1. Try session first
  const session = await getSession(request)
  if (session?.user?.app_metadata?.tenant_id) {
    return {
      tenantId: session.user.app_metadata.tenant_id,
      roles: session.user.app_metadata.roles || [],
      source: 'session'
    }
  }
  
  // 2. Fallback to header (with warning)
  const headerTenant = request.headers.get('x-tenant-id')
  if (headerTenant) {
    console.warn(`Using header fallback for tenant: ${headerTenant}`)
    return {
      tenantId: headerTenant,
      roles: ['member'], // Conservative default
      source: 'header'
    }
  }
  
  // 3. No context available
  throw new Error('No tenant context available')
}
```

## Migration Timeline
1. **Week 1**: Implement getRequestContext and backfill script
2. **Week 2**: Create tenant tables and services
3. **Week 3**: Build admin UIs
4. **Week 4**: Refactor CRUD pages
5. **Week 5**: Testing and documentation
6. **Week 6**: Remove header fallback

## Risk Mitigation
- **Risk**: Existing users locked out during migration
  - **Mitigation**: Backfill script runs before any code changes
- **Risk**: Performance degradation from context resolution
  - **Mitigation**: Cache session data, measure latency
- **Risk**: Complex RLS policies cause errors
  - **Mitigation**: Start simple, comprehensive test coverage

## References
- [Supabase Auth Metadata Docs](https://supabase.com/docs/guides/auth/managing-user-data)
- [RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Auth Patterns](https://nextjs.org/docs/app/building-your-application/authentication)