# Feature 007: Action Plan for Remaining Work

**Date**: 2025-10-15
**Status**: 70-80% Complete - UI Components Remaining
**Estimated Remaining Time**: 5-8 hours

---

## Executive Summary

**What's Done**: All backend infrastructure (types, repositories, APIs)
**What's Needed**: UI components to connect to existing APIs
**Approach**: Incremental - build and test each domain separately

---

## Recommended Execution Order

### Phase 1: Job UI (Highest Priority) - 2-3 hours

**Why First**: Jobs are the core workflow. Testing jobs will reveal any issues with customer/property dependencies.

#### Step 1.1: Create Job List Page (1 hour)
**File**: `/src/app/(authenticated)/supervisor/jobs/page.tsx`

**Tasks**:
- [ ] Create page with withAuth wrapper
- [ ] Fetch jobs from `GET /api/supervisor/jobs`
- [ ] Display table: job_number, title, status, scheduled_start, property address, customer name
- [ ] Add "Create Job" button
- [ ] Add Edit/Delete actions per row
- [ ] Handle loading and error states

**Test**: Can view list of existing jobs

---

#### Step 1.2: Create JobForm Component (1 hour)
**File**: `/src/app/(authenticated)/supervisor/jobs/_components/JobForm.tsx`

**Tasks**:
- [ ] Form fields: title, property_id (dropdown), scheduled_start (date + time), status, notes
- [ ] Fetch properties from `GET /api/supervisor/properties`
- [ ] Display customer name (read-only) when property selected
- [ ] Create job-adapter.ts if needed (date + time → ISO timestamp)
- [ ] Submit to `POST /api/supervisor/jobs` or `PUT /api/supervisor/jobs/[jobId]`
- [ ] Handle validation errors

**Test**: Can create and edit jobs

---

#### Step 1.3: Create Job Detail Page with Items Manager (1 hour)
**File**: `/src/app/(authenticated)/supervisor/jobs/[jobId]/page.tsx`
**Component**: `/src/app/(authenticated)/supervisor/jobs/[jobId]/_components/JobItemsManager.tsx`

**Tasks**:
- [ ] Fetch job from `GET /api/supervisor/jobs/[jobId]`
- [ ] Display job details (number, property, customer, date, status)
- [ ] Add "Edit Job" button
- [ ] Create JobItemsManager component:
  - Fetch assigned items from `GET /api/supervisor/jobs/[jobId]/items`
  - Display table: item_name, quantity, transaction_type, assigned_at
  - Add "Assign Item" button with dropdown from `GET /api/supervisor/items`
  - Submit to `POST /api/supervisor/jobs/[jobId]/items` (transaction API)
  - Handle item removal (check_in transaction)

**Important**: Use transaction API, NOT job_checklist_items table directly

**Test**: Can assign/remove items from job

---

### Phase 2: Customer UI (Dependency for Jobs) - 1-2 hours

**Why Second**: Jobs require customers. Build customer UI to support job creation testing.

#### Step 2.1: Create Customer List Page (30-45 min)
**File**: `/src/app/(authenticated)/supervisor/customers/page.tsx`

**Tasks**:
- [ ] Create page with withAuth wrapper
- [ ] Fetch customers from `GET /api/supervisor/customers`
- [ ] Display table: customer_number, name, email, phone, city (from billing_address)
- [ ] Add "Create Customer" button
- [ ] Add Edit/Delete actions
- [ ] Handle pagination if needed

**Test**: Can view customer list

---

#### Step 2.2: Create CustomerForm Component (45-60 min)
**File**: `/src/app/(authenticated)/supervisor/customers/_components/CustomerForm.tsx`

**Tasks**:
- [ ] Form fields: name, email, phone, mobile_phone
- [ ] Billing address section: street, city, state, zip
- [ ] Service address section (optional, checkbox to enable)
- [ ] Transform form data to API format:
  - billing_address: { street, city, state, zip } JSONB
  - service_address: { street, city, state, zip } JSONB or null
- [ ] Submit to `POST /api/supervisor/customers` or `PATCH /api/supervisor/customers/[id]`
- [ ] Handle validation errors

**Note**: API handles address transformation inline, no separate adapter needed

**Test**: Can create and edit customers

---

### Phase 3: Property UI (Dependency for Jobs) - 1-2 hours

**Why Third**: Jobs require properties. Build property UI to support job creation testing.

#### Step 3.1: Create Property List Page (30-45 min)
**File**: `/src/app/(authenticated)/supervisor/properties/page.tsx`

**Tasks**:
- [ ] Create page with withAuth wrapper
- [ ] Fetch properties from `GET /api/supervisor/properties`
- [ ] Display table: property_number, address, customer name, lot_size
- [ ] Add "Create Property" button
- [ ] Add Edit/Delete actions
- [ ] Verify API response includes customer join (customer.name)

**Test**: Can view property list with customer names

---

#### Step 3.2: Create PropertyForm Component (45-60 min)
**File**: `/src/app/(authenticated)/supervisor/properties/_components/PropertyForm.tsx`

**Tasks**:
- [ ] Form fields: customer_id (dropdown), address (line1, line2, city, state, postal_code), notes, lot_size, gate_code
- [ ] Fetch customers from `GET /api/supervisor/customers` for dropdown
- [ ] **REUSE** `buildPropertyPayload()` from `/src/app/demo-properties/utils.ts`
- [ ] Submit to `POST /api/supervisor/properties` or `PUT /api/supervisor/properties/[id]`
- [ ] Handle validation errors

**Test**: Can create and edit properties

---

### Phase 4: Inventory UI (Independent) - 1 hour

**Why Fourth**: Inventory is needed for job-items linking, but can be tested independently.

#### Step 4.1: Create Inventory Page (1 hour)
**File**: `/src/app/(authenticated)/supervisor/inventory/page.tsx`

**Tasks**:
- [ ] Create page with withAuth wrapper
- [ ] Fetch items from `GET /api/supervisor/items`
- [ ] Display table: item_number, name, category, quantity, status
- [ ] Add "Create Item" button
- [ ] Create ItemForm component (inline or separate file)
  - Fields: name, category, quantity, description, tracking_mode
  - Submit to `POST /api/supervisor/items` or `PATCH /api/supervisor/items/[itemId]`
- [ ] Add Edit/Delete actions
- [ ] **DO NOT** use items.assigned_to_job_id field (UNUSED)

**Note**: Item transactions (check_out/check_in) are handled by job detail page, not inventory page

**Test**: Can create and edit inventory items

---

### Phase 5: Navigation & Testing (Final Polish) - 1 hour

#### Step 5.1: Add Navigation Links (20 min)
**File**: Find supervisor dashboard (likely `/src/app/(authenticated)/supervisor/dashboard/page.tsx`)

**Tasks**:
- [ ] Add nav links:
  - Customers → /supervisor/customers
  - Properties → /supervisor/properties
  - Inventory → /supervisor/inventory
  - Jobs → /supervisor/jobs
- [ ] Style consistently with existing nav

**Test**: Can navigate between all pages

---

#### Step 5.2: Run Complete Workflow Test (40 min)
**Reference**: `/specs/007-integrate-job-creation-workflow/quickstart.md`

**Test Scenario**:
1. [ ] Sign in as super@tophand.tech
2. [ ] Create customer "ACME Landscaping Corp"
3. [ ] Create property "456 Oak Avenue" for ACME
4. [ ] Add 3 items to inventory (Lawn Mower, String Trimmer, Safety Goggles)
5. [ ] Create job for property
6. [ ] Assign items to job
7. [ ] Verify job detail page shows assigned items with transaction history
8. [ ] Test delete operations:
   - Try to delete customer with properties (should fail with FK error)
   - Try to delete property with jobs (should fail with FK error)
   - Successfully delete job, then property, then customer
9. [ ] Sign in as different tenant, verify no data leakage

**Acceptance Criteria**:
- [ ] All steps complete without errors
- [ ] Tenant isolation confirmed
- [ ] FK constraints prevent invalid deletes
- [ ] Transaction-based item assignment works

---

## Optional Tasks (If Time Permits)

### Optional 1: Extract Customer Address Adapter (30 min)
**File**: `/src/app/supervisor/customers/_utils/customer-adapter.ts`

**Tasks**:
- Extract inline address transformation from API route
- Create buildCustomerPayload() and parseCustomerForForm()
- Update CustomerForm to use adapter

**Benefit**: Consistency with property pattern, easier testing

**Risk**: Low - current inline approach works fine

---

### Optional 2: Verify API Joins (30 min)

**Tasks**:
- [ ] Test `GET /api/supervisor/properties` - verify response includes `customer` object
- [ ] Test `GET /api/supervisor/jobs` - verify response includes `property` and `customer` objects
- [ ] If joins missing, update API routes:
  - Properties: Add `.select('*, customer:customers!customer_id(id,name,email)')`
  - Jobs: Add `.select('*, property:properties!property_id(*, customer:customers!customer_id(id,name,email))')`

**Benefit**: Reduces UI complexity, fewer API calls

---

### Optional 3: Check for Demo Components (15 min)

**Tasks**:
- [ ] Check if `/src/app/demo-crud/` has CustomerForm, CustomerList
- [ ] Check if `/src/app/demo-properties/` has PropertyForm
- [ ] Check if `/src/app/demo-items/` has ItemForm
- [ ] If found, copy and adapt instead of building from scratch

**Benefit**: Saves 2-3 hours if components exist

---

## Common Patterns to Follow

### 1. Page Structure
```typescript
import { withAuth } from '@/lib/auth/withAuth';

function SupervisorCustomersPage() {
  // Fetch data
  // Render list + form modal
  // Handle CRUD operations
  return <CustomerList ... />;
}

export default withAuth(SupervisorCustomersPage, {
  requiredRole: 'supervisor'
});
```

### 2. Form Pattern
```typescript
function CustomerForm({ customer, onSave, onCancel }) {
  const [formState, setFormState] = useState({ ... });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildPayload(formState); // Transform to API format
    const response = await fetch('/api/supervisor/customers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    // Handle response
    onSave();
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### 3. API Call Pattern
```typescript
const fetchCustomers = async () => {
  const response = await fetch('/api/supervisor/customers');
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
  setCustomers(data.customers);
};
```

---

## Success Criteria

**Feature 007 is COMPLETE when**:
- [ ] All UI pages created (customers, properties, inventory, jobs)
- [ ] Can create customer → property → job → assign items workflow
- [ ] All CRUD operations work (create, read, update, delete)
- [ ] Tenant isolation confirmed (no data leakage)
- [ ] FK constraints prevent invalid deletes
- [ ] Navigation links work
- [ ] No console errors
- [ ] quickstart.md test scenario passes

---

## Risk Mitigation

### Risk 1: Demo Components Don't Exist
**Likelihood**: Medium
**Impact**: +2-3 hours to estimated time
**Mitigation**: Check for demo components first (Step 0)

### Risk 2: API Joins Missing
**Likelihood**: Low
**Impact**: +1-2 hours to add joins
**Mitigation**: Test APIs before building UI

### Risk 3: Job-Items Transaction API Unfamiliar
**Likelihood**: Medium (new pattern)
**Impact**: +1 hour to understand and implement
**Mitigation**: Read `/src/app/api/supervisor/jobs/[jobId]/items/route.ts` carefully before building JobItemsManager

---

## Estimated Timeline Summary

| Phase | Task | Estimated Time |
|-------|------|----------------|
| Phase 1 | Job UI (list, form, detail + items) | 2-3 hours |
| Phase 2 | Customer UI (list + form) | 1-2 hours |
| Phase 3 | Property UI (list + form) | 1-2 hours |
| Phase 4 | Inventory UI | 1 hour |
| Phase 5 | Navigation + Testing | 1 hour |
| **TOTAL** | **Remaining Work** | **5-8 hours** |

**Assumptions**:
- No major bugs in existing APIs
- Demo components exist to copy from
- API joins already include necessary data
- Transaction API works as documented

**Adjustments**:
- If demo components missing: +2-3 hours
- If API joins missing: +1-2 hours
- If bugs discovered: +1-3 hours

**Best Case**: 5 hours (everything works smoothly)
**Expected Case**: 6-7 hours (minor issues)
**Worst Case**: 10-12 hours (no demo components, API issues)

---

## Next Immediate Action

**Start Here**: Check for demo components

```bash
# Check for existing UI components
ls -la src/app/demo-crud/
ls -la src/app/demo-properties/
ls -la src/app/demo-items/
ls -la src/app/demo-jobs/
```

**If found**: Copy and adapt (saves 2-3 hours)
**If not found**: Build from scratch following patterns above

**Then**: Start with Phase 1 (Job UI) - highest priority

---

**Action Plan Created**: 2025-10-15
**Status**: Ready to start UI implementation
**Confidence**: High (backend is solid, UI is straightforward)
