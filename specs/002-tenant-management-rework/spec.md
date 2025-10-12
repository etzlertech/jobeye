# Feature Specification: Tenant Management Rework

## Feature Overview
Complete rework of tenant management system to move from header-based tenant identification to session-based authentication with proper role-based access control.

## Current State
- Main branch is clean
- Dev CRUD flows (inventory, jobs, item profile) use useDevTenant hook + x-tenant-id header
- No tenant tables/services beyond legacy scripts
- Session metadata lacks tenant/role enforcement

## User Stories
1. As a system admin, I want to manage all tenants and assign tenant admins
2. As a tenant admin, I want to approve member requests and manage roles within my tenant
3. As a user, I want to request access to a tenant and see my pending status
4. As an authenticated user, I want my tenant context automatically resolved from my session

## Functional Requirements

### Phase 1: Session Context & Metadata
- JWT app_metadata must carry tenant_id and roles
- Server-side getRequestContext helper that resolves tenant/role from session
- Fallback to header with warning log for backwards compatibility
- Metadata backfill script for existing demo/system users

### Phase 2: Tenant Domain Foundation
- Database tables: tenants, tenant_members (status/role), tenant_invitations
- Row Level Security (RLS) per constitution
- Repositories and services for tenant management
- API routes for:
  - System admin: list/create tenants, assign tenant admins, reassign members
  - Tenant admin: view/approve pending invites, manage member roles
  - Users: request to join tenant, view pending status

### Phase 3: UI Integration
- System admin console (tenant list, member reassignment)
- Tenant admin screens (pending approvals, role management)
- Refactor CRUD pages to use getRequestContext
- Display tenant/user info prominently (badge/banner)
- Block actions until user is approved
- Update demo pages to detect session context first

### Phase 4: Testing & Cutover
- Seed flows for tenant creation, invitation, approval, CRUD
- Integration tests for role-based access
- Remove/feature-flag header fallback after session paths pass
- Update documentation (AGENTS.md, CLAUDE.md, MEMORY.md)

## Non-Functional Requirements
- Maintain backwards compatibility during transition
- Low-risk rollout with feature flags
- Clear logging for fallback usage
- Performance: Context resolution should not add significant latency

## Success Criteria
- All CRUD operations work with session-based tenant context
- Role-based access properly enforced
- Existing dev flows continue working during transition
- Complete documentation of new tenant system

## Technical Constraints
- Must work with existing Supabase auth
- Cannot break existing demo flows during transition
- Must follow constitution RLS patterns

## Clarifications

### Session 1: Initial Requirements
Q: Should we maintain header fallback permanently or phase it out?
A: Phase it out after confirming session paths work, using feature flags for gradual rollout.

Q: What are the specific roles and their permissions?
A: Three roles - system_admin (manage all tenants), tenant_admin (manage own tenant members), member (regular tenant access).

Q: How should pending users be handled in the UI?
A: Show clear pending status, block all actions except viewing their request status.

Q: Should the metadata backfill be automatic or manual?
A: Manual script that can be run once, with clear documentation on when/how to run it.

## Dependencies
- Existing Supabase authentication
- Current useDevTenant hook (for fallback)
- Constitution RLS patterns