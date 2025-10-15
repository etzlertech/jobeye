# Feature Specification: Integrate Job Creation Workflow for Authenticated Supervisors

## Overview

Enable authenticated supervisor users to create and manage the complete job workflow including customers, properties, inventory items, and jobs with item assignments. This integrates existing demo CRUD forms into the authenticated supervisor dashboard with proper tenant isolation and access control.

## User Stories

### Primary User Story
**As a** supervisor user (super@tophand.tech)
**I want to** create customers, properties, inventory items, and jobs with item assignments
**So that** I can manage the complete job lifecycle from a single authenticated interface

### Supporting User Stories

1. **Customer Management**
   - As a supervisor, I want to add new customers to my tenant
   - As a supervisor, I want to view and edit existing customers
   - As a supervisor, I want to delete customers that are no longer active

2. **Property Management**
   - As a supervisor, I want to add properties linked to customers
   - As a supervisor, I want to view all properties in my tenant
   - As a supervisor, I want to edit property details

3. **Inventory Management**
   - As a supervisor, I want to add items to the inventory
   - As a supervisor, I want to view current inventory levels
   - As a supervisor, I want to track which items are assigned to jobs

4. **Job Management**
   - As a supervisor, I want to create jobs for specific properties
   - As a supervisor, I want to assign inventory items to jobs
   - As a supervisor, I want to view all jobs for my tenant
   - As a supervisor, I want to track job status and completion

## Functional Requirements

### FR1: Customer Management
- Authenticated supervisors can create, read, update, and delete customers
- All customers are tenant-isolated
- Customer form includes: name, email, phone, address
- Customers can be linked to multiple properties

### FR2: Property Management
- Authenticated supervisors can create, read, update, and delete properties
- Properties must be linked to a customer
- Property form includes: address, customer selection, notes
- Properties can have multiple jobs

### FR3: Inventory/Items Management
- Authenticated supervisors can create, read, update, and delete items
- Items are tenant-isolated
- Item form includes: name, category, quantity, description
- Items can be assigned to multiple jobs

### FR4: Job Management
- Authenticated supervisors can create, read, update, and delete jobs
- Jobs must be linked to a property (and indirectly to a customer)
- Job form includes: property selection, scheduled date/time, status, instructions
- Jobs can have multiple items assigned

### FR5: Job-Items Linking
- Supervisors can add items to a job with quantity
- Supervisors can remove items from a job
- System tracks which items are assigned to which jobs
- Display total items on a job

### FR6: Navigation Integration
- Add "Customers", "Properties", "Inventory", "Jobs" links to supervisor dashboard
- Each page is only accessible to authenticated supervisor/admin users
- Breadcrumb navigation shows current location

## Non-Functional Requirements

### NFR1: Security
- All pages require authentication via withAuth wrapper
- All data is filtered by tenant_id
- Only supervisor and admin roles can access these pages
- Row Level Security (RLS) policies enforce tenant isolation at database level

### NFR2: Performance
- List pages load within 2 seconds
- Forms submit within 1 second
- Use optimistic UI updates where possible

### NFR3: Usability
- Reuse existing demo form components for consistency
- Forms validate inputs before submission
- Clear error messages for validation failures
- Success notifications after CRUD operations

### NFR4: Data Integrity
- Prevent deletion of customers with active properties
- Prevent deletion of properties with active jobs
- Track tenant_id on all records
- Use foreign keys to maintain referential integrity

## Technical Constraints

### Existing Components
- Demo forms already exist at `/demo-crud`, `/demo-properties`, `/demo-items`, `/demo-jobs`
- These forms work but lack authentication and tenant isolation
- Components should be reused rather than rewritten

### Database Schema
- Tables exist: customers, properties, items, jobs, tenants, tenant_members
- Missing table: job_items (for linking items to jobs)
- RLS policies may need updates for proper tenant isolation

### Authentication
- Using Supabase auth with JWT tokens
- Tenant ID stored in user.app_metadata.tenant_id
- Auth wrapper: withAuth() for API routes

## Success Criteria

1. ✅ job_items table created with proper RLS policies
2. ✅ Supervisor can navigate to Customers, Properties, Inventory, Jobs pages from dashboard
3. ✅ All forms work with authenticated user context
4. ✅ Data is properly filtered by tenant_id
5. ✅ Can create a complete workflow: Customer → Property → Job → Add Items to Job
6. ✅ All CRUD operations work (Create, Read, Update, Delete)
7. ✅ Demo pages remain functional for testing without auth

## Acceptance Criteria

### AC1: Database Setup
- job_items table exists with columns: id, tenant_id, job_id, item_id, quantity, notes
- RLS policies allow supervisors to manage job_items in their tenant
- Foreign keys properly link job_items to jobs and items tables

### AC2: Page Structure
- `/supervisor/customers` page exists and loads
- `/supervisor/properties` page exists and loads
- `/supervisor/inventory` page exists and loads (maps to items)
- `/supervisor/jobs` page exists and loads
- All pages require authentication and show 401 if not logged in

### AC3: Customer Management
- Can add a new customer with name, email, phone
- Customer list shows all customers for the tenant
- Can edit existing customer details
- Can delete customers (with warning if they have properties)

### AC4: Property Management
- Can add a new property linked to a customer
- Property list shows all properties with customer names
- Can edit property details
- Can delete properties (with warning if they have jobs)

### AC5: Inventory Management
- Can add new items to inventory
- Item list shows all items for the tenant
- Can edit item details and quantities
- Can view which jobs use each item

### AC6: Job Management
- Can create a job for a specific property
- Job form pre-populates with customer based on property selection
- Can assign items to a job with quantities
- Job list shows all jobs with status
- Can view job details including all assigned items

### AC7: Navigation
- Supervisor dashboard has links to all management pages
- Breadcrumb shows current location
- Can navigate between pages without losing context

## Out of Scope

- Mobile app integration
- Voice command creation of jobs
- Advanced scheduling features
- Equipment tracking beyond basic items
- Crew assignment to jobs (separate feature)
- Real-time notifications

## Dependencies

- Completed authentication system (✅ Done)
- Supabase database with existing tables (✅ customers, properties, items, jobs exist)
- Demo form components (✅ Available to reuse)
- Supervisor dashboard layout (✅ Exists)

## Risks and Mitigations

### Risk 1: RLS Policy Recursion
**Risk**: users_extended view has infinite recursion in RLS policy
**Impact**: API calls fail with 500 errors
**Mitigation**: Use service role key for server-side operations or fix RLS policy

### Risk 2: Data Migration
**Risk**: Existing demo data may not have tenant_id set correctly
**Impact**: Data not visible to authenticated users
**Mitigation**: Run data migration script to assign tenant_id to existing records

### Risk 3: Component Incompatibility
**Risk**: Demo components may not work with authenticated context
**Impact**: Need to rewrite forms from scratch
**Mitigation**: Audit demo components first, make minimal changes to add auth

## Clarifications

### Session 1: Initial Planning (2025-10-14)

**Q1: Should we preserve the demo pages or replace them?**
**A**: Keep demo pages as-is for testing. Create new authenticated pages in `/supervisor/*`

**Q2: What happens to existing demo data?**
**A**: Leave existing demo data in place. New authenticated data will have proper tenant_id.

**Q3: Should items be called "items" or "inventory"?**
**A**: Database uses "items" table, but UI should say "Inventory" for clarity.

**Q4: How should job-item quantities be tracked?**
**A**: Create job_items junction table with quantity column.

**Q5: What validation is needed for job creation?**
**A**: Require property, scheduled_start datetime. Optional: title, status (defaults to 'scheduled').

## Implementation Notes

### Reuse Strategy
- Copy demo form components to `/supervisor/*` routes
- Add `withAuth` wrapper to API endpoints
- Add tenant_id filtering to all database queries
- Minimal changes to form logic

### Database Changes
- Create job_items table
- Add RLS policies for job_items
- Verify RLS policies on customers, properties, items, jobs tables

### API Endpoints
- Reuse or create: `/api/supervisor/customers`, `/api/supervisor/properties`
- Already exist: `/api/supervisor/items`, `/api/supervisor/jobs`
- Create: `/api/supervisor/jobs/[id]/items` for managing job-item links

### Testing Strategy
- Manual testing: Complete workflow from customer to job with items
- Verify tenant isolation: Sign in as different tenant, confirm data separation
- Test error cases: Missing fields, invalid IDs, unauthorized access

## Timeline Estimate

- **Phase 1**: Database setup (job_items table) - 30 minutes
- **Phase 2**: Copy and adapt customer/property pages - 2 hours
- **Phase 3**: Adapt inventory/jobs pages - 1 hour
- **Phase 4**: Create API endpoints - 2 hours
- **Phase 5**: Testing and bug fixes - 1 hour

**Total**: ~6-7 hours of development work
