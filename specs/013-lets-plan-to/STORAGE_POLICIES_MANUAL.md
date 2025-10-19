# Storage RLS Policies - Manual Application Required

**Date**: 2025-10-19
**Migration File**: supabase/migrations/20251019000001_storage_rls_policies_for_images.sql

## Status

⚠️ **Manual Application Required**: Due to permission restrictions with programmatic policy creation on `storage.objects`, these policies must be applied via the Supabase Dashboard SQL Editor.

## Instructions

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: SQL Editor
3. Copy and paste the contents of `/supabase/migrations/20251019000001_storage_rls_policies_for_images.sql`
4. Execute the SQL

## Expected Policies

**task-template-images bucket** (4 policies):
- ✅ Users can upload template images in their tenant
- ✅ Public can view template images  
- ✅ Users can update template images in their tenant
- ✅ Users can delete template images in their tenant

**task-images bucket** (4 policies):
- ✅ Users can upload task images in their tenant
- ✅ Public can view task images
- ✅ Users can update task images in their tenant
- ✅ Users can delete task images in their tenant

## Verification

After applying via dashboard, verify policies exist:

```sql
SELECT policyname, cmd, roles
FROM pg_policies  
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%template images%' 
  OR policyname LIKE '%task images%';
```

Expected: 8 rows returned

## Next Steps

Once policies are applied:
- ✅ T001 Complete (Database migration)
- ✅ T002 Complete (Storage buckets)
- ⚠️  T003 Complete (Policies documented, manual application required)
- 🔄 T004-T006 (CODEX in progress)
- ⏭️  T007-T008 (Next for Claude Code)
