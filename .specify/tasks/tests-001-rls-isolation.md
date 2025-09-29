# Task: RLS Isolation Test Suite

**Slug:** `tests-001-rls-isolation`
**Priority:** High
**Size:** 1 PR

## Description
Create comprehensive test suite verifying Row Level Security isolation across all tables.

## Files to Create
- `src/__tests__/rls/test-helpers.ts`
- `src/__tests__/rls/containers.rls.test.ts`
- `src/__tests__/rls/jobs.rls.test.ts`
- `src/__tests__/rls/customers.rls.test.ts`
- `src/__tests__/rls/run-all-rls-tests.ts`

## Files to Modify
- None (new test suite)

## Acceptance Criteria
- [ ] Tests every table with RLS enabled
- [ ] Verifies cross-tenant read denial
- [ ] Verifies cross-tenant write denial
- [ ] Tests policy bypass prevention
- [ ] Includes admin override tests
- [ ] Generates RLS coverage report

## Test Files
**Core test pattern for each table:**

Test cases per table:
- `prevents cross-tenant reads`
  - Create record as Company A
  - Attempt read as Company B
  - Assert empty result set
  
- `prevents cross-tenant writes`
  - Attempt insert for Company B as Company A
  - Assert permission denied error
  
- `allows same-tenant operations`
  - CRUD operations as Company A
  - Assert all operations succeed
  
- `prevents policy bypass attempts`
  - Try raw SQL without company filter
  - Assert RLS still enforced
  
- `allows admin bypass with audit`
  - Use admin role
  - Bypass RLS with reason
  - Assert audit log created

## Dependencies
- Existing: All repository files

## Test Helper Utilities
```typescript
// src/__tests__/rls/test-helpers.ts
export const RLSTestHelpers = {
  // Create test companies
  async createTestCompanies(): Promise<TestCompanies> {
    const companyA = await createCompany('Company A');
    const companyB = await createCompany('Company B');
    return { companyA, companyB };
  },
  
  // Create test users with company assignment
  async createTestUsers(companies: TestCompanies): Promise<TestUsers> {
    const userA = await createUser({ company_id: companies.companyA.id });
    const userB = await createUser({ company_id: companies.companyB.id });
    const admin = await createUser({ role: 'admin' });
    return { userA, userB, admin };
  },
  
  // Switch auth context
  async switchUser(user: TestUser): Promise<void> {
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });
  },
  
  // Assert RLS violation
  expectRLSViolation: (error: any) => {
    expect(error.code).toBe('42501'); // Insufficient privilege
    expect(error.message).toContain('row-level security');
  }
};
```

## Test Organization
```typescript
// src/__tests__/rls/run-all-rls-tests.ts
const RLS_TEST_TABLES = [
  'companies',
  'users',
  'customers', 
  'properties',
  'jobs',
  'containers',
  'inventory_images',
  'job_checklist_items',
  'load_verifications',
  'voice_transcripts',
  'ai_cost_records'
];

describe('RLS Comprehensive Test Suite', () => {
  RLS_TEST_TABLES.forEach(table => {
    it(`enforces RLS on ${table} table`, async () => {
      const results = await import(`./${table}.rls.test`);
      expect(results.allTestsPassed).toBe(true);
    });
  });
  
  it('generates coverage report', async () => {
    const coverage = await generateRLSCoverageReport();
    expect(coverage.percentCovered).toBeGreaterThan(95);
    await fs.writeFile('rls-coverage.json', JSON.stringify(coverage));
  });
});
```

## Coverage Report Format
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "totalTables": 25,
  "tablesWithRLS": 24,
  "tablesMissingRLS": ["migrations"],
  "testCoverage": {
    "read": { "tested": 24, "passed": 24 },
    "write": { "tested": 24, "passed": 24 },
    "update": { "tested": 24, "passed": 24 },
    "delete": { "tested": 24, "passed": 24 }
  },
  "percentCovered": 96.0
}
```