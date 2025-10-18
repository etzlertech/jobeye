# TypeScript Error Analysis - JobEye

**Date**: 2025-10-18
**Total Errors**: 828
**Status**: Analysis Complete

## Executive Summary

The codebase has 828 TypeScript errors primarily caused by:
1. **Missing database tables** - Code references tables that don't exist (`contacts`, `containers`)
2. **Outdated/deprecated domains** - Several domains (vision, customer, equipment) reference non-existent schema
3. **Test files** - Many errors in test files referencing deprecated code
4. **Type mismatches** - Domain types don't match generated database types

## Error Distribution by File (Top 20)

| Errors | File | Category |
|--------|------|----------|
| 43 | src/domains/vision/__tests__/scenarios/voice-narration.scenario.test.ts | Test - Vision |
| 41 | src/domains/vision/__tests__/unit/detected-item.repository.test.ts | Test - Vision |
| 40 | src/domains/vision/__tests__/unit/cost-record.repository.test.ts | Test - Vision |
| 32 | src/domains/inventory/services/container-management.service.ts | Service - Inventory |
| 31 | ~~src/domains/intent/repositories/offline-sync-queue.repository.ts~~ | Repository - Intent *(removed; feature postponed)* |
| 28 | src/domains/job/services/checklist-verification-service.ts | Service - Job |
| 26 | src/domains/supervisor/services/supervisor-workflow.service.ts | Service - Supervisor |
| 24 | src/domains/vision/__tests__/unit/batch-verification.service.test.ts | Test - Vision |
| 24 | src/domains/safety/services/safety-completion.service.ts | Service - Safety |
| 19 | src/domains/equipment/services/container-service.ts | Service - Equipment |
| 18 | src/domains/vision/lib/__tests__/vlm-router.test.ts | Test - Vision |
| 17 | src/domains/vision/lib/__tests__/yolo-inference.test.ts | Test - Vision |
| 16 | src/domains/inventory/repositories/training-data.repository.class.ts | Repository - Inventory |
| 16 | src/domains/inventory/repositories/purchase-receipts.repository.class.ts | Repository - Inventory |
| 15 | src/lib/repositories/base.repository.ts | Core - Base Repository |
| 15 | src/domains/intent/repositories/intent-classification.repository.ts | Repository - Intent |
| 14 | src/domains/vision/repositories/vision-verification.repository.class.ts | Repository - Vision |
| 14 | src/domains/vision/repositories/cost-record.repository.class.ts | Repository - Vision |
| 14 | src/domains/safety/services/safety-analytics.service.ts | Service - Safety |
| 13 | src/domains/shared/repositories/item.repository.ts | Repository - Shared |

> Update 2025-10-17: Inventory training-data and purchase-receipts repositories were removed from production (tables absent in Supabase); remaining counts reflect current sources.

## Error Categories

### 1. Missing Tables (Highest Impact)
**Tables referenced but not in database**:
- `contacts` - Referenced by customer domain
- `containers` - Referenced by equipment/inventory domains

**Action**: These domains need to be:
- Option A: Remove entirely (if deprecated)
- Option B: Create migration to add tables (if still needed)
- Option C: Update code to use different tables

### 2. Customer Domain Issues
**Files affected**: 12+ files
**Primary issues**:
- Missing `ContactRoleDb` export
- `Customer` type doesn't match database schema
- Properties: `tags`, `notes`, `contacts`, `addresses` mismatch
- `thumbnail_url`, `medium_url`, `primary_image_url` missing from queries

**Status**: Customer domain appears to be legacy/incomplete implementation

### 3. Vision Domain Issues
**Files affected**: 15+ test files + repositories
**Primary issues**:
- Many test files reference non-existent tables
- Vision verification, cost records, detected items repositories all have type errors
- Tests may be outdated or for future features

**Status**: Vision domain appears to be incomplete or experimental

### 4. Base Repository Issues
**File**: `src/lib/repositories/base.repository.ts`
**Issues**: 15 errors related to generic type constraints
**Impact**: HIGH - This is used by all repositories

**Problem**: The base repository uses generic `T extends keyof Database['public']['Tables']` but the constraint doesn't work correctly with the generated types.

### 5. SignInForm Issues
**File**: `src/components/auth/SignInForm.tsx`
**Issues**:
- `auth_audit_log` table insert type mismatch
- `onboarding_completed` property missing

**Impact**: CRITICAL - This affects user authentication

## Recommendations

### Priority 1: Critical Path (User-Facing Features)
1. ✅ **Fix SignInForm.tsx** - Authentication is critical
2. **Fix job-assignment related errors** - Recent feature work
3. **Fix user management errors** - Recent feature work

### Priority 2: Deprecated Code Removal
1. **Remove customer contact/address code** - Not in use, references missing tables
2. **Remove/Fix container management** - References missing `containers` table
3. **Clean up vision test files** - Many reference non-existent features

### Priority 3: Infrastructure
1. **Fix base.repository.ts** - Impacts all repositories
2. **Update Customer domain types** - Align with actual schema
3. **Document which domains are active vs experimental**

### Priority 4: Tests
1. Fix vision domain tests (or remove if deprecated)
2. Fix inventory repository tests
3. Ensure all active features have passing tests

## Current Active Features (From Git History)

Based on recent work, these are the ACTIVE features that MUST work:
1. ✅ **User Management** - List, detail, edit, photo upload (just completed)
2. ✅ **Job Assignment** - Crew assignment to jobs (recently completed)
3. **Jobs** - Job creation, status, checklist
4. **Properties** - Property management
5. **Inventory** - Item tracking (partial - has errors)
6. **Authentication** - Sign in/out, session management

## Inactive/Experimental Domains

These appear to be incomplete or experimental:
1. **Vision** - AI vision detection, cost records (many test failures)
2. **Safety** - Safety analytics, completion tracking
3. **Intent** - Intent classification, offline sync
4. **Supervisor Workflow** - Advanced workflow features

## Next Steps

1. **Immediate**: Fix SignInForm.tsx authentication errors
2. **Short-term**: Clean up deprecated customer/container code
3. **Medium-term**: Fix base.repository.ts generic constraints
4. **Long-term**: Decide on vision/safety/intent domains - keep or remove

## Type Generation Notes

- ✅ Database types successfully regenerated from live database (68 tables, 28 enums)
- ✅ Types copied to both `database.ts` and `supabase.ts`
- ⚠️ Many domain files reference tables that don't exist in database
- ⚠️ Domain types (like `Customer`) don't match database schema

## Files That Can Be Safely Removed (Candidate List)

**High Confidence (Reference non-existent tables)**:
- `src/domains/customer/repositories/contact-repository.ts`
- `src/domains/customer/services/customer-offline-sync.ts` (if not used)
- `src/domains/equipment/repositories/container-repository.ts`
- `src/domains/equipment/repositories/container-repository-enhanced.ts`
- `src/domains/equipment/services/container-service.ts`
- `src/domains/inventory/services/container-management.service.ts`

**Medium Confidence (Experimental/Incomplete)**:
- Most files in `src/domains/vision/__tests__/`
- `src/domains/intent/repositories/*` (if not in active use)
- `src/domains/safety/*` (if not in active use)

**Verification Needed**:
- Check if any API routes or pages import these files
- Check git history for recent usage
- Confirm with user which features are active
