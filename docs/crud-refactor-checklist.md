# CRUD Refactoring Checklist - Phase 3.5

## Overview
Tracking the migration from `x-tenant-id` header to `getRequestContext` for proper session-based tenant isolation.

## API Routes Status

### Supervisor Routes
- [x] `/api/supervisor/items/route.ts` - GET, POST
  - Frontend: `demo-items/page.tsx` - Still sends header ❌
- [x] `/api/supervisor/items/[itemId]/route.ts` - GET, PUT, PATCH
  - Frontend: `demo-items/[itemId]/page.tsx` - Still sends header ❌
- [x] `/api/supervisor/items/[itemId]/image/route.ts` - POST
  - Frontend: `demo-items/page.tsx`, `demo-items/[itemId]/page.tsx` - Still sends header ❌
- [ ] `/api/supervisor/jobs/route.ts` - GET, POST
  - Frontend: `demo-jobs/page.tsx` - Still sends header ❌
- [ ] `/api/supervisor/jobs/[jobId]/route.ts` - GET, PATCH, DELETE
  - Frontend: Multiple job-related pages
- [ ] `/api/supervisor/properties/route.ts` - GET, POST
  - Frontend: `demo-properties/page.tsx` - Still sends header ❌
- [ ] `/api/supervisor/properties/[id]/route.ts` - GET, PATCH, DELETE
  - Frontend: Property management pages
- [ ] `/api/supervisor/customers/route.ts` - GET, POST
  - Frontend: Customer management pages
- [ ] `/api/supervisor/customers/[id]/route.ts` - GET, PATCH, DELETE
  - Frontend: Customer detail pages
- [ ] `/api/supervisor/inventory/route.ts` - GET, POST
  - Frontend: Inventory management pages

### Crew Routes
- [ ] `/api/crew/jobs/today/route.ts` - GET
  - Frontend: Crew dashboard pages
- [ ] `/api/crew/jobs/[jobId]/verify-load/route.ts` - POST
  - Frontend: Load verification pages

### Shared Utilities
- [ ] `/api/scheduling-kits/_shared.ts` - Utility functions
  - Used by: Multiple scheduling endpoints

## Frontend Files to Update

### Demo Pages (Currently send x-tenant-id)
- [ ] `/app/demo-items/page.tsx` - Remove header from all fetches
- [ ] `/app/demo-items/[itemId]/page.tsx` - Remove header from all fetches  
- [ ] `/app/demo-jobs/page.tsx` - Remove header from all fetches
- [ ] `/app/demo-jobs/[jobId]/items/page.tsx` - Remove header from all fetches
- [ ] `/app/demo-properties/page.tsx` - Remove header from all fetches

### Hooks to Update
- [ ] `/hooks/useDevTenant.ts` - Remove or deprecate tenantHeaders export

## Migration Steps

1. **For each API route:**
   - [x] Add `import { getRequestContext } from '@/lib/auth/context'`
   - [x] Replace `const tenantId = request.headers.get('x-tenant-id') || '...'`
   - [x] With: `const context = await getRequestContext(request); const { tenantId, user } = context;`
   - [x] Update client selection logic to use `user` instead of `authorization` header
   - [x] Add logging: `console.log('TenantID:', tenantId, 'Source:', context.source)`

2. **For each frontend file:**
   - [ ] Remove `'x-tenant-id': '...'` from fetch headers
   - [ ] Remove `import { useDevTenant }` if only used for headers
   - [ ] Verify authentication cookies are being sent

3. **After all migrations:**
   - [ ] Test all endpoints with session auth (no x-tenant-id)
   - [ ] Monitor logs for "Using header fallback" warnings
   - [ ] Remove header fallback from getRequestContext
   - [ ] Update tests to use session-based auth

## Notes

- `getRequestContext` currently logs warnings when using header fallback
- The fallback allows gradual migration without breaking existing functionality
- Once all routes are migrated, we can remove the fallback entirely
- Some routes may need additional changes for role-based access control

## Progress Summary
- **API Routes**: 5/14 completed (36%)
- **Frontend Files**: 0/5 completed (0%)
- **Header Fallback**: Still active (remove after validation)