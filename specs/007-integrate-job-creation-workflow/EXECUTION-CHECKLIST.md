# Feature 007: Execution Checklist

**Date**: 2025-10-15
**Status**: Ready to Execute - Copy & Adapt Strategy
**Estimated Time**: 2-4 hours

---

## Pre-Execution Confirmation ✅

- [x] Database verified (T002) - 5 tables exist
- [x] RLS policies fixed (T003-T006) - Constitution compliant
- [x] Backend complete (T007-T029) - Types, repos, APIs ready
- [x] Demo components located - All domains have reusable components
- [x] Transaction API verified - Job-items uses transactions (superior approach)
- [x] Documentation complete - Status report, action plan, component inventory

---

## Execution Order: Copy → Wrap → Test

### ✅ Phase 3: Job UI Components (45 minutes)

**Why First**: Jobs are the core workflow. JobForm + JobList + JobItemsManager are production-ready.

#### Step 3.1: Create Directory Structure
```bash
mkdir -p src/app/\(authenticated\)/supervisor/jobs/_components
mkdir -p src/app/\(authenticated\)/supervisor/jobs/_utils
mkdir -p src/app/\(authenticated\)/supervisor/jobs/\[jobId\]
```

#### Step 3.2: Copy Components (15 min)
- [ ] Copy `/src/app/demo-jobs/_components/JobForm.tsx` → `/src/app/(authenticated)/supervisor/jobs/_components/JobForm.tsx`
- [ ] Copy `/src/app/demo-jobs/_components/JobList.tsx` → `/src/app/(authenticated)/supervisor/jobs/_components/JobList.tsx`
- [ ] Copy `/src/app/demo-jobs/utils.ts` → `/src/app/(authenticated)/supervisor/jobs/_utils/job-utils.ts`

#### Step 3.3: Create Main Page (15 min)
- [ ] Create `/src/app/(authenticated)/supervisor/jobs/page.tsx`
- [ ] Import withAuth: `import { withAuth } from '@/lib/auth/withAuth'`
- [ ] Copy logic from `/src/app/demo-jobs/page.tsx`
- [ ] Wrap export: `export default withAuth(SupervisorJobsPage, { requiredRole: 'supervisor' })`
- [ ] Update API endpoint if needed (likely `/api/supervisor/jobs` already correct)
- [ ] Update import paths to use `_components` and `_utils`

#### Step 3.4: Create Job Detail with Items Manager (15 min)
- [ ] Copy `/src/app/demo-jobs/[jobId]/items/page.tsx` → `/src/app/(authenticated)/supervisor/jobs/[jobId]/page.tsx`
- [ ] Wrap with withAuth
- [ ] Remove hardcoded tenant ID (line 74, 111) - use getRequestContext
- [ ] Update back button route: `/demo-jobs` → `/supervisor/jobs`
- [ ] Update styling if needed

**Test**:
- [ ] Navigate to `/supervisor/jobs`
- [ ] See job list (if jobs exist) or empty state
- [ ] Click "Create Job" button
- [ ] Fill form (requires customers and properties to exist)
- [ ] Create job
- [ ] Click into job detail
- [ ] See "Add Item" section
- [ ] Assign item to job
- [ ] Verify transaction API works

**Commit**:
```bash
git add src/app/\(authenticated\)/supervisor/jobs/
git commit -m "feat(jobs): add job management UI with transaction-based item assignment

- Copy JobForm and JobList from demo-jobs
- Add job detail page with JobItemsManager
- Use transaction API for item assignment (check_out/check_in)
- Wrap with withAuth for supervisor access
- Update routes from /demo-jobs to /supervisor/jobs

Tests: Manual workflow test pending (requires customers and properties)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

---

### ✅ Phase 4: Property UI Components (30 minutes)

**Why Second**: Jobs need property dropdown. PropertyForm is ready.

#### Step 4.1: Create Directory Structure
```bash
mkdir -p src/app/\(authenticated\)/supervisor/properties/_components
mkdir -p src/app/\(authenticated\)/supervisor/properties/_utils
```

#### Step 4.2: Copy Components (10 min)
- [ ] Copy `/src/app/demo-properties/_components/PropertyForm.tsx` → `/src/app/(authenticated)/supervisor/properties/_components/PropertyForm.tsx`
- [ ] Copy `/src/app/demo-properties/_components/PropertyList.tsx` → `/src/app/(authenticated)/supervisor/properties/_components/PropertyList.tsx`
- [ ] Copy `/src/app/demo-properties/utils.ts` → `/src/app/(authenticated)/supervisor/properties/_utils/property-adapter.ts`

#### Step 4.3: Create Main Page (15 min)
- [ ] Create `/src/app/(authenticated)/supervisor/properties/page.tsx`
- [ ] Copy logic from `/src/app/demo-properties/page.tsx`
- [ ] Wrap with withAuth
- [ ] Update API endpoints to `/api/supervisor/properties`
- [ ] Import property-adapter from `_utils`
- [ ] Update import paths

#### Step 4.4: Verify Customer Dropdown
- [ ] PropertyForm should have customer dropdown that fetches from `/api/supervisor/customers`
- [ ] Verify dropdown works (requires customers to exist)

**Test**:
- [ ] Navigate to `/supervisor/properties`
- [ ] Click "Create Property"
- [ ] See customer dropdown populated
- [ ] Fill form with address
- [ ] Create property
- [ ] Verify property appears in list with customer name

**Commit**:
```bash
git add src/app/\(authenticated\)/supervisor/properties/
git commit -m "feat(properties): add property management UI with customer relationship

- Copy PropertyForm and PropertyList from demo-properties
- Reuse property-adapter for address JSONB transformation
- Customer dropdown fetches from /api/supervisor/customers
- Wrap with withAuth for supervisor access
- Update routes from /demo-properties to /supervisor/properties

Tests: Manual workflow test pending (requires customers)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

---

### ✅ Phase 5: Customer UI Components (1 hour)

**Why Third**: Jobs and properties need customer dropdown. CustomerForm needs address enhancements.

#### Step 5.1: Create Directory Structure
```bash
mkdir -p src/app/\(authenticated\)/supervisor/customers/_components
```

#### Step 5.2: Copy CustomerList (10 min)
- [ ] Copy `/src/app/demo-crud/_components/CustomerList.tsx` → `/src/app/(authenticated)/supervisor/customers/_components/CustomerList.tsx`
- [ ] Update to display billing address (transform JSONB to string)
- [ ] Update edit/delete API endpoints to `/api/supervisor/customers`

#### Step 5.3: Enhance CustomerForm (30 min)
- [ ] Copy `/src/app/demo-crud/_components/CustomerForm.tsx` → `/src/app/(authenticated)/supervisor/customers/_components/CustomerForm.tsx`
- [ ] Add billing address fields:
  ```tsx
  <div>
    <label>Billing Address</label>
    <input name="billingStreet" placeholder="Street" />
    <input name="billingCity" placeholder="City" />
    <input name="billingState" placeholder="State" maxLength={2} />
    <input name="billingZip" placeholder="Zip" />
  </div>
  ```
- [ ] Add service address section (optional):
  ```tsx
  <label>
    <input type="checkbox" checked={useServiceAddress} onChange={...} />
    Different service address
  </label>
  {useServiceAddress && (
    <div>
      <input name="serviceStreet" />
      <input name="serviceCity" />
      <input name="serviceState" />
      <input name="serviceZip" />
    </div>
  )}
  ```
- [ ] Transform to JSONB on submit:
  ```tsx
  const payload = {
    name: draft.name,
    email: draft.email,
    phone: draft.phone,
    billing_address: {
      street: draft.billingStreet,
      city: draft.billingCity || 'N/A',
      state: draft.billingState?.toUpperCase() || 'N/A',
      zip: draft.billingZip || '00000'
    },
    service_address: useServiceAddress ? {
      street: draft.serviceStreet,
      city: draft.serviceCity || 'N/A',
      state: draft.serviceState?.toUpperCase() || 'N/A',
      zip: draft.serviceZip || '00000'
    } : null
  };
  ```

#### Step 5.4: Create Main Page (15 min)
- [ ] Create `/src/app/(authenticated)/supervisor/customers/page.tsx`
- [ ] Copy logic from `/src/app/demo-crud/page.tsx`
- [ ] Wrap with withAuth
- [ ] Update API endpoints to `/api/supervisor/customers`

**Test**:
- [ ] Navigate to `/supervisor/customers`
- [ ] Click "Create Customer"
- [ ] Fill name, email, billing address
- [ ] Optionally enable service address
- [ ] Create customer
- [ ] Verify customer appears in list with address
- [ ] Verify JSONB structure in database (optional)

**Commit**:
```bash
git add src/app/\(authenticated\)/supervisor/customers/
git commit -m "feat(customers): add customer management UI with address support

- Copy CustomerForm and CustomerList from demo-crud
- Add billing_address and service_address JSONB fields
- Service address optional (checkbox to enable)
- Transform form data to JSONB format for API
- Display address in customer list
- Wrap with withAuth for supervisor access

Tests: Manual workflow test - customer CRUD works

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

---

### ✅ Phase 6: Inventory UI (20 minutes)

**Why Fourth**: Needed for job-items assignment. Simple CRUD page.

#### Step 6.1: Create Directory Structure
```bash
mkdir -p src/app/\(authenticated\)/supervisor/inventory
```

#### Step 6.2: Copy Component (10 min)
- [ ] Copy `/src/app/demo-items/page.tsx` → `/src/app/(authenticated)/supervisor/inventory/page.tsx`
- [ ] Wrap with withAuth
- [ ] Update API endpoints to `/api/supervisor/items` (likely already correct)
- [ ] Update styling if needed

**Test**:
- [ ] Navigate to `/supervisor/inventory`
- [ ] Click "Create Item"
- [ ] Fill item form (name, category, quantity)
- [ ] Create item
- [ ] Verify item appears in list
- [ ] Edit item
- [ ] Delete item

**Commit**:
```bash
git add src/app/\(authenticated\)/supervisor/inventory/
git commit -m "feat(inventory): add inventory management UI

- Copy items page from demo-items
- Simple CRUD for items (name, category, quantity, status)
- Uses /api/supervisor/items endpoints
- Wrap with withAuth for supervisor access

Tests: Manual workflow test - item CRUD works

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

---

### ✅ Phase 7: Navigation & QA (30-60 minutes)

#### Step 7.1: Add Navigation Links (20 min)
- [ ] Find supervisor dashboard (likely `/src/app/(authenticated)/supervisor/dashboard/page.tsx` or layout)
- [ ] Add navigation links:
  ```tsx
  <nav>
    <Link href="/supervisor/customers">Customers</Link>
    <Link href="/supervisor/properties">Properties</Link>
    <Link href="/supervisor/inventory">Inventory</Link>
    <Link href="/supervisor/jobs">Jobs</Link>
  </nav>
  ```
- [ ] Style consistently with existing nav

**Test**:
- [ ] Click each nav link
- [ ] Verify navigation works
- [ ] Verify active link highlighting (if implemented)

**Commit**:
```bash
git add src/app/\(authenticated\)/supervisor/
git commit -m "feat(navigation): add supervisor navigation links

- Add links to customers, properties, inventory, jobs pages
- Update supervisor dashboard/layout with nav menu

Tests: Navigation works, all pages accessible

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

---

#### Step 7.2: Run Complete Workflow Test (30-40 min)

**Reference**: `/specs/007-integrate-job-creation-workflow/quickstart.md`

**Test Scenario**:
- [ ] **Step 1**: Sign in as super@tophand.tech
- [ ] **Step 2**: Navigate to Customers
- [ ] **Step 3**: Create customer "ACME Landscaping Corp"
  - Name: ACME Landscaping Corp
  - Email: contact@acmelandscaping.com
  - Phone: (555) 123-4567
  - Billing Address: 123 Business Blvd, Springfield, IL, 62701
- [ ] **Step 4**: Navigate to Properties
- [ ] **Step 5**: Create property "456 Oak Avenue" for ACME
  - Select customer: ACME Landscaping Corp
  - Address: 456 Oak Avenue, Springfield, IL, 62702
- [ ] **Step 6**: Navigate to Inventory
- [ ] **Step 7**: Add 3 items:
  - Lawn Mower (quantity: 1)
  - String Trimmer (quantity: 2)
  - Safety Goggles (quantity: 10)
- [ ] **Step 8**: Navigate to Jobs
- [ ] **Step 9**: Create job for ACME property
  - Customer: ACME Landscaping Corp
  - Property: 456 Oak Avenue
  - Title: "Weekly lawn maintenance"
  - Date: Today + 1 day
  - Priority: Normal
- [ ] **Step 10**: Click into job detail
- [ ] **Step 11**: Assign items to job:
  - Add Lawn Mower (quantity: 1)
  - Add String Trimmer (quantity: 1)
  - Add Safety Goggles (quantity: 2)
- [ ] **Step 12**: Verify job shows assigned items with transaction details
- [ ] **Step 13**: Test delete operations:
  - Try to delete customer → Should fail (has properties)
  - Try to delete property → Should fail (has jobs)
  - Delete job → Success
  - Delete property → Success
  - Delete customer → Success
- [ ] **Step 14**: Sign in as different tenant (if possible)
- [ ] **Step 15**: Verify no data leakage (can't see ACME data)

**Acceptance Criteria**:
- [ ] All steps complete without errors
- [ ] No console errors
- [ ] Tenant isolation confirmed
- [ ] FK constraints work
- [ ] Transaction-based item assignment works
- [ ] Denormalized item_name displays correctly

---

#### Step 7.3: Document Issues & Fix (Variable Time)

If issues found:
- [ ] Create `/specs/007-integrate-job-creation-workflow/ISSUES.md`
- [ ] Document each issue:
  - Description
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Fix applied
- [ ] Fix issues one by one
- [ ] Re-test after each fix
- [ ] Commit fixes with descriptive messages

---

#### Step 7.4: Final Commit & Summary

**Commit**:
```bash
git add .
git commit -m "feat(007): complete job creation workflow integration

Summary:
- ✅ Customer management UI (with billing/service addresses)
- ✅ Property management UI (with customer relationship)
- ✅ Inventory management UI (items CRUD)
- ✅ Job management UI (with customer/property dropdowns)
- ✅ Job-items assignment (transaction-based check_out/check_in)
- ✅ Navigation links in supervisor dashboard
- ✅ All pages protected with withAuth (supervisor role)
- ✅ Complete workflow tested (quickstart.md scenario)

Backend: All APIs, types, repositories already existed (T001-T029 complete)
Frontend: Copied and adapted demo components (2-4 hours vs 5-8 hours estimated)

Transaction API: Uses item_transactions table (superior to job_checklist_items)
Tenant Isolation: Enforced via RLS + getRequestContext
Tests: Manual workflow test passed ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

---

## Common Issues & Solutions

### Issue 1: Authentication Redirect Not Working
**Symptom**: Page doesn't redirect to /sign-in when not authenticated

**Fix**:
```typescript
// Ensure withAuth is imported and used correctly
import { withAuth } from '@/lib/auth/withAuth';

export default withAuth(YourPageComponent, {
  requiredRole: 'supervisor'
});
```

---

### Issue 2: API Endpoints Return 401
**Symptom**: API calls fail with 401 Unauthorized

**Fix**:
```typescript
// Remove hardcoded tenant IDs in fetch calls
// API routes should use getRequestContext() to get tenant from JWT

// WRONG:
headers: { 'x-tenant-id': '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e' }

// RIGHT:
// No tenant header needed - getRequestContext extracts from JWT
```

---

### Issue 3: Customer/Property Dropdowns Empty
**Symptom**: Dropdowns don't populate in JobForm or PropertyForm

**Fix**:
```typescript
// Ensure customers/properties are fetched on component mount
useEffect(() => {
  async function loadData() {
    const res = await fetch('/api/supervisor/customers');
    const data = await res.json();
    setCustomers(data.customers);
  }
  loadData();
}, []);
```

---

### Issue 4: Address Fields Not Saving
**Symptom**: Customer created but billing_address is null

**Fix**:
```typescript
// Ensure JSONB transformation happens before API call
const payload = {
  name: form.name,
  email: form.email,
  billing_address: {
    street: form.billingStreet,
    city: form.billingCity || 'N/A',
    state: form.billingState?.toUpperCase() || 'N/A',
    zip: form.billingZip || '00000'
  }
};
```

---

### Issue 5: Transaction API Not Working
**Symptom**: Items not assigning to jobs

**Fix**:
```typescript
// Ensure POST to correct endpoint with correct payload
await fetch(`/api/supervisor/jobs/${jobId}/items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    item_id: selectedItemId,
    quantity: quantity
  })
});
```

---

## Success Criteria

**Feature 007 is COMPLETE when**:
- [x] Phase 0-2: Database, RLS, backend verified (DONE)
- [ ] Phase 3: Job UI functional (list, form, detail, items)
- [ ] Phase 4: Property UI functional (list, form, customer dropdown)
- [ ] Phase 5: Customer UI functional (list, form with addresses)
- [ ] Phase 6: Inventory UI functional (list, form)
- [ ] Phase 7: Navigation works, quickstart.md test passes
- [ ] No console errors
- [ ] Tenant isolation confirmed
- [ ] Transaction API works
- [ ] All commits pushed to main

---

## Time Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| Phase 0 | N/A | Complete | Database + RLS verified |
| Phase 1 | N/A | Complete | Backend survey complete |
| Phase 2 | N/A | Complete | Documentation complete |
| Phase 3 | 45 min | _____ | Job UI components |
| Phase 4 | 30 min | _____ | Property UI components |
| Phase 5 | 1 hour | _____ | Customer UI + addresses |
| Phase 6 | 20 min | _____ | Inventory UI |
| Phase 7 | 30-60 min | _____ | Navigation + QA |
| **TOTAL** | **2-4 hours** | **_____** | Actual time taken |

---

## Final Checklist

Before marking feature complete:
- [ ] All pages accessible via navigation
- [ ] All CRUD operations work
- [ ] Authentication enforced (redirect to /sign-in if not logged in)
- [ ] Tenant isolation enforced (can't see other tenant's data)
- [ ] FK constraints prevent invalid deletes
- [ ] Transaction API assigns/returns items correctly
- [ ] No hardcoded tenant IDs in code
- [ ] All commits pushed to main
- [ ] Railway deployment successful
- [ ] quickstart.md workflow passes

---

**Checklist Created**: 2025-10-15
**Status**: Ready to execute
**Next Action**: Start Phase 3 (Job UI components)
