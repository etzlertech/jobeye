# Claude Code: TypeScript Error Fixing Tasks

**Status**: Waiting for CODEX Sprint 1-3
**Your Workload**: ~20 of 828 errors (2%)
**Estimated Time**: 1 hour total

---

## Quick Start

```bash
# Wait for CODEX to complete Sprint 1-3
# They will notify you when ready
# Then pull their changes:
git pull origin main

# Check remaining error count
npm run type-check 2>&1 | grep -c "error TS"

# Should be ~20 errors or less
```

---

## Your Task List (After CODEX Completes Sprint 1-3)

### 🎨 Sprint 4: Fix Frontend/Components (~20 errors, 1 hour)

#### Task 4.1: Fix SignInForm Authentication
**File**: `src/components/auth/SignInForm.tsx` (3 errors)

**Current Status**: Partially fixed, but Supabase client types still causing issues

**Problems**:
1. Line 72: `insert()` overload doesn't match
2. Line 90: `onboarding_completed` property doesn't exist on type 'never'
3. Line 107: `insert()` overload doesn't match

**Solution Approach**:
```typescript
// The issue is Supabase client type inference
// Try explicit typing:

type AuthAuditLogInsert = Database['public']['Tables']['auth_audit_log']['Insert'];

const auditLog: AuthAuditLogInsert = {
  event_type: 'login_success',
  user_id: data.user.id,
  user_email: data.user.email,
  // ... rest of fields
};

await supabase.from('auth_audit_log').insert(auditLog);
```

For the voice profile query, use type assertion:
```typescript
const { data: voiceProfile } = await supabase
  .from('voice_profiles')
  .select('onboarding_completed')
  .eq('user_id', data.user.id)
  .maybeSingle();

// Type assertion if needed
const hasCompletedOnboarding = (voiceProfile as any)?.onboarding_completed ?? true;
```

**Expected**: -3 errors

#### Task 4.2: Fix App Route Type Errors (~10 errors)
**Check these directories**:
- `src/app/(authenticated)/supervisor/`
- `src/app/(authenticated)/crew/`
- `src/app/api/`

**Common Issues**:
- Missing `Suspense` boundaries
- Async component types
- Route params not typed correctly

**Approach**:
```bash
# List app route errors
npm run type-check 2>&1 | grep "src/app/"

# Fix each one:
# 1. Read the file
# 2. Check the specific error
# 3. Add missing types or fix async/await issues
```

**Expected**: -10 errors

#### Task 4.3: Fix Component Prop Types (~7 errors)
**Check these components**:
- Navigation components
- Form components
- Any components with prop type issues

**Common Fixes**:
```typescript
// Explicit prop types
interface MyComponentProps {
  userId: string;
  onSuccess?: () => void;
  isLoading: boolean;
}

export function MyComponent({ userId, onSuccess, isLoading }: MyComponentProps) {
  // ...
}

// Event handler types
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  // ...
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  // ...
};
```

**Expected**: -7 errors

---

## After You're Done

### Final Verification

```bash
# Should be 0 errors!
npm run type-check

# Test the app
npm run dev

# Check critical paths:
# 1. Sign in at /sign-in
# 2. Navigate to /supervisor/users
# 3. Open a user profile
# 4. Upload a photo
# 5. Go to /supervisor/jobs
# 6. Assign crew to a job
# 7. Verify avatars appear
```

### Re-enable Pre-commit Hook

Once all errors are fixed:

1. Update `.git/hooks/pre-commit` (if needed)
2. Test the hook:
```bash
# Make a small change
echo "// test" >> src/test-file.ts

# Commit without --no-verify
git add src/test-file.ts
git commit -m "test: verify pre-commit hook works"

# Should run type-check and pass!

# Clean up
git reset HEAD~1
rm src/test-file.ts
```

3. Update documentation:
```markdown
# Remove all mentions of --no-verify from:
- CLAUDE.md
- Any workflow docs
- Commit examples

# Add note: "Pre-commit hook re-enabled [date]"
```

---

## Communication Template

After Sprint 4:

```
## Claude Code Sprint 4 Complete 🎉

**Completed**:
- Fixed SignInForm authentication types
- Fixed app route type errors
- Fixed component prop types

**Final Error Count**: 0 ✅

**Testing Results**:
- ✅ Sign in works
- ✅ User management works
- ✅ Job assignment works
- ✅ All critical paths verified

**Pre-commit Hook**: Re-enabled ✅

TypeScript error cleanup complete! All 828 errors resolved.

Pushed to main: [commit hash]
```

---

## If You Need to Start Before CODEX

If you want to work in parallel (not recommended but possible):

### Option 1: Fix Your Errors First (Low Risk)
```bash
# Your errors are isolated to components/app routes
# Fix SignInForm and app routes
# Unlikely to conflict with CODEX's work
```

### Option 2: Help with Deprecation (Higher Risk)
```bash
# You could help with Sprint 1 (removing deprecated code)
# But coordinate with CODEX to avoid merge conflicts
# Better to let them own the backend cleanup
```

---

## Helper Commands

```bash
# Count remaining errors (after CODEX)
npm run type-check 2>&1 | grep -c "error TS"

# List your errors only (components/app)
npm run type-check 2>&1 | grep -E "src/(components|app)/"

# Test specific component
npx tsc --noEmit src/components/path/to/Component.tsx

# Format files after fixing
npm run format

# Run linter
npm run lint
```

---

## Notes

- Your work is mostly isolated to UI layer
- Low risk of breaking backend
- Most errors (~808) are in CODEX's domain (backend/infrastructure)
- Your ~20 errors are the "final polish" after CODEX's heavy lifting
- You'll likely finish in ~1 hour once CODEX is done

---

## Questions/Issues?

If you encounter:
- **Can't fix Supabase type inference**: Add type assertions (`as any` sparingly)
- **Component errors persist**: Check if prop types align with parent component expectations
- **App route async issues**: Ensure `async` functions have proper `Promise` return types
- **Still have errors after fixes**: Share specific error for user/CODEX input

Remember: Your goal is the "last mile" - making sure UI components and app routes are type-safe after CODEX fixes all the backend infrastructure!
