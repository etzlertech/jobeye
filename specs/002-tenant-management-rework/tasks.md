# Tenant Management Rework - Task Tracking

## Overview
Machine-trackable task list for tenant management system implementation.

## Current Status: Phase 3 - UI Integration

### Immediate Tasks (High Priority)

- [ ] Add TenantBadge to all demo page layouts
  - [ ] /demo-items layout
  - [ ] /demo-jobs layout
  - [ ] /demo-properties layout
  - [ ] /demo-crud layout
  - [ ] Other demo pages

- [ ] Refactor CRUD pages to use getRequestContext
  - [ ] /demo-items pages
  - [ ] /demo-jobs pages
  - [ ] /demo-properties pages
  - [ ] /supervisor pages
  - [ ] /crew pages

- [ ] Fix TypeScript pre-commit errors
  - [ ] Run tsc --noEmit to identify all errors
  - [ ] Fix type errors in tenant components
  - [ ] Fix type errors in API routes
  - [ ] Remove --no-verify workaround

### Performance Optimizations (Medium Priority)

- [ ] Improve listUsers performance
  - [ ] Replace listUsers with getUserById batch calls
  - [ ] Implement pagination for large user sets
  - [ ] Add caching layer for user lookups
  - [ ] Document scalability limits

### UI Development (Medium Priority)

- [ ] Build system admin console
  - [ ] Create /admin/tenants page
  - [ ] List all tenants with stats
  - [ ] Tenant creation form
  - [ ] Tenant management actions

- [ ] Build tenant admin screens
  - [ ] Member management UI
  - [ ] Invitation management UI
  - [ ] Tenant settings page
  - [ ] Role assignment interface

### Testing & Migration (Lower Priority)

- [ ] Update demo pages for session context
  - [ ] Remove header dependencies
  - [ ] Add session checks
  - [ ] Update navigation flows

- [ ] Run metadata backfill
  - [ ] Test script in dev
  - [ ] Create backup
  - [ ] Execute migration
  - [ ] Verify results

- [ ] Create seed data
  - [ ] Sample tenants
  - [ ] Test users with roles
  - [ ] Demo invitations

- [ ] Write integration tests
  - [ ] Auth flow tests
  - [ ] Permission boundary tests
  - [ ] Invitation flow tests

### Cleanup (Lowest Priority)

- [ ] Remove header fallback
  - [ ] Add feature flag
  - [ ] Test without headers
  - [ ] Remove fallback code
  - [ ] Update documentation

## Notes

- All high priority tasks must be completed before considering the tenant system production-ready
- Performance optimizations should be addressed before scaling beyond dev/test environments
- UI development can proceed in parallel with other work
- Testing and migration tasks are prerequisites for production deployment