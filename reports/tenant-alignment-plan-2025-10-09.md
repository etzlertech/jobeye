<!--
AGENT DIRECTIVE BLOCK
file: /reports/tenant-alignment-plan-2025-10-09.md
purpose: Action plan to restore tenancy alignment, testing health, and deployment readiness.
origin: Alignment analysis 2025-10-09
update_policy: Update after verifying each milestone or when scope changes.
-->

# Tenant Alignment Recovery Plan — 2025-10-09

## Current Snapshot
- **Live schema drift**: 13 tables still expose `company_id`, 18 use `tenant_id`, and `routing_schedules` carries both (`reports/live-tenancy-scan-2025-10-09.txt`).
- **Migrations out of date**: Scheduling migrations (`supabase/migrations/035_003_scheduling_kits.sql`, `037_scheduling_core_tables.sql`) still create `company_id` columns and JWT policies on `company_id`.
- **Types/code mismatch**: Generated Supabase types already expect `tenant_id`, so repositories/services compile against a schema that doesn’t exist.
- **Tooling/tests stale**: `scripts/check-actual-db.ts` and OCR preflight look for `company_id`; contract/E2E tests assert old column names.
- **Runtime drift**: Local dev still on Node 18/npm 9 while repo and Railway require Node 20+/npm 10.

## Goal
Restore single-source multi-tenant model, align migrations and generated types with the live schema, update tooling/tests, and ensure the build passes locally and on Railway.

## Workstreams & Tasks

### 1. Live Schema Alignment
- [ ] Backup Supabase project (snapshot notes in `reports/`).
- [x] Run `scripts/migrate-company-id-to-tenant-id.ts` (or per-table `exec_sql`) for:
  - `day_plans` (crew/schedule tables not yet present in live DB)
  - `notification_queue`, `quality_audits`, `training_certificates`, `training_sessions`
  - `user_activity_logs`, `maintenance_schedule`, `equipment_incidents`, `conflict_logs`
  - `ocr_documents`, `ocr_jobs`, `ocr_line_items`, `inventory_images`
  - Removed duplicate column from `routing_schedules`.
- [x] Drop/rename legacy constraints (e.g., `kits_company_id_fkey`) and rebuild indexes to reference `tenant_id`.
- [x] Recreate RLS policies using constitution pattern (`app_metadata.tenant_id`).
- [x] Re-run tenancy scan; archive result as `reports/live-tenancy-scan-2025-10-09b.txt`.

### 2. Migrations & Types
- [ ] Refactor pending migrations (`035`, `037`, triggers) to emit `tenant_id`.
- [ ] Update migration templates referencing `company_id`.
- [ ] Regenerate Supabase types (`npm run generate:types`) once live schema is clean.
- [ ] Commit regenerated `src/types/supabase.ts` and any supporting DTO/interface updates.

### 3. Application Code & Tests
- [ ] Sweep repositories/services for lingering `company_id` vars (grep + ESLint rule from cleanup plan).
- [ ] Update contract/integration/E2E tests to post/fetch `tenant_id`.
- [ ] Refresh fixtures/seeds to populate `tenant_id`.
- [ ] Regenerate code comments/docs referencing `company_id` (TENANCY.md, analysis reports).
- [ ] Introduce lint/pre-commit guard to block future `company_id` usage.

### 4. Tooling & Runtime
- [ ] Upgrade workspace to Node 20+/npm 10; update `.nvmrc` usage docs if needed.
- [ ] `npm ci` on Node 20 to refresh lockfile.
- [ ] Update scripts (`scripts/check-actual-db.ts`, OCR preflight outputs) to validate `tenant_id`.
- [ ] Ensure Supabase automation scripts (`scripts/analyze-tenancy-model.ts`, etc.) parse new schema.

### 5. Validation & Deployment
- [ ] Run: `npm run lint:directives`, `npm run type-check`, `npm run test`, `npm run test:integration`.
- [ ] Execute `npm run check:db-actual` (expect clean report) and archive output.
- [ ] Document Railway deploy checklist (env vars, Node version, `npm run build`).
- [ ] Push to main, confirm Railway build completes without schema or runtime errors.

## Reporting
- Track progress in this file (convert checkboxes to `[x]` as tasks complete).
- After each major milestone, commit updated tenancy scan and test results (`test-results/`).
- Once all tasks complete, summarize outcomes in `REPORTS.md` (or equivalent) and notify team.
