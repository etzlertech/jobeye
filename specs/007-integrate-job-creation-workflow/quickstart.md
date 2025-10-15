# Quick Start Test Scenario: Complete Job Creation Workflow

**Feature**: 007-integrate-job-creation-workflow
**Date**: 2025-10-14
**Tester**: super@tophand.tech (Top Hand Lawn Care tenant)

## Purpose

This document provides a step-by-step manual test scenario to verify the complete job creation workflow: Customer → Property → Inventory Items → Job → Assign Items to Job. Follow this script after implementation to confirm all components work together.

## Prerequisites

- ✅ Database tables exist: customers, properties, items, jobs, job_checklist_items
- ✅ RLS policies configured for tenant isolation
- ✅ Authentication system working (Supabase JWT)
- ✅ API endpoints deployed:
  - `/api/supervisor/customers` (GET, POST, PUT, DELETE)
  - `/api/supervisor/properties` (GET, POST, PUT, DELETE)
  - `/api/supervisor/items` (GET, POST, PUT, DELETE) - already exists
  - `/api/supervisor/jobs` (GET, POST, PUT, DELETE) - already exists
  - `/api/supervisor/jobs/[jobId]/items` (GET, POST, PUT, DELETE) - needs creation
- ✅ UI pages available:
  - `/supervisor/customers`
  - `/supervisor/properties`
  - `/supervisor/inventory`
  - `/supervisor/jobs`
  - `/supervisor/jobs/[jobId]` (job detail with item management)

## Test Environment

- **URL**: https://jobeye.up.railway.app (production) or http://localhost:3000 (dev)
- **Test Account**: super@tophand.tech
- **Test Tenant**: Top Hand Lawn Care (tenant_id from app_metadata)

## Test Scenario: Create Complete Job Workflow

### Step 1: Sign In
**Location**: Homepage → Sign In

1. Navigate to sign-in page
2. Enter credentials:
   - Email: `super@tophand.tech`
   - Password: `[password from .env.local]`
3. Click "Sign In"

**Expected Result**:
- ✅ Redirected to `/supervisor/dashboard`
- ✅ Navigation menu shows: Dashboard, Customers, Properties, Inventory, Jobs
- ✅ No "401 No tenant context" errors in browser console

**Verification**:
- Open browser DevTools → Console
- Look for auth token in cookies/localStorage
- Confirm tenant_id is present in JWT (decode at jwt.io)

---

### Step 2: Create Customer
**Location**: `/supervisor/customers`

1. Click "Customers" in navigation menu
2. Click "Add Customer" button (or equivalent)
3. Fill in customer form:
   - Name: `ACME Landscaping Corp`
   - Email: `contact@acme-landscaping.example`
   - Phone: `555-0100`
   - Mobile Phone: `555-0101`
   - **Billing Address**:
     - Street: `123 Main Street`
     - City: `Springfield`
     - State: `IL`
     - ZIP: `62701`
   - **Service Address** (leave blank to test optional fields)
4. Click "Save" or "Create Customer"

**Expected Result**:
- ✅ Success message: "Customer created successfully"
- ✅ Customer appears in list with auto-generated customer_number (e.g., `CUST-1729000000000`)
- ✅ Billing address displays formatted correctly
- ✅ Service address shows as "N/A" or blank

**API Verification**:
```bash
# In DevTools Network tab, verify:
# POST /api/supervisor/customers
# Status: 201 Created
# Response body includes: { id, customer_number, message }
```

**Database Verification** (optional, via Supabase MCP):
```python
# Query to verify customer was created with correct tenant_id
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/customers",
    headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
    params={"name": "eq.ACME Landscaping Corp"}
)
# Should return 1 record with tenant_id matching super@tophand.tech
```

---

### Step 3: Create Property for Customer
**Location**: `/supervisor/properties`

1. Click "Properties" in navigation menu
2. Click "Add Property" button
3. Fill in property form:
   - **Customer**: Select `ACME Landscaping Corp` from dropdown
   - **Address**:
     - Line 1: `456 Oak Avenue`
     - Line 2: `Unit B` (optional)
     - City: `Springfield`
     - State: `IL`
     - ZIP: `62702`
   - Notes: `Large backyard, weekly mowing required`
   - Lot Size: `0.5 acres`
   - Gate Code: `1234`
4. Click "Save" or "Create Property"

**Expected Result**:
- ✅ Success message: "Property created successfully"
- ✅ Property appears in list with auto-generated property_number (e.g., `PROP-1729000000000`)
- ✅ Property list shows customer name: "ACME Landscaping Corp"
- ✅ Address displays formatted correctly
- ✅ Notes and lot size visible

**API Verification**:
```bash
# POST /api/supervisor/properties
# Status: 201 Created
# Response body includes: { id, property_number, message }

# GET /api/supervisor/properties should return array with customer join:
# { id, property_number, address: { line1, city, ... }, customer: { name, email } }
```

**Adapter Verification**:
- Form inputs (separate fields) → JSONB address object in database
- Reuses pattern from `demo-properties/utils.ts` buildPropertyPayload()

---

### Step 4: Add Items to Inventory
**Location**: `/supervisor/inventory`

1. Click "Inventory" in navigation menu
2. Click "Add Item" button
3. Create **Item 1**:
   - Name: `Lawn Mower (Commercial)`
   - Category: `Equipment`
   - Quantity: `2`
   - Description: `Honda HRX217, self-propelled`
4. Click "Save"
5. Click "Add Item" again
6. Create **Item 2**:
   - Name: `String Trimmer`
   - Category: `Equipment`
   - Quantity: `3`
   - Description: `Echo SRM-225, gas-powered`
7. Click "Save"
8. Create **Item 3**:
   - Name: `Safety Goggles`
   - Category: `Safety Gear`
   - Quantity: `10`
   - Description: `ANSI Z87.1 rated`
9. Click "Save"

**Expected Result**:
- ✅ All 3 items appear in inventory list
- ✅ Each item has auto-generated item_number
- ✅ Quantities display correctly
- ✅ Categories group items (if UI supports grouping)

**API Verification**:
```bash
# POST /api/supervisor/items (x3)
# Status: 201 Created (each)

# GET /api/supervisor/items
# Returns array of 3 items for authenticated tenant only
```

**Tenant Isolation Test**:
- If possible, sign in as different tenant in incognito window
- Verify they do NOT see "Lawn Mower (Commercial)" in their inventory

---

### Step 5: Create Job for Property
**Location**: `/supervisor/jobs`

1. Click "Jobs" in navigation menu
2. Click "Create Job" button
3. Fill in job form:
   - **Property**: Select `456 Oak Avenue, Springfield, IL 62702` from dropdown
   - **Customer** (should auto-populate): `ACME Landscaping Corp` (read-only)
   - **Scheduled Date**: `2025-10-15`
   - **Scheduled Time**: `09:00 AM`
     - *(Note: Backend uses single `scheduled_start` TIMESTAMPTZ field. Form adapter should combine date + time into ISO 8601 timestamp: `2025-10-15T09:00:00-05:00`)*
   - **Title**: `Weekly lawn mowing and trimming`
   - **Status**: `scheduled` (default, may be pre-selected)
4. Click "Save" or "Create Job"

**Expected Result**:
- ✅ Success message: "Job created successfully"
- ✅ Job appears in list with auto-generated job_number (e.g., `JOB-1729000000000` or similar)
- ✅ Job list shows property address and customer name
- ✅ Scheduled date/time displays correctly
- ✅ Status shows as "Scheduled"

**API Verification**:
```bash
# POST /api/supervisor/jobs
# Request body: {
#   "property_id": "prop-uuid",
#   "scheduled_start": "2025-10-15T09:00:00-05:00",  # Combined timestamp
#   "title": "Weekly lawn mowing and trimming",
#   "status": "scheduled"
# }
# Status: 201 Created
# Response: { id, job_number, message }

# GET /api/supervisor/jobs
# Returns array with nested property and customer objects
```

**Form Adapter Check** (if form has separate date/time inputs):
- Separate date + time inputs in form → Combined into single `scheduled_start` timestamp
- Backend expects: `2025-10-15T09:00:00Z` or `2025-10-15T09:00:00-05:00`

---

### Step 6: Assign Items to Job
**Location**: `/supervisor/jobs/[jobId]` (Job Detail Page)

1. From jobs list, click on job: "Weekly lawn mowing and trimming"
2. Navigate to "Items" or "Checklist Items" section
3. Click "Add Item to Job" button
4. **Add Item 1**:
   - Select item: `Lawn Mower (Commercial)`
   - Quantity: `1`
   - Notes: `Check fuel level before starting`
5. Click "Save"
6. Click "Add Item to Job" again
7. **Add Item 2**:
   - Select item: `String Trimmer`
   - Quantity: `1`
   - Notes: `Fresh line installed`
8. Click "Save"
9. **Add Item 3**:
   - Select item: `Safety Goggles`
   - Quantity: `2`
   - Notes: `One for each crew member`
10. Click "Save"

**Expected Result**:
- ✅ Job detail page shows 3 items in checklist
- ✅ Each item displays: name, quantity, notes
- ✅ Item names are denormalized (stored in job_checklist_items table)
- ✅ Total items count: 3

**API Verification**:
```bash
# POST /api/supervisor/jobs/[jobId]/items (x3)
# Request body: {
#   "item_id": "item-uuid",
#   "quantity": 1,
#   "notes": "Check fuel level before starting"
# }
# Status: 201 Created (each)

# GET /api/supervisor/jobs/[jobId]/items
# Returns array of 3 checklist items:
# [
#   { id, job_id, item_id, item_name: "Lawn Mower (Commercial)", quantity: 1, notes: "..." },
#   { id, job_id, item_id, item_name: "String Trimmer", quantity: 1, notes: "..." },
#   { id, job_id, item_id, item_name: "Safety Goggles", quantity: 2, notes: "..." }
# ]
```

**Denormalization Verification**:
- Check that `item_name` is stored in `job_checklist_items` table (not just item_id)
- This supports offline access (voice-first architecture)
- Query: `SELECT item_id, item_name FROM job_checklist_items WHERE job_id = [jobId]`

---

### Step 7: View Complete Job Details
**Location**: `/supervisor/jobs/[jobId]`

1. On job detail page, verify all information is displayed:
   - Job number (e.g., `JOB-1729000000000`)
   - Property address: `456 Oak Avenue, Springfield, IL 62702`
   - Customer name: `ACME Landscaping Corp`
   - Scheduled date/time: `October 15, 2025 at 9:00 AM`
   - Status: `Scheduled`
   - Title: `Weekly lawn mowing and trimming`
   - **Items/Checklist**:
     - Lawn Mower (Commercial) × 1
     - String Trimmer × 1
     - Safety Goggles × 2

**Expected Result**:
- ✅ All job details display correctly
- ✅ Property and customer info are nested/joined (not just IDs)
- ✅ Items list shows denormalized names (not just item_ids)
- ✅ No broken links or missing data

**Full Workflow Verification**:
- Customer → Property → Job linkage is correct
- Items from inventory are assigned to job
- All tenant_id values match authenticated user's tenant

---

### Step 8: Edit and Update (Optional Tests)

#### 8a. Update Customer
1. Navigate to `/supervisor/customers`
2. Click "Edit" on "ACME Landscaping Corp"
3. Change phone to `555-0199`
4. Click "Save"

**Expected**:
- ✅ Success message
- ✅ Updated phone displays in list

#### 8b. Update Property
1. Navigate to `/supervisor/properties`
2. Click "Edit" on property at `456 Oak Avenue`
3. Change lot size to `0.75 acres`
4. Click "Save"

**Expected**:
- ✅ Success message
- ✅ Updated lot size displays

#### 8c. Update Job Status
1. Navigate to `/supervisor/jobs`
2. Click on job "Weekly lawn mowing and trimming"
3. Change status from "Scheduled" to "In Progress"
4. Click "Save"

**Expected**:
- ✅ Success message
- ✅ Status updates in job list

#### 8d. Remove Item from Job
1. On job detail page, find "String Trimmer" in items list
2. Click "Remove" or "Delete" button
3. Confirm deletion

**Expected**:
- ✅ Success message: "Item removed from job"
- ✅ String Trimmer no longer appears in job checklist
- ✅ Navigate to `/supervisor/inventory` → String Trimmer still exists (not deleted from inventory)

**API Verification**:
```bash
# DELETE /api/supervisor/jobs/[jobId]/items/[checklistItemId]
# Status: 200 OK

# GET /api/supervisor/items/[stringTrimmerId]
# Status: 200 OK (item still exists, only removed from job)
```

---

### Step 9: Deletion Tests (Cascade Behavior)

#### 9a. Try to Delete Customer with Property
1. Navigate to `/supervisor/customers`
2. Try to delete "ACME Landscaping Corp"

**Expected**:
- ❌ Error or warning: "Cannot delete customer with active properties"
- ✅ Foreign key constraint prevents deletion
- ✅ Status: 409 Conflict

#### 9b. Try to Delete Property with Job
1. Navigate to `/supervisor/properties`
2. Try to delete property at `456 Oak Avenue`

**Expected**:
- ❌ Error or warning: "Cannot delete property with active jobs"
- ✅ Foreign key constraint prevents deletion
- ✅ Status: 409 Conflict

#### 9c. Delete Job (Cascades to Checklist Items)
1. Navigate to `/supervisor/jobs`
2. Delete job "Weekly lawn mowing and trimming"
3. Confirm deletion

**Expected**:
- ✅ Success message: "Job deleted successfully"
- ✅ Job no longer appears in list
- ✅ Checklist items for job are also deleted (cascade)
- ✅ Navigate to `/supervisor/inventory` → Items still exist (not deleted)

**Database Verification**:
```python
# Query job_checklist_items for deleted job_id
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/job_checklist_items",
    headers=headers,
    params={"job_id": "eq.[deleted-job-id]"}
)
# Should return empty array (cascaded delete)

# Query items table
response = requests.get(f"{SUPABASE_URL}/rest/v1/items")
# Should still return Lawn Mower, Safety Goggles (not deleted)
```

#### 9d. Now Delete Property (No Jobs)
1. Navigate to `/supervisor/properties`
2. Delete property at `456 Oak Avenue`

**Expected**:
- ✅ Success message: "Property deleted successfully" (no jobs block deletion now)
- ✅ Property no longer appears in list

#### 9e. Now Delete Customer (No Properties)
1. Navigate to `/supervisor/customers`
2. Delete "ACME Landscaping Corp"

**Expected**:
- ✅ Success message: "Customer deleted successfully"
- ✅ Customer no longer appears in list

---

### Step 10: Tenant Isolation Verification

**Setup**:
- Sign out from super@tophand.tech
- Sign in as different tenant user (e.g., `demo@example.com` from different tenant)

**Tests**:
1. Navigate to `/supervisor/customers`
   - ✅ Should NOT see "ACME Landscaping Corp"
2. Navigate to `/supervisor/properties`
   - ✅ Should NOT see property at "456 Oak Avenue"
3. Navigate to `/supervisor/inventory`
   - ✅ Should NOT see "Lawn Mower (Commercial)" or other items
4. Navigate to `/supervisor/jobs`
   - ✅ Should NOT see "Weekly lawn mowing and trimming" job
5. Try to access job detail page via direct URL: `/supervisor/jobs/[jobId]`
   - ✅ Should return 404 or "Job not found" (RLS filters it)

**Expected Result**:
- ✅ All data is isolated by tenant_id
- ✅ No cross-tenant data leakage
- ✅ RLS policies enforced at database level

---

## Success Criteria Checklist

After completing this test scenario, verify the following:

### Database
- [x] `job_checklist_items` table exists (NOT job_items)
- [x] All tables have RLS policies enforcing tenant isolation
- [x] Foreign keys maintain referential integrity:
  - properties.customer_id → customers.id
  - jobs.property_id → properties.id
  - job_checklist_items.job_id → jobs.id
  - job_checklist_items.item_id → items.id

### API Endpoints
- [x] `/api/supervisor/customers` - All CRUD operations work
- [x] `/api/supervisor/properties` - All CRUD operations work
- [x] `/api/supervisor/items` - Existing API verified working
- [x] `/api/supervisor/jobs` - Existing API verified working
- [x] `/api/supervisor/jobs/[jobId]/items` - All operations work (GET, POST, PUT, DELETE)

### UI Pages
- [x] `/supervisor/customers` - List, create, edit, delete customers
- [x] `/supervisor/properties` - List, create, edit, delete properties
- [x] `/supervisor/inventory` - List, create, edit, delete items
- [x] `/supervisor/jobs` - List, create, edit, delete jobs
- [x] `/supervisor/jobs/[jobId]` - View job details, manage checklist items

### Form Adapters
- [x] Customer form: Separate address fields → JSONB billing_address/service_address
- [x] Property form: Separate address fields → JSONB address (reuses demo-properties/utils.ts)
- [x] Job form: Separate date + time inputs → Combined scheduled_start TIMESTAMPTZ

### Data Integrity
- [x] Cannot delete customer with active properties (409 Conflict)
- [x] Cannot delete property with active jobs (409 Conflict)
- [x] Deleting job cascades to job_checklist_items
- [x] Deleting job does NOT delete items from inventory
- [x] Tenant isolation enforced (RLS + query filtering)

### Navigation
- [x] Supervisor dashboard has links to all pages
- [x] All pages require authentication (withAuth wrapper)
- [x] 401 errors if not logged in
- [x] Breadcrumb navigation works (if implemented)

---

## Performance Benchmarks (Optional)

Use browser DevTools Network tab to measure:

- **Page Load Times**:
  - `/supervisor/customers`: < 2 seconds
  - `/supervisor/properties`: < 2 seconds
  - `/supervisor/inventory`: < 2 seconds
  - `/supervisor/jobs`: < 2 seconds

- **API Response Times**:
  - GET /api/supervisor/customers: < 500ms
  - POST /api/supervisor/customers: < 1 second
  - GET /api/supervisor/jobs/[jobId]/items: < 500ms

---

## Troubleshooting Common Issues

### Issue: "No tenant context" Error
**Symptoms**: 401 errors after sign-in, "No tenant context available" in logs

**Diagnosis**:
- Check JWT token in browser DevTools → Application → Cookies
- Decode JWT at jwt.io → Verify `app_metadata.tenant_id` exists
- Check Supabase dashboard → Authentication → Users → User's metadata

**Fix**:
- Run backfill script: `npm run scripts:backfill-metadata`
- Or manually update user metadata in Supabase dashboard

---

### Issue: RLS Policy Errors (500 errors)
**Symptoms**: Database queries fail with "infinite recursion" or policy violations

**Diagnosis**:
- Check Supabase logs for RLS errors
- Verify RLS policies use correct pattern:
  ```sql
  tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  ```
- NOT: `auth.jwt() ->> 'tenant_id'` (causes recursion)

**Fix**:
- Update RLS policies to use `app_metadata` path (per Constitution)
- Restart Supabase to clear policy cache

---

### Issue: Address Fields Not Saving
**Symptoms**: Address shows as NULL or "N/A" after creation

**Diagnosis**:
- Check Network tab → Request payload
- Verify form sends JSONB object: `{ address: { line1, city, state, postal_code } }`
- NOT separate fields: `{ addressLine1, city, state, postalCode }`

**Fix**:
- Implement form adapter (see demo-properties/utils.ts buildPropertyPayload)
- Transform form data before API submission

---

### Issue: Items Not Appearing in Job Checklist
**Symptoms**: POST /jobs/[jobId]/items returns 201, but GET returns empty array

**Diagnosis**:
- Check if endpoint uses `items.assigned_to_job_id` (WRONG - unused field)
- Should use `job_checklist_items` table (CORRECT)

**Fix**:
- Update API to query job_checklist_items table
- Verify item_name is denormalized (copied from items.name)

---

### Issue: Tenant Isolation Not Working
**Symptoms**: Users see other tenant's data

**Diagnosis**:
- Check RLS policies are enabled on all tables
- Verify API routes use `getRequestContext()` to get tenant_id
- Test: Sign in as two different tenants in separate browsers

**Fix**:
- Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Add tenant_isolation policy to all tables
- Update API queries to filter by tenant_id

---

## Appendix: Test Data Summary

| Entity Type | Name/Title | Key Fields |
|-------------|-----------|-----------|
| Customer | ACME Landscaping Corp | email: contact@acme-landscaping.example, phone: 555-0100 |
| Property | 456 Oak Avenue | customer: ACME, address: Springfield, IL 62702, lot: 0.5 acres |
| Item 1 | Lawn Mower (Commercial) | category: Equipment, quantity: 2 |
| Item 2 | String Trimmer | category: Equipment, quantity: 3 |
| Item 3 | Safety Goggles | category: Safety Gear, quantity: 10 |
| Job | Weekly lawn mowing and trimming | property: 456 Oak Ave, scheduled: 2025-10-15 09:00 AM |
| Job Items | - | Lawn Mower × 1, String Trimmer × 1, Safety Goggles × 2 |

---

## Sign-Off

After completing this test scenario, sign off here:

- [ ] All steps completed successfully
- [ ] All success criteria met
- [ ] No tenant isolation violations
- [ ] Performance within acceptable ranges
- [ ] Data integrity maintained
- [ ] Ready for production deployment

**Tester Name**: _________________
**Date**: _________________
**Signature**: _________________

---

**Next Steps After Testing**:
1. Document any bugs found in GitHub issues
2. Update spec.md with any clarifications needed
3. Run automated contract tests (if implemented)
4. Deploy to production
5. Monitor logs for errors in first 24 hours
