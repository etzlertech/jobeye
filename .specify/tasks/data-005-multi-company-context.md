# Task: Multi-Company Context Switching

**Slug:** `data-005-multi-company-context`
**Priority:** Low
**Size:** 1 PR

## Description
Implement explicit company context switching for users with access to multiple companies.

## Files to Create
- `src/domains/auth/services/company-context-service.ts`
- `src/domains/auth/hooks/use-company-context.ts`
- `src/components/shared/company-switcher.tsx`

## Files to Modify
- `src/lib/supabase/client.ts` - Add company context headers
- `src/components/layout/header.tsx` - Add company switcher

## Acceptance Criteria
- [ ] Tracks active company in session storage
- [ ] Shows current company in header
- [ ] Lists available companies in dropdown
- [ ] Updates all queries on switch
- [ ] Persists selection across sessions
- [ ] Clears cache on company change

## Test Files
**Create:** `src/__tests__/domains/auth/services/company-context-service.test.ts`

Test cases:
- `sets active company`
  - Set company A active
  - Assert stored in session
  - Assert headers updated
  
- `lists available companies`
  - User has access to 3 companies
  - Assert all 3 returned
  - Assert includes names
  
- `clears cache on switch`
  - Load data for company A
  - Switch to company B
  - Assert cache cleared
  - Assert new data loaded

**Create:** `src/__tests__/components/shared/company-switcher.test.tsx`

Test cases:
- `shows current company name`
- `displays dropdown on click`
- `switches company on selection`

## Dependencies
- Existing: User-company relationships

## Context Interface
```typescript
interface CompanyContext {
  activeCompany: {
    id: string;
    name: string;
    logo?: string;
  } | null;
  availableCompanies: Company[];
  isLoading: boolean;
  
  setActiveCompany: (companyId: string) => Promise<void>;
  refreshAvailableCompanies: () => Promise<void>;
}

interface CompanyContextState {
  activeCompanyId: string | null;
  lastSwitchedAt: number;
}
```

## Implementation Details
- Store active company ID in localStorage
- Include company_id in all Supabase headers
- Invalidate React Query cache on switch
- Show loading state during transition
- Redirect to dashboard after switch