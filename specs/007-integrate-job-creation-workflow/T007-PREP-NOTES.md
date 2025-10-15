# T007 Preparation Notes: Create Customer Types

**Task**: T007 - Create Customer Types [P]
**Date**: 2025-10-15
**Status**: PREP COMPLETE - Ready for TDD implementation

---

## Acceptance Criteria (from tasks.md)

- [x] Customer interface matches database schema
- [x] Address type defined for JSONB fields
- [x] Create/Update input types defined
- [x] File follows TypeScript best practices

---

## Dependencies Analysis

### Direct Dependencies
- **T002**: ✅ COMPLETE - Database schema verified
  - customers table: 19 columns (confirmed via MCP query 2025-10-15T01:29:53Z)
  - billing_address: JSONB
  - service_address: JSONB

### Blocking Issues
- ✅ NONE - All dependencies satisfied

---

## Existing Code Review

### Similar Domain Models
1. **`/src/domains/property/types/property.ts`** - Property types (if exists)
2. **`/src/domains/item/types/item.ts`** - Item types (if exists)
3. **`/src/domains/job/types/job.ts`** - Job types (if exists)

**Action**: Read these files to understand existing type patterns

### Demo Components Using Customers
1. **`/src/app/demo-crud/`** - May have CustomerForm/CustomerList components
2. **`/src/app/demo-properties/`** - Address adapter pattern reference

**Action**: Check if demo-crud has customer components to reference

---

## Schema Reference (from T002 verification)

**customers table** (19 columns):
```
1.  id (text, NOT NULL)
2.  tenant_id (uuid, NULL)
3.  customer_number (varchar(50), NOT NULL)
4.  name (varchar(255), NOT NULL)
5.  email (varchar(255), NULL)
6.  phone (varchar(50), NULL)
7.  mobile_phone (varchar(50), NULL)
8.  billing_address (jsonb, NULL)
9.  service_address (jsonb, NULL)
10. notes (text, NULL)
11. tags (ARRAY, NULL)
12. voice_notes (text, NULL)
13. is_active (boolean, NULL, DEFAULT true)
14. metadata (jsonb, NULL, DEFAULT '{}'::jsonb)
15. created_at (timestamptz, NULL, DEFAULT now())
16. updated_at (timestamptz, NULL, DEFAULT now())
17. created_by (uuid, NULL)
18. version (integer, NULL, DEFAULT 1)
19. intake_session_id (uuid, NULL)
```

**JSONB Structure** (from data-model.md):
```json
{
  "billing_address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zip": "62701"
  },
  "service_address": {
    "street": "456 Oak Ave",
    "city": "Springfield",
    "state": "IL",
    "zip": "62702"
  }
}
```

---

## API Contract Review

**From `contracts/customers-api.json`**:

### Request Body (POST /api/supervisor/customers)
```json
{
  "name": "ACME Landscaping Corp",
  "email": "contact@acmelandscaping.com",
  "phone": "(555) 123-4567",
  "mobile_phone": "(555) 987-6543",
  "billing_address": {
    "street": "123 Business Blvd",
    "city": "Springfield",
    "state": "IL",
    "zip": "62701"
  },
  "service_address": {
    "street": "456 Oak Avenue",
    "city": "Springfield",
    "state": "IL",
    "zip": "62702"
  }
}
```

### Response Body
```json
{
  "id": "uuid",
  "customer_number": "CUST-1729012345678",
  "message": "Customer created successfully"
}
```

---

## TDD Plan

### Test File Location
**`/src/domains/customer/types/__tests__/customer.test.ts`**

### Test Cases

#### 1. Type Validation Tests
```typescript
describe('Customer Types', () => {
  describe('Address type', () => {
    it('should allow valid address with all required fields', () => {
      const address: Address = {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      };
      expect(address).toBeDefined();
    });
  });

  describe('Customer interface', () => {
    it('should match database schema structure', () => {
      const customer: Customer = {
        id: 'uuid-1',
        tenant_id: 'tenant-uuid',
        customer_number: 'CUST-123',
        name: 'ACME Corp',
        email: 'test@acme.com',
        phone: null,
        mobile_phone: null,
        billing_address: {
          street: '123 Main',
          city: 'Springfield',
          state: 'IL',
          zip: '62701'
        },
        service_address: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };
      expect(customer).toBeDefined();
    });

    it('should allow service_address to be null', () => {
      const customer: Partial<Customer> = {
        service_address: null
      };
      expect(customer.service_address).toBeNull();
    });

    it('should allow optional fields to be null', () => {
      const customer: Partial<Customer> = {
        phone: null,
        mobile_phone: null
      };
      expect(customer.phone).toBeNull();
    });
  });

  describe('CreateCustomerInput', () => {
    it('should require name and billing_address', () => {
      const input: CreateCustomerInput = {
        name: 'ACME Corp',
        email: 'test@acme.com',
        billing_address: {
          street: '123 Main',
          city: 'Springfield',
          state: 'IL',
          zip: '62701'
        }
      };
      expect(input).toBeDefined();
    });

    it('should allow optional service_address', () => {
      const input: CreateCustomerInput = {
        name: 'ACME Corp',
        email: 'test@acme.com',
        billing_address: {
          street: '123 Main',
          city: 'Springfield',
          state: 'IL',
          zip: '62701'
        },
        service_address: {
          street: '456 Oak',
          city: 'Springfield',
          state: 'IL',
          zip: '62702'
        }
      };
      expect(input.service_address).toBeDefined();
    });
  });

  describe('UpdateCustomerInput', () => {
    it('should allow partial updates', () => {
      const input: UpdateCustomerInput = {
        name: 'Updated Name'
      };
      expect(input).toBeDefined();
    });

    it('should allow updating just billing_address', () => {
      const input: UpdateCustomerInput = {
        billing_address: {
          street: 'New Street',
          city: 'New City',
          state: 'CA',
          zip: '90210'
        }
      };
      expect(input.billing_address).toBeDefined();
    });
  });
});
```

#### 2. Type Compatibility Tests
```typescript
describe('Type Compatibility', () => {
  it('should be compatible with API response', () => {
    const apiResponse = {
      id: 'uuid-1',
      tenant_id: 'tenant-uuid',
      customer_number: 'CUST-123',
      name: 'ACME Corp',
      email: 'test@acme.com',
      phone: null,
      mobile_phone: null,
      billing_address: {
        street: '123 Main',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      },
      service_address: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };

    const customer: Customer = apiResponse;
    expect(customer).toBeDefined();
  });

  it('should be compatible with database row', () => {
    // Simulate Supabase response
    const dbRow = {
      id: 'uuid-1',
      tenant_id: 'tenant-uuid',
      customer_number: 'CUST-123',
      name: 'ACME Corp',
      email: 'test@acme.com',
      phone: null,
      mobile_phone: null,
      billing_address: {
        street: '123 Main',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      },
      service_address: null,
      notes: null,
      tags: [],
      voice_notes: null,
      is_active: true,
      metadata: {},
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      created_by: null,
      version: 1,
      intake_session_id: null
    };

    // Should be able to extract Customer fields
    const customer: Customer = {
      id: dbRow.id,
      tenant_id: dbRow.tenant_id,
      customer_number: dbRow.customer_number,
      name: dbRow.name,
      email: dbRow.email,
      phone: dbRow.phone,
      mobile_phone: dbRow.mobile_phone,
      billing_address: dbRow.billing_address,
      service_address: dbRow.service_address,
      created_at: dbRow.created_at,
      updated_at: dbRow.updated_at
    };
    expect(customer).toBeDefined();
  });
});
```

---

## Mocks/Fixtures Required

### Mock Data
```typescript
// /src/domains/customer/types/__tests__/fixtures/customer.fixtures.ts

export const mockAddress: Address = {
  street: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  zip: '62701'
};

export const mockCustomer: Customer = {
  id: 'cust-uuid-1',
  tenant_id: 'tenant-uuid-1',
  customer_number: 'CUST-1729012345678',
  name: 'ACME Landscaping Corp',
  email: 'contact@acmelandscaping.com',
  phone: '(555) 123-4567',
  mobile_phone: '(555) 987-6543',
  billing_address: {
    street: '123 Business Blvd',
    city: 'Springfield',
    state: 'IL',
    zip: '62701'
  },
  service_address: {
    street: '456 Oak Avenue',
    city: 'Springfield',
    state: 'IL',
    zip: '62702'
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

export const mockCreateCustomerInput: CreateCustomerInput = {
  name: 'ACME Landscaping Corp',
  email: 'contact@acmelandscaping.com',
  phone: '(555) 123-4567',
  mobile_phone: '(555) 987-6543',
  billing_address: mockAddress,
  service_address: {
    street: '456 Oak Avenue',
    city: 'Springfield',
    state: 'IL',
    zip: '62702'
  }
};

export const mockUpdateCustomerInput: UpdateCustomerInput = {
  name: 'Updated ACME Corp'
};
```

---

## Database State Requirements

**From T002-T006 Completion**:
- ✅ customers table exists (19 columns)
- ✅ RLS policy `customers_tenant_isolation` active (Constitution §1 compliant)
- ✅ Unique constraint on `(tenant_id, customer_number)`
- ✅ Indexes: customers_pkey, customers_tenant_id_customer_number_key, idx_customers_tenant_id, idx_customers_name

**Demo Data Available**:
- Query: `GET /rest/v1/customers?limit=1` (should return existing customers)
- Can use existing data for reference

---

## Implementation Sequence

### Step 1: Create Test File (TDD)
**File**: `/src/domains/customer/types/__tests__/customer.test.ts`
- Write failing tests first
- Run `npm test` to see failures

### Step 2: Create Types File
**File**: `/src/domains/customer/types/customer.ts`
- Implement Address interface
- Implement Customer interface
- Implement CreateCustomerInput interface
- Implement UpdateCustomerInput interface

### Step 3: Run Tests
```bash
npm test src/domains/customer/types/__tests__/customer.test.ts
```
- All tests should pass
- No TypeScript errors

### Step 4: Create Fixtures
**File**: `/src/domains/customer/types/__tests__/fixtures/customer.fixtures.ts`
- Export mock data for use in T008+ tests

---

## Parallel Tasks Notes (from tasks.md)

**T007 is marked [P]** - Can run in parallel with:
- T003-T006: RLS verification (already complete)
- T015: Property types (after T002)
- T028: Job checklist item types (after T002)

**Recommendation**: Start T007 alone to establish customer domain pattern, then other type definitions can follow the same structure.

---

## Migration/Policy Ramifications

### From T003-T006 RLS Fixes
**Impact on T007**: ✅ POSITIVE
- customers table now has Constitution-compliant RLS
- Multi-tenant support restored (no hardcoded tenant ID)
- Performance optimized (no extra tenant_assignments query)
- All customer queries will automatically filter by JWT app_metadata tenant_id

**No Additional Migration Needed**: customers table already has correct schema

### From T002 Schema Verification
**Impact on T007**: ✅ NEUTRAL
- Schema confirmed to match planning docs (with 19 columns vs expected 18)
- Extra column: `intake_session_id` (nullable UUID) - can be ignored for now
- All required fields present for Customer interface

---

## Constitution Compliance Checklist

- ✅ **§5 Repository Pattern**: Types defined in `/src/domains/customer/types/` (correct location)
- ✅ **§8.1 ACTUAL DB PRECHECK**: Schema verified via T002 (19 columns confirmed)
- ✅ **Voice-First Architecture**: JSONB fields preserved (billing_address, service_address)
- ✅ **TypeScript Best Practices**: Use interfaces (not classes), export all types

---

## Risk Assessment

### Low Risk
- ✅ Clear schema definition from T002
- ✅ API contract already defined
- ✅ Similar patterns exist in codebase (property types likely exist)

### Medium Risk
- ⚠️ Address JSONB structure must match both billing_address AND service_address
- ⚠️ CreateCustomerInput must align with T009 adapter expectations

### Mitigation
- Write comprehensive type tests (Step 1)
- Reference existing Address types from property domain (if they exist)
- Cross-check with API contract in `contracts/customers-api.json`

---

## Success Criteria

**T007 is complete when**:
1. ✅ File `/src/domains/customer/types/customer.ts` exists
2. ✅ All interfaces defined (Customer, Address, CreateCustomerInput, UpdateCustomerInput)
3. ✅ Tests pass: `npm test src/domains/customer/types/__tests__/customer.test.ts`
4. ✅ No TypeScript errors in types file
5. ✅ Fixtures file created for use in T008+

**Ready to proceed to**: T008 (Customer Repository)

---

**Status**: PREP COMPLETE ✅
**Next Action**: Begin TDD implementation - write failing tests first
