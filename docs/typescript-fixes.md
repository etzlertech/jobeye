# TypeScript Error Fix Plan

## Current Status
- 1,197 TypeScript errors after async client fixes
- Main categories of errors:
  1. Database type inference issues (`never` types)
  2. Missing imports (ContactRoleDb, etc.)
  3. Mocked Supabase client in tests
  4. Property access on async functions

## Priority Fixes

### 1. Database Insert/Update Types (783 errors)
**Pattern**: `No overload matches this call` with `parameter of type 'never'`
**Cause**: Supabase types not properly inferred
**Fix**: 
- Ensure `Database` type is properly imported
- Check table names match exactly
- Verify Insert/Update types are generated

### 2. Missing Type Imports (127 errors)
**Pattern**: `Module has no exported member`
**Examples**: ContactRoleDb, PropertyType
**Fix**: Add missing exports to types file

### 3. Test Mocking Issues (100+ errors)
**Pattern**: `Property 'select' does not exist on type 'Mocked<SupabaseClient>`
**Fix**: Update test mocks to match Supabase client interface

### 4. Async Client Access (45 errors)
**Pattern**: `.auth does not exist on type Promise<SupabaseClient>`
**Fix**: Add await before createClient calls

## Implementation Steps

1. **Fix Database Types**
   ```typescript
   // Ensure proper type import
   import type { Database } from '@/types/database';
   
   // Use typed client
   const supabase = await createClient<Database>();
   ```

2. **Add Missing Exports**
   ```typescript
   // In types.ts, ensure all enums are exported
   export type { ContactRoleDb, PropertyType, etc. }
   ```

3. **Update Test Mocks**
   ```typescript
   // Create proper mock factory
   const mockSupabaseClient = {
     from: jest.fn().mockReturnThis(),
     select: jest.fn().mockReturnThis(),
     insert: jest.fn().mockReturnThis(),
     // ... etc
   };
   ```

4. **Batch Fix Common Patterns**
   - Search/replace for common patterns
   - Use TypeScript's quick fix suggestions
   - Focus on one error type at a time

## Validation
After each fix category:
1. Run `npm run type-check`
2. Verify error count decreased
3. Test affected functionality
4. Commit working fixes