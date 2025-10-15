# Implementation Plan: Integrate Job Creation Workflow for Authenticated Supervisors

**Branch**: `007-integrate-job-creation-workflow` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-integrate-job-creation-workflow/spec.md`

## Execution Flow (/plan command scope)
```
1. ✅ Load feature spec from Input path
2. ✅ Fill Technical Context (full integration approach)
3. ✅ Fill Constitution Check section
4. ✅ Evaluate Constitution Check
5. → Execute Phase 0 → research.md
6. → Execute Phase 1 → contracts, data-model.md, quickstart.md
7. → Re-evaluate Constitution Check
8. → Plan Phase 2 → Describe task generation approach
9. STOP - Ready for /tasks command
```

## Summary

Integrate existing demo CRUD forms (customers, properties, items, jobs) into authenticated supervisor dashboard with proper tenant isolation. Enable super@tophand.tech to create the complete job workflow: Customer → Property → Inventory Items → Job → Assign Items to Job. Reuse existing form components, add authentication/authorization, create missing job_items junction table, and implement tenant-filtered API endpoints.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 14 (App Router), React 18
**Primary Dependencies**: Next.js, React, Supabase (@supabase/ssr), Tailwind CSS, Zod (validation)
**Storage**: PostgreSQL via Supabase with Row Level Security (RLS)
**Testing**: Manual testing initially, contract tests for API endpoints
**Target Platform**: Web application (server-side + client-side rendering)
**Project Type**: Web (Next.js App Router - frontend + backend in same codebase)
**Performance Goals**: Page load <2s, form submission <1s, list queries <500ms
**Constraints**: Tenant isolation via RLS, authentication via Supabase JWT, avoid RLS recursion issues
**Scale/Scope**: Single tenant initially (~10-50 customers, ~100 properties, ~50 jobs/month)

**User Context**: Full integration approach - copy demo components to authenticated supervisor routes, add tenant filtering, create missing database table.

## Constitution Check

*No active constitution file found. Proceeding with standard best practices:*

**Applied Principles**:
- ✅ **Reuse over Rewrite**: Copy existing demo components rather than rebuild
- ✅ **Security First**: All pages protected with withAuth, all queries filtered by tenant_id
- ✅ **Test Before Deploy**: Manual testing workflow, contract tests for critical APIs
- ✅ **Incremental Delivery**: Can deploy customer management first, then properties, etc.
- ✅ **Data Integrity**: Foreign keys, RLS policies, validation at API layer

**No Violations**: This feature follows standard patterns already established in the codebase.

## Project Structure

### Documentation (this feature)
```
specs/007-integrate-job-creation-workflow/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command)
```

### Source Code (Next.js App Router structure)
```
src/
├── app/
│   ├── supervisor/
│   │   ├── customers/
│   │   │   ├── page.tsx           # Customer list + CRUD
│   │   │   └── _components/
│   │   │       ├── CustomerForm.tsx
│   │   │       └── CustomerList.tsx
│   │   ├── properties/
│   │   │   ├── page.tsx           # Property list + CRUD
│   │   │   └── _components/
│   │   │       ├── PropertyForm.tsx
│   │   │       └── PropertyList.tsx
│   │   ├── inventory/
│   │   │   ├── page.tsx           # Item/inventory list + CRUD
│   │   │   └── _components/
│   │   │       ├── ItemForm.tsx
│   │   │       └── ItemList.tsx
│   │   └── jobs/
│   │       ├── page.tsx           # Job list + create
│   │       ├── [jobId]/
│   │       │   ├── page.tsx       # Job details
│   │       │   └── items/
│   │       │       └── page.tsx   # Manage job items
│   │       └── _components/
│   │           ├── JobForm.tsx
│   │           └── JobList.tsx
│   └── api/
│       └── supervisor/
│           ├── customers/
│           │   └── route.ts       # GET, POST
│           ├── customers/[id]/
│           │   └── route.ts       # GET, PUT, DELETE
│           ├── properties/
│           │   └── route.ts
│           ├── properties/[id]/
│           │   └── route.ts
│           ├── items/             # Already exists
│           ├── jobs/              # Already exists
│           └── jobs/[jobId]/items/ # Already exists

├── lib/
│   └── supabase/
│       ├── client.ts              # Browser client
│       └── server.ts              # Server client

migrations/
└── 007_create_job_items.sql       # New junction table
```

**Structure Decision**: Using Next.js App Router co-located structure where UI components live in `/app/supervisor/*` and API routes in `/app/api/supervisor/*`. This follows the existing pattern established in the codebase and keeps related code together.

## Phase 0: Outline & Research ✅ COMPLETE

**Research Tasks**:
1. ✅ Audit existing demo components for reusability
2. ✅ Verify database schema for customers, properties, items, jobs tables
3. ✅ Check existing API endpoints (which ones already exist)
4. ✅ Review RLS policies and identify recursion issues
5. ✅ Research best practices for Next.js App Router authentication patterns
6. ✅ Research Supabase RLS policy patterns for tenant isolation
7. ✅ Research form validation patterns with Zod

**Key Findings** (documented in research.md):
- ✅ Demo components are 85-90% reusable with minimal modifications
- ✅ Tables exist: customers, properties, items, jobs (confirmed via check_all_tables.py)
- ✅ Missing table: job_items junction table (needs creation)
- ✅ Existing API endpoints: `/api/supervisor/items/*`, `/api/supervisor/jobs/*` (both working)
- ✅ API pattern: Uses `getRequestContext()` for flexible auth (session or header)
- ✅ Page auth: Uses `withAuth()` wrapper for strict session authentication
- ✅ RLS pattern from Constitution: MUST use `app_metadata` path (not `auth.jwt()`)
- ✅ Component patterns: Controlled forms with parent state management
- ✅ Repository pattern: Well-established for database operations

**Critical RLS Pattern** (from Constitution):
```sql
CREATE POLICY "tenant_isolation" ON table_name
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

**Output**: ✅ research.md created with comprehensive findings (11 sections, 600+ lines)

## Phase 1: Design & Contracts

**Data Model** (to be detailed in data-model.md):
- **customers**: id, tenant_id, name, email, phone, address, created_at, updated_at
- **properties**: id, tenant_id, customer_id (FK), address, notes, created_at, updated_at
- **items**: id, tenant_id, name, category, quantity, description, created_at, updated_at
- **jobs**: id, tenant_id, property_id (FK), scheduled_start, status, title, completion_notes, created_at, updated_at
- **job_items** (NEW): id, tenant_id, job_id (FK), item_id (FK), quantity, notes, created_at, updated_at

**API Contracts** (to be detailed in /contracts/):
1. `GET /api/supervisor/customers` - List all customers for tenant
2. `POST /api/supervisor/customers` - Create new customer
3. `GET /api/supervisor/customers/[id]` - Get customer details
4. `PUT /api/supervisor/customers/[id]` - Update customer
5. `DELETE /api/supervisor/customers/[id]` - Delete customer
6. Same pattern for properties, items (items already exist)
7. Job endpoints already exist, add job_items management

**Contract Tests**:
- Test authentication (401 without valid token)
- Test tenant isolation (can't access other tenant's data)
- Test CRUD operations for each endpoint
- Test foreign key constraints
- Test validation (missing required fields)

**Quick start Scenario**:
1. Sign in as super@tophand.tech
2. Create customer "ACME Corp"
3. Create property "123 Main St" for ACME Corp
4. Add item "Lawn Mower" to inventory
5. Create job for property
6. Assign "Lawn Mower" to job
7. Verify job shows assigned item

**Output**: data-model.md, /contracts/*.json, failing contract tests, quickstart.md

## Phase 2: Task Planning Approach

**Task Generation Strategy**:
1. **Database Setup** [P]
   - Create job_items table migration
   - Add RLS policies for job_items
   - Verify RLS policies on existing tables

2. **Customer Management** (Sequential)
   - Copy CustomerForm/CustomerList from demo-crud
   - Create /supervisor/customers/page.tsx
   - Create API route /api/supervisor/customers
   - Add tenant filtering
   - Test CRUD operations

3. **Property Management** (Sequential after customers)
   - Copy PropertyForm/PropertyList from demo-properties
   - Create /supervisor/properties/page.tsx
   - Create API route /api/supervisor/properties
   - Add customer dropdown (fetch from customers API)
   - Test CRUD operations

4. **Inventory Management** (Parallel with properties)
   - Copy ItemForm/ItemList from demo-items
   - Create /supervisor/inventory/page.tsx
   - Verify existing API routes work with auth
   - Test CRUD operations

5. **Job Management** (Sequential after properties + inventory)
   - Copy JobForm/JobList from demo-jobs
   - Create /supervisor/jobs/page.tsx
   - Verify existing API routes
   - Add property dropdown
   - Test job creation

6. **Job-Items Linking** (Sequential after jobs)
   - Create job items management UI
   - Test adding/removing items from job
   - Test quantity tracking

7. **Navigation Integration** (Parallel)
   - Add links to supervisor dashboard
   - Add breadcrumb navigation
   - Test navigation flow

**Ordering Strategy**:
- Database first (required for everything)
- Customers before Properties (FK dependency)
- Properties before Jobs (FK dependency)
- Inventory parallel with Properties (independent)
- Job-items last (requires jobs + items to exist)

**Estimated Output**: ~30-35 numbered, dependency-ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md)
**Phase 5**: Validation (run quickstart.md, verify all CRUD operations)

## Complexity Tracking

*No constitution violations - proceeding with standard patterns*

| Deviation | Why Needed | Alternative Considered |
|-----------|------------|----------------------|
| None | N/A | N/A |

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research started (/plan command)
- [x] Phase 0: Research complete ✅
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning approach described (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (no active constitution, using best practices)
- [x] All research complete ✅
- [ ] Post-Design Constitution Check: PASS
- [ ] All contract tests written
- [ ] Complexity deviations documented (N/A - no deviations)

---
*Plan generated on 2025-10-14 for full integration approach*
