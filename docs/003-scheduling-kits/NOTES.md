# Scheduling Kits Implementation Notes

## Scope Highlights
- Introduced dedicated scheduling kits domain types, repositories, and service orchestration beneath src/domains/(lib|repos|services)/scheduling-kits.
- Added Jest coverage for kit assignment, variant resolution, and missing item override workflows using kit-service.test.ts.
- Established Supabase schema support (day plans, schedule events, crew assignments, kits, kit items, kit variants, job kits, override log) with RLS enforcement and service role bypass.

## TDD Sequence
1. Authored failing unit specs targeting variant selection, missing item tracking, and supervisor notifications.
2. Implemented scheduling kit service leveraging injected repositories and clock dependency until tests passed.
3. Refactored to share typed definitions and relocated domain files into the approved repos/services/lib structure without breaking coverage.

## Database Notes
- Migration 035_003_scheduling_kits.sql is additive and idempotent, using CREATE TABLE IF NOT EXISTS and DROP POLICY IF EXISTS guards.
- Every table enforces company_id isolation via current_company_id() helper plus explicit service_role bypass policies.
- Triggers reuse the shared set_updated_at function; RLS is forced on all new tables.

## Follow Up Considerations
- Wire repositories to actual Supabase client factories and extend integration tests once API routes land.
- Add data seeding or fixtures for day plans and default kit definitions when scripts are open for modification.
- Validate migration against live tenants for PostGIS availability and ensure company_id UUID claims exist in auth tokens.

## API & Preview UI
- Tables: `kits`, `kit_items`, `kit_variants`, `kit_assignments`, `kit_override_logs`.
- Seed contract: `npm run 003:seed` hydrates company `00000000-0000-4000-a000-000000000003` with tool/starter kits.
- Endpoints (multi-tenant safe):
  - `GET /api/scheduling-kits` – list kits for the authenticated company.
  - `GET /api/scheduling-kits/:id` – detail with items (404 on cross-tenant).
  - `POST /api/scheduling-kits` – create kit + items.
  - `POST /api/scheduling-kits/:kitCode/assign` – create assignment using default variant.
- Preview UI: enable by setting `NEXT_PUBLIC_FEATURE_SCHEDULING_KITS=true`. Navigation adds **Scheduling Kits Preview** under Control Tower with list/details and create form.
  - With flag disabled the route renders “Feature disabled.” and nav item stays hidden.

## Runbook
1. `npm run 003:seed` – provision deterministic tenant data.
2. `npm run 003:preflight` – verify tables, RLS, and seed rows.
3. `npm run 003:full` – seed → preflight → API + repo/service suites.
4. Toggle preview UI with `NEXT_PUBLIC_FEATURE_SCHEDULING_KITS`. Leave false in production.

