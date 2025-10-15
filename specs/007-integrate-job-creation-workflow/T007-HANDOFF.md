# T007 Implementation Handoff

**Date**: 2025-10-15
**Branch**: `main` (staying on main for Railway auto-deploy)
**Current Task**: T007 - Create Customer Types [P]
**Status**: READY TO START - All prep complete

---

## 🎯 Expectations & Ground Rules

### Working Mode
- ✅ **Branch**: Strictly on `main` (no feature branches)
- ✅ **Commits**: Early and often (commit after each passing test)
- ✅ **TDD**: Tests first, then implementation (Constitution requirement)
- ✅ **Evidence**: Document all test runs and results

### Why Main Branch?
Railway auto-deploy is configured for main branch. User prefers continuous deployment over feature branch isolation for this project.

---

## ✅ Foundation Complete - T002-T006

### Database State (Verified 2025-10-15T01:29:53Z)
- ✅ All 5 tables exist: customers (19 cols), properties (22 cols), items (40 cols), jobs (51 cols), job_checklist_items (14 cols)
- ✅ job_checklist_items created via migration (9/9 operations successful)
- ✅ Full schema snapshot captured in `T002-schema-verification-report.md`

### RLS State (Fixed 2025-10-15T01:34:48Z)
- ✅ All 5 tables Constitution §1 compliant (JWT app_metadata pattern)
- ✅ customers: Fixed hardcoded tenant ID → JWT app_metadata
- ✅ properties: Removed tenant_assignments lookup (performance fix)
- ✅ items: Added WITH CHECK clause
- ✅ jobs: Removed tenant_assignments lookup (performance fix)
- ✅ job_checklist_items: Added WITH CHECK clause
- ✅ Full execution log in `T003-T006-rls-verification-report.md`

**Result**: Multi-tenant support restored, performance optimized, security hardened.

---

## 🔥 T007: Current Active Task

### Task Definition
**Type**: Domain Model (TypeScript interfaces)
**Estimated Time**: 20 minutes
**Dependencies**: T002 ✅ (satisfied)
**Parallel**: Can run with T003-T006 (already complete) or T015, T028

### Acceptance Criteria
- [ ] Customer interface matches database schema (19 columns)
- [ ] Address type defined for JSONB fields (billing_address, service_address)
- [ ] Create/Update input types defined
- [ ] File follows TypeScript best practices

### Files to Create
1. `/src/domains/customer/types/customer.ts` - Main types file
2. `/src/domains/customer/types/__tests__/customer.test.ts` - Test file
3. `/src/domains/customer/types/__tests__/fixtures/customer.fixtures.ts` - Mock data

---

## 📋 Implementation Plan (TDD Flow)

### Step 1: Create Failing Tests ⚠️ START HERE

**File**: `/src/domains/customer/types/__tests__/customer.test.ts`

**Test Cases** (from T007-PREP-NOTES.md):
1. **Address type validation**
   - Should allow valid address with all required fields (street, city, state, zip)

2. **Customer interface validation**
   - Should match database schema structure (19 columns)
   - Should allow service_address to be null
   - Should allow optional fields to be null (phone, mobile_phone)

3. **CreateCustomerInput validation**
   - Should require name, email, billing_address
   - Should allow optional service_address, phone, mobile_phone

4. **UpdateCustomerInput validation**
   - Should allow partial updates
   - Should allow updating just billing_address

5. **Type compatibility tests**
   - Should be compatible with API response
   - Should be compatible with database row (Supabase response)

**Run Command**:
```bash
npm test src/domains/customer/types/__tests__/customer.test.ts
```
**Expected**: All tests fail (types don't exist yet)

---

### Step 2: Implement Customer Types

**File**: `/src/domains/customer/types/customer.ts`

**Schema Reference** (from T002 verification):
```typescript
// customers table: 19 columns
// Required for Customer interface:
// - id, tenant_id, customer_number, name, email (NOT NULL in some cases)
// - phone, mobile_phone (nullable)
// - billing_address (JSONB), service_address (JSONB, nullable)
// - created_at, updated_at (timestamps)

// JSONB Structure:
{
  "billing_address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zip": "62701"
  }
}
```

**Implementation Pattern** (follow property types if they exist):
```typescript
export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  customer_number: string;
  name: string;
  email: string;
  phone: string | null;
  mobile_phone: string | null;
  billing_address: Address;
  service_address: Address | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  mobile_phone?: string;
  billing_address: Address;
  service_address?: Address;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {}
```

**Reference Files**:
- `/src/domains/property/types/property.ts` - Similar Address pattern (if exists)
- `/src/app/demo-properties/utils.ts` - Address JSONB adapter (line ~50-80)
- `contracts/customers-api.json` - API contract with Address structure

---

### Step 3: Run Tests Until Pass

**Run Command**:
```bash
npm test src/domains/customer/types/__tests__/customer.test.ts
```

**Expected**: All tests pass ✅

**Document Results**:
- Copy test output to `T007-test-results.md`
- Note any TypeScript errors and how they were resolved
- Confirm 0 failures

---

### Step 4: Create Mock Fixtures

**File**: `/src/domains/customer/types/__tests__/fixtures/customer.fixtures.ts`

**Purpose**: Provide mock data for T008+ tests (CustomerRepository, API routes)

**Fixtures to Export**:
```typescript
export const mockAddress: Address = { ... };
export const mockCustomer: Customer = { ... };
export const mockCreateCustomerInput: CreateCustomerInput = { ... };
export const mockUpdateCustomerInput: UpdateCustomerInput = { ... };
```

**Full fixture content** is documented in `T007-PREP-NOTES.md` (lines 347-420)

---

### Step 5: Commit & Update Todo

**Git Commands**:
```bash
git add src/domains/customer/types/
git commit -m "feat(customer): add customer types and test coverage

- Define Customer, Address, CreateCustomerInput, UpdateCustomerInput interfaces
- Match 19-column database schema from T002 verification
- JSONB Address type for billing_address/service_address fields
- Full test coverage with type validation and compatibility tests
- Mock fixtures for downstream tasks (T008-T010)

Tests: All passing (customer.test.ts)
References: T002 schema verification, contracts/customers-api.json

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

**Update TodoWrite**:
```
- [x] T007: Create Customer Types
- [ ] T008: Create Customer Repository (NEXT)
```

**Update plan.md**:
Add T007 completion note under "Completed Tasks Summary"

---

## 🚨 Blocking State Check

### Before Starting T007
- ✅ Database schema verified (T002 complete)
- ✅ RLS policies fixed (T003-T006 complete)
- ✅ No TypeScript errors in existing codebase
- ✅ Tests can run: `npm test` works
- ✅ No uncommitted changes blocking work

### If Any Issues Surface
**STOP and flag immediately**:
- ❌ Database anomaly (table missing, schema mismatch)
- ❌ RLS surprise (policy not working as expected)
- ❌ TypeScript errors in existing code
- ❌ Test framework not working

**Do NOT proceed** until issue is resolved and documented.

---

## 📊 Next Tasks After T007

### Immediate Downstream (Sequential)
- **T008**: Create Customer Repository (depends on T007 types)
- **T009**: Implement Customer Address Adapter (depends on T007 types)
- **T010**: Create Customer API GET route (depends on T008 repository)

### Parallel Opportunities (After T007)
Can start in parallel with T008-T010:
- **T015**: Create Property Types [P]
- **T028**: Create Job Checklist Item Types [P]

**Recommendation**: Complete T007 → T008 → T009 first to establish customer domain pattern, then consider parallel work.

---

## 📚 Reference Documents

### Essential Reading
1. **`T007-PREP-NOTES.md`** - Full prep details (acceptance criteria, TDD plan, mocks)
2. **`T002-schema-verification-report.md`** - Database schema snapshot with 19-column customers table
3. **`T003-T006-rls-verification-report.md`** - RLS policy fixes and validation
4. **`contracts/customers-api.json`** - API contract with Address JSONB structure
5. **`tasks.md`** - Full task list (T001-T036)

### Supporting Context
- **`plan.md`** - Feature plan with T001-T006 completion notes
- **`data-model.md`** - Section 2.1 for customers table documentation
- **`quickstart.md`** - End-to-end test scenario (will use T007 types)

---

## ✅ Checklist Before Starting

- [ ] Read this handoff document fully
- [ ] Review `T007-PREP-NOTES.md` for detailed TDD plan
- [ ] Confirm on `main` branch: `git branch` shows `* main`
- [ ] Confirm no uncommitted changes: `git status` clean
- [ ] Confirm tests can run: `npm test` executes without errors
- [ ] Review existing property types (if exist) for Address pattern reference
- [ ] Ready to create failing tests first (TDD requirement)

---

## 🎯 Success Criteria

**T007 is complete when**:
1. ✅ File `/src/domains/customer/types/customer.ts` exists
2. ✅ All interfaces defined (Customer, Address, CreateCustomerInput, UpdateCustomerInput)
3. ✅ Tests pass: `npm test src/domains/customer/types/__tests__/customer.test.ts`
4. ✅ No TypeScript errors: `npm run type-check` (or `tsc --noEmit`)
5. ✅ Fixtures file created: `/src/domains/customer/types/__tests__/fixtures/customer.fixtures.ts`
6. ✅ Committed to main with descriptive message
7. ✅ TodoWrite updated
8. ✅ Test results documented

**Then proceed to**: T008 (Customer Repository)

---

## 💬 Communication Notes

**If you need clarification**:
- Check `T007-PREP-NOTES.md` first (most details are there)
- Review schema in `T002-schema-verification-report.md` (lines 272-295)
- Check API contract in `contracts/customers-api.json`
- If still unclear, ask user before making assumptions

**If you discover issues**:
- Document in `T007-ISSUES.md` (create if needed)
- Flag to user immediately
- Do not proceed until resolved

**Evidence trail**:
- Document all test runs (copy output)
- Note any TypeScript errors and resolutions
- Keep Constitution compliance notes

---

**Status**: READY TO START ✅
**Next Action**: Create `/src/domains/customer/types/__tests__/customer.test.ts` with failing tests
**Estimated Time**: 20 minutes for full T007 completion
**Branch**: `main` (no feature branch)
**TDD**: Tests first, then implementation
