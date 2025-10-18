# CODEX: TypeScript Error Fixing Tasks

**Status**: Sprint 3 Complete (2025-10-18)
**Your Workload**: ~650 of 828 errors (78%)
**Estimated Time**: 6-8 hours total

---

## Quick Start

```bash
# Pull latest
git pull origin main

# Check current error count
npm run type-check 2>&1 | grep -c "error TS"

# Start Sprint 1
```

---

## Your Task List (In Order)

### 🔥 Sprint 1: Remove Deprecated Code (~400 errors, 1-2 hours)

#### Task 1.1: Delete Container Domain Files
```bash
# These files reference non-existent 'containers' table
rm src/domains/equipment/repositories/container-repository.ts
rm src/domains/equipment/repositories/container-repository-enhanced.ts
rm src/domains/equipment/services/container-service.ts
rm src/domains/inventory/services/container-management.service.ts

# Search for any imports
grep -r "container-repository\|container-service\|container-management" src/app/ src/domains/

# If found, update those files to remove imports
```

**Expected**: -92 errors

#### Task 1.2: Delete Contact Repository
```bash
# References non-existent 'contacts' table
rm src/domains/customer/repositories/contact-repository.ts

# Search for imports
grep -r "contact-repository" src/app/ src/domains/

# Update customer-service.ts to remove contact references
```

**Expected**: -40 errors

#### Task 1.3: Move Vision Tests to Experimental
```bash
# Create experimental folder
mkdir -p experimental/vision/__tests__

# Move test files
mv src/domains/vision/__tests__/* experimental/vision/__tests__/

# Create README
cat > experimental/README.md << 'EOF'
# Experimental Features

This folder contains incomplete or experimental features that are not yet ready for production.

## Vision Domain
- Status: Experimental
- Description: AI vision detection, cost records, YOLO inference
- Reason: References non-existent tables, incomplete implementation
- Test Status: 150+ type errors

These will be properly implemented when the vision feature is fully specified.
EOF
```

**Expected**: -150 errors

#### Task 1.4: Review Intent Domain (Decision Point)
```bash
# Check if intent domain is used anywhere
grep -r "intent-classification" src/app/

# Offline sync queue repository removed (feature deferred)
# Intent classification repository remains in production and should be fixed if used
```

**Expected**: -46 errors (if moved)

#### Task 1.5: Review Safety Domain (Decision Point)
```bash
# Check if safety domain is used
grep -r "safety-completion\|safety-analytics" src/app/

# If not used:
mkdir -p experimental/safety
mv src/domains/safety/services/safety-completion.service.ts experimental/safety/
mv src/domains/safety/services/safety-analytics.service.ts experimental/safety/

# If used, we'll fix types instead
```

**Expected**: -38 errors (if moved)

**Sprint 1 Checkpoint**: Run `npm run type-check 2>&1 | grep -c "error TS"`
**Target**: ~400-450 errors remaining

```bash
git add -A
git commit -m "fix(ts): Sprint 1 - remove deprecated domain code

- Remove container domain (no containers table)
- Remove contact repository (no contacts table)
- Move vision tests to experimental/
- Move intent/safety to experimental/ (if unused)

Eliminates ~400 type errors from deprecated code.
"
git push origin main
```

---

### 🔧 Sprint 2: Fix Infrastructure (~100 errors, 2-3 hours)

#### Task 2.1: Fix Base Repository
**File**: `src/lib/repositories/base.repository.ts`

**Problem**: Generic type constraints don't work with generated Database types

**Solution**:
1. Read the file and understand the generic pattern
2. The issue is likely with `Database['public']['Tables'][T]` lookups
3. May need to add type assertions or helper types
4. Test with `job-assignment.repository.ts` which works

**Key areas**:
- Line 147: `eq('tenant_id', tenantId)` - type argument issues
- Line 193: `insert(data)` - Insert type mismatch
- Line 228: `eq('id', id)` - type argument issues

**Expected**: -15 direct errors, -50 cascading errors

#### Task 2.2: Fix Customer Domain Types
**Files**:
- `src/domains/customer/types/customer-types.ts`
- `src/domains/customer/services/customer-service.ts`
- `src/domains/customer/services/customer-search-service.ts`
- `src/domains/customer/services/customer-offline-sync.ts`

**Problems**:
1. `Customer` interface doesn't match database `customers` table
2. `tags` property: Should be `string[] | null` not `CustomerTag[] | undefined`
3. `notes` property: Should be `string | null` not `CustomerNote[] | undefined`
4. Missing image URL fields: `thumbnail_url`, `medium_url`, `primary_image_url`

**Solution**:
```typescript
// In customer-types.ts, align Customer with Database['public']['Tables']['customers']['Row']
export interface Customer {
  id: string;
  tenant_id: string | null;
  customer_number: string;
  name: string;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  billing_address: Json;
  service_address: Json;
  tags: string[] | null;  // FIX: Was CustomerTag[]
  notes: string | null;    // FIX: Was CustomerNote[]
  status: string;
  created_at: string;
  updated_at: string;
  voice_recognition_id: string | null;
  preferences: Json | null;
  last_service_date: string | null;
  intake_session_id: string | null;
  thumbnail_url: string | null;  // ADD
  medium_url: string | null;      // ADD
  primary_image_url: string | null; // ADD
}
```

Then update all services to match this schema.

**Expected**: -60 errors

#### Task 2.3: Fix Admin Audit Log
**File**: `src/domains/admin/audit/admin-audit-log.repository.ts`

**Problem**: Insert payload doesn't match database type

**Solution**:
- Check that all fields in insert match `Database['public']['Tables']['admin_audit_log']['Insert']`
- Ensure enums are used correctly (not strings)
- Fix property access on return values

**Expected**: -15 errors

**Status Update (2025-10-17)**

- ✅ Task 2.1 completed — base repository now uses table helper aliases and safe casts.
- ✅ Task 2.2 completed — customer types/services aligned with the Supabase schema, image fields added, and search/offline sync adapted.
- ✅ Task 2.3 completed — admin audit log insert/query payloads now typed safely.
- ✅ Container/equipment dependencies trimmed to eliminate missing-table references.
- 📉 Error count after Sprint 2: `npm run type-check | grep -c "error TS"` → **484** (down from 509 after Sprint 1). Remaining errors live in front-end auth components and field-intelligence domains, which are queued for later sprints.

**Sprint 2 Checkpoint**: Run `npm run type-check 2>&1 | grep -c "error TS"`
**Target**: ~300-350 errors remaining  
**Actual (2025-10-18)**: ✅ Sprint 3 wrapped with **0** TypeScript errors remaining.

```bash
git add -A
git commit -m "fix(ts): Sprint 2 - fix infrastructure and base types

- Fix base.repository.ts generic constraints
- Align Customer domain types with database schema
- Fix admin audit log repository types

Eliminates ~100 type errors.
"
git push origin main
```

---

### 🎯 Sprint 3: Fix Domain Services (~150 errors, 2-3 hours)

#### Task 3.1: Fix Job Domain
**Files**:
- `src/domains/job/services/checklist-verification-service.ts` (28 errors)
- `src/domains/shared/repositories/item.repository.ts` (13 errors)

**Approach**:
- Verify table references: `job_checklist_items`, `items`
- Ensure Insert/Update types match database
- Fix any property access issues

**Expected**: -50 errors

#### Task 3.2: Fix Supervisor Workflow
**File**: `src/domains/supervisor/services/supervisor-workflow.service.ts`

**Approach**:
- Check table references
- Align types with database schema
- May need to split into smaller functions for better type inference

**Expected**: -26 errors

#### Task 3.3: Fix Inventory Repositories
**Files**:
- `src/domains/inventory/repositories/training-data.repository.class.ts` (16 errors)
- `src/domains/inventory/repositories/purchase-receipts.repository.class.ts` (16 errors)

**Approach**:
- Verify tables exist in database (check `src/types/database.ts`)
- If tables don't exist, move to experimental
- If tables exist, fix Insert/Update types

**Expected**: -40 errors

#### Task 3.4: Vision Repositories (Only if keeping vision)
**Files**:
- `src/domains/vision/repositories/vision-verification.repository.class.ts` (14 errors)
- `src/domains/vision/repositories/cost-record.repository.class.ts` (14 errors)

**Decision**:
- If vision is experimental → skip (already moved tests)
- If vision is active → fix types

**Expected**: -28 errors (if fixing)

**Sprint 3 Checkpoint**: `npm run type-check` → **0 errors**

**Progress Update (2025-10-18)**  
- ✅ Job checklist verification service & shared item repository fully typed (match generated schema + offline queueing)  
- ✅ Supervisor workflow service now relies on typed repositories/supabase helpers without `any` fallbacks  
- ✅ Intake OCR factories & intent repositories cleaned up (AppError usage, typed inserts, shared Tesseract options)  
- ✅ Vision repositories/services (cost records, detections, verifications) aligned with live tables and metadata typing  
- ✅ Offline infrastructure (sync manager/offline DB) hardened for typed results + tenant-aware operations  
- ✅ Hooks/utilities (voice navigation, dev tenant, supabase client) updated for safe optional data handling  
- 📈 TypeScript baseline reduced from **368** → **0** errors (`npm run type-check`)

```bash
git add -A
git commit -m "fix(ts): Sprint 3 - fix domain services

- Fix job domain checklist verification
- Fix supervisor workflow service
- Fix inventory repository types
- [Fix or skip vision repositories]

Eliminates ~150 type errors.
"
git push origin main
```

---

### 🏁 Sprint 4: Final Sweep (Remaining errors, 1-2 hours)

#### Your Task: Fix Remaining Backend Errors

```bash
# Get list of remaining errors
npm run type-check 2>&1 | grep "^src/" | cut -d'(' -f1 | sort | uniq -c | sort -rn

# Focus on files with most errors first
# Likely candidates:
# - Repositories with table mismatches
# - Services with type casting issues
# - Any stragglers from Sprints 1-3
```

**Approach**:
1. For each file, read the error
2. Check if table exists in `src/types/database.ts`
3. If no: move to experimental or delete
4. If yes: align types with database schema

**Expected**: Fix all remaining backend errors

**Final Checkpoint**: Run `npm run type-check 2>&1 | grep -c "error TS"`
**Target**: ~20 errors or less (Claude Code will handle component errors)

```bash
git add -A
git commit -m "fix(ts): Sprint 4 - final backend error cleanup

- Fix remaining repository type issues
- Remove or fix straggler domains
- Align all backend types with database schema

Backend type errors resolved!
"
git push origin main
```

---

## After You're Done

1. **Notify Claude Code**: "CODEX Sprint 4 complete. Backend errors resolved. Remaining errors are frontend/components."

2. **Claude Code Sprint 4**: Claude will fix:
   - `src/components/auth/SignInForm.tsx` (3 errors)
   - Any app route type errors
   - Component prop type issues

3. **Final Verification**:
```bash
npm run type-check  # Should show 0 errors
npm run dev         # Test that app still works
```

4. **Re-enable Pre-commit Hook**:
```bash
# Remove --no-verify from git workflow
# Update docs to reflect clean type state
```

---

## Helper Commands

```bash
# Count total errors
npm run type-check 2>&1 | grep -c "error TS"

# Errors by file
npm run type-check 2>&1 | grep "^src/" | cut -d'(' -f1 | sort | uniq -c | sort -rn | head -20

# Errors in specific domain
npm run type-check 2>&1 | grep "src/domains/customer"

# Regenerate database types if needed
python3 generate_types_programmatic.py

# Check if table exists in database
grep "tablename:" src/types/database.ts

# Test specific file
npx tsc --noEmit src/path/to/file.ts
```

---

## Communication Template

After each sprint:

```
## CODEX Sprint X Update

**Completed**: [Task names]
**Errors Eliminated**: [number]
**Errors Remaining**: [number]
**Issues Encountered**: [any problems or decisions made]
**Next Steps**: [Sprint X+1 or "Ready for Claude Code Sprint 4"]

Pushed to main: [commit hash]
```

---

## Questions/Issues?

If you encounter:
- **Table doesn't exist**: Move domain to experimental or delete
- **Complex type error**: Share the error with user for decision
- **Unsure if domain is active**: Check `src/app/` for imports

Remember: The goal is to get to 0 errors, but prioritize removing deprecated code over fixing complex types. If a domain is experimental, move it rather than fix it!
