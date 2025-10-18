# TypeScript Error Fix - Work Division Plan

**Date**: 2025-10-18
**Total Errors**: 828
**Strategy**: Divide and Conquer

## Work Division Strategy

### 🎨 Claude Code Responsibilities (UI/Frontend)
**Strengths**: Components, pages, user-facing features, testing UI flows

### 🔧 CODEX Responsibilities (Backend/Infrastructure)
**Strengths**: Domain logic, repositories, services, database types, architecture

---

## Phase 1: Remove Deprecated Code (Priority: CRITICAL)

### CODEX Tasks - Phase 1 (Estimated: -400 errors)

**Task 1.1: Remove Container Domain** (~92 errors)
- [ ] Delete `src/domains/equipment/repositories/container-repository.ts` (19 errors)
- [ ] Delete `src/domains/equipment/repositories/container-repository-enhanced.ts` (5 errors)
- [ ] Delete `src/domains/equipment/services/container-service.ts` (19 errors)
- [ ] Delete `src/domains/inventory/services/container-management.service.ts` (32 errors)
- [ ] Update any imports that reference these files
- [ ] Verify no API routes depend on container code

**Task 1.2: Remove Contact Repository** (~40 errors)
- [ ] Delete `src/domains/customer/repositories/contact-repository.ts` (24 errors)
- [ ] Update `src/domains/customer/services/customer-service.ts` to remove contact references
- [ ] Remove `ContactRoleDb` type export attempts

**Task 1.3: Clean Up Vision Domain Tests** (~150 errors)
- [ ] Delete or move to `/experimental/` folder:
  - `src/domains/vision/__tests__/scenarios/voice-narration.scenario.test.ts` (43 errors)
  - `src/domains/vision/__tests__/unit/detected-item.repository.test.ts` (41 errors)
  - `src/domains/vision/__tests__/unit/cost-record.repository.test.ts` (40 errors)
  - `src/domains/vision/__tests__/unit/batch-verification.service.test.ts` (24 errors)
  - `src/domains/vision/lib/__tests__/vlm-router.test.ts` (18 errors)
  - `src/domains/vision/lib/__tests__/yolo-inference.test.ts` (17 errors)
- [ ] Create `/experimental/` folder for incomplete features
- [ ] Add README explaining vision domain is experimental

**Task 1.4: Review and Remove/Fix Intent Domain** (~46 errors)
- [ ] `src/domains/intent/repositories/offline-sync-queue.repository.ts` (31 errors)
- [ ] `src/domains/intent/repositories/intent-classification.repository.ts` (15 errors)
- [ ] Decision: Keep or remove? If experimental, move to `/experimental/`

**Task 1.5: Review Safety Domain** (~38 errors)
- [ ] `src/domains/safety/services/safety-completion.service.ts` (24 errors)
- [ ] `src/domains/safety/services/safety-analytics.service.ts` (14 errors)
- [ ] Decision: Keep or remove? If experimental, move to `/experimental/`

**Expected Result**: ~400 errors eliminated

---

## Phase 2: Fix Infrastructure/Base Types (Priority: HIGH)

### CODEX Tasks - Phase 2 (Estimated: -100 errors)

**Task 2.1: Fix Base Repository** (~15 direct, ~50 cascading errors)
- [ ] `src/lib/repositories/base.repository.ts` (15 errors)
- [ ] Fix generic type constraints: `T extends keyof Database['public']['Tables']`
- [ ] Ensure `insert()`, `update()`, `findById()` methods have correct types
- [ ] Test with a simple repository (like `job-assignment.repository.ts`)

**Task 2.2: Fix Customer Domain Types** (~60 errors)
- [ ] Update `src/domains/customer/types/customer-types.ts`
  - Fix `Customer` interface to match database schema
  - Fix `tags` property: `CustomerTag[] | undefined` vs `string[] | null`
  - Fix `notes` property: `CustomerNote[] | undefined` vs `string | null`
  - Add missing image URL properties: `thumbnail_url`, `medium_url`, `primary_image_url`
- [ ] Update all customer services to use corrected types:
  - `customer-service.ts` (40 errors)
  - `customer-search-service.ts` (30 errors)
  - `customer-offline-sync.ts` (15 errors)

**Task 2.3: Fix Admin Audit Log Repository** (~15 errors)
- [ ] `src/domains/admin/audit/admin-audit-log.repository.ts` (15 errors)
- [ ] Ensure insert payload matches database Insert type
- [ ] Fix property access on return values (`.id`, `.tenant_id`, etc.)

**Expected Result**: ~100 errors eliminated

---

## Phase 3: Fix Domain Services (Priority: MEDIUM)

### CODEX Tasks - Phase 3 (Estimated: -150 errors)

**Task 3.1: Fix Job Domain** (~50 errors)
- [ ] `src/domains/job/services/checklist-verification-service.ts` (28 errors)
- [ ] `src/domains/shared/repositories/item.repository.ts` (13 errors)
- [ ] Align with job_checklist_items and items table schemas

**Task 3.2: Fix Supervisor Workflow** (~26 errors)
- [ ] `src/domains/supervisor/services/supervisor-workflow.service.ts` (26 errors)
- [ ] Verify table references and type usage

**Task 3.3: Fix Inventory Repositories** (~40 errors)
- [ ] `src/domains/inventory/repositories/training-data.repository.class.ts` (16 errors)
- [ ] `src/domains/inventory/repositories/purchase-receipts.repository.class.ts` (16 errors)
- [ ] Fix table references and Insert/Update types

**Task 3.4: Fix Vision Repositories** (~28 errors)
- [ ] `src/domains/vision/repositories/vision-verification.repository.class.ts` (14 errors)
- [ ] `src/domains/vision/repositories/cost-record.repository.class.ts` (14 errors)
- [ ] Only if vision domain is being kept (not moved to experimental)

**Expected Result**: ~150 errors eliminated

---

## Phase 4: Fix Remaining Scattered Errors (Priority: LOW)

### Claude Code Tasks - Phase 4 (Estimated: -20 errors)

**Task 4.1: Fix Authentication Components** (3 errors)
- [x] `src/components/auth/SignInForm.tsx` - Already attempted, needs CODEX help with Supabase client types

**Task 4.2: Review App Routes** (~10 errors)
- [ ] Check all `/src/app/` route files for type errors
- [ ] Likely minimal errors since recent features (jobs, users) were built with types

**Task 4.3: Component Type Safety** (~10 errors)
- [ ] Review any components with type errors
- [ ] Fix prop type definitions
- [ ] Ensure event handlers have correct types

### CODEX Tasks - Phase 4 (Remaining errors)

**Task 4.4: Sweep Remaining Errors**
- [ ] Run type check after Phase 1-3
- [ ] Address any remaining stragglers
- [ ] Focus on fixing rather than removing

---

## Execution Plan

### Sprint 1: Deprecated Code Removal (CODEX)
**Timeline**: 1-2 hours
**Goal**: Eliminate 400 errors by removing dead code

1. CODEX removes container domain (Task 1.1)
2. CODEX removes contact repository (Task 1.2)
3. CODEX moves vision tests to experimental (Task 1.3)
4. CODEX reviews intent/safety domains (Task 1.4-1.5)
5. **Checkpoint**: Run `npm run type-check` - expect ~428 errors remaining

### Sprint 2: Infrastructure Fixes (CODEX)
**Timeline**: 2-3 hours
**Goal**: Eliminate 100 errors by fixing base types

1. CODEX fixes base.repository.ts (Task 2.1)
2. CODEX fixes Customer domain types (Task 2.2)
3. CODEX fixes admin audit repository (Task 2.3)
4. **Checkpoint**: Run `npm run type-check` - expect ~328 errors remaining

### Sprint 3: Domain Services (CODEX)
**Timeline**: 2-3 hours
**Goal**: Eliminate 150 errors by fixing domain logic

1. CODEX fixes job domain services (Task 3.1)
2. CODEX fixes supervisor workflow (Task 3.2)
3. CODEX fixes inventory repositories (Task 3.3)
4. CODEX reviews vision repositories (Task 3.4)
5. **Checkpoint**: Run `npm run type-check` - expect ~178 errors remaining

### Sprint 4: Final Cleanup (Both)
**Timeline**: 1-2 hours
**Goal**: Eliminate remaining errors

1. Claude Code fixes app routes and components (Task 4.1-4.3)
2. CODEX sweeps remaining errors (Task 4.4)
3. **Final Check**: Run `npm run type-check` - expect 0 errors
4. **Victory**: Re-enable pre-commit hook! 🎉

---

## Communication Protocol

### Before Each Sprint
- CODEX or Claude Code announces: "Starting Sprint X - [Task Names]"
- Other session holds off on conflicting changes

### After Each Sprint
- Session commits work: `git commit -m "fix(ts): Sprint X - [description]"`
- Session pushes: `git push origin main`
- Session reports: "Sprint X complete: [errors eliminated] errors fixed, [checkpoint count] remaining"
- Other session pulls: `git pull origin main`

### If Conflicts Arise
- Session encountering conflict runs: `git pull --rebase origin main`
- Resolves conflicts by keeping CODEX changes for backend, Claude changes for frontend
- Continues work

---

## Task Assignment Summary

### CODEX Focus Areas (Backend/Infrastructure)
- ✅ Domain repositories and services
- ✅ Base infrastructure (base.repository.ts)
- ✅ Database type alignment
- ✅ Deprecated code removal
- ✅ Test cleanup (domain tests)
- **Total**: ~650 errors

### Claude Code Focus Areas (Frontend/UI)
- ✅ App routes (`/src/app/`)
- ✅ Components (`/src/components/`)
- ✅ UI-related type fixes
- ✅ Integration testing support
- **Total**: ~20 errors (most errors are backend!)

---

## Success Criteria

- [ ] All 828 TypeScript errors resolved
- [ ] `npm run type-check` passes with 0 errors
- [ ] Pre-commit hook re-enabled
- [ ] All active features still work (user management, job assignment)
- [ ] Code coverage maintained or improved
- [ ] No deprecated code left in codebase
- [ ] Clear `/experimental/` folder for incomplete features

---

## Risk Mitigation

### Risk 1: Breaking Active Features
**Mitigation**:
- Test after each sprint with `npm run dev`
- Verify critical paths: sign-in, user management, job assignment
- Keep git history clean for easy rollback

### Risk 2: Type Errors in Generated Types
**Mitigation**:
- If database types are wrong, regenerate with `python3 generate_types_programmatic.py`
- Verify table structures with Supabase MCP queries before assuming types are correct

### Risk 3: Merge Conflicts
**Mitigation**:
- Work in clear lanes (backend vs frontend)
- Pull frequently
- Communicate before starting major refactors

---

## Notes

- The bulk of errors (650+) are in CODEX's domain (backend/infrastructure)
- Claude Code has minimal errors (~20) mostly in authentication and components
- Phase 1 (deprecation) is the biggest win - removes ~50% of errors with minimal risk
- After Phase 1-2, remaining work becomes more surgical and less risky

---

## Quick Reference

**Check errors**: `npm run type-check 2>&1 | grep -c "error TS"`
**List errors by file**: `npm run type-check 2>&1 | grep "^src/" | cut -d'(' -f1 | sort | uniq -c | sort -rn`
**Regenerate types**: `python3 generate_types_programmatic.py`
**Test specific file**: `npx tsc --noEmit path/to/file.ts`
