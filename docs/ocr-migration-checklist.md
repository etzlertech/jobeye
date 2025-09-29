# OCR Migration Preflight Checklist

This checklist must be completed before authoring any OCR-related database migration. It captures the required verification steps and documents the output produced by the automated preflight tool.

## Preflight Inputs
- Supabase project URL and service-role key (read-only access only)
- Local environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
- Node 20+ and npm 10+

## Required Steps
1. Ensure environment variables above are exported in the current shell session.
2. Run the actual database inspection:
   ```bash
   npm run db:check:actual
   ```
3. Review the console output for dependency table checks (`vendors`, `inventory_images`).
4. Review the printed schema summaries for OCR tables (`ocr_jobs`, `ocr_documents`, `ocr_line_items`, `ocr_note_entities`, `vendor_aliases`, `vendor_locations`).
5. Open `reports/db-precheck-ocr.txt` and archive the summary with your migration notes.
6. Resolve any reported issues before proceeding (missing tables, missing columns, or inaccessible tables must be addressed).

## Sign-off Checklist
- [ ] Dependency tables exist (`vendors`, `inventory_images`)
- [ ] OCR tables exist or are documented as missing
- [ ] All required columns present for existing OCR tables
- [ ] Row counts captured in `reports/db-precheck-ocr.txt`
- [ ] Index inventory reviewed and noted
- [ ] Issues list in the report is empty (or risk accepted by ops owner)
- [ ] Report attached to PR description or linked in task notes

## Escalation
If the preflight script exits with an error, resolve the underlying database issue or contact the data operations owner before attempting any migrations.

## Maintenance Notes
- Generate or overwrite migrations in an editor instead of piecemeal PowerShell `-replace`; dangling `DO $$` / `END $$;` delimiters cause `supabase db push` failures.
- Use the pooled connection string (`SUPABASE_DB_URL`, e.g. `postgres.rtwigjwqufozqfwozpvo@aws-0-us-east-1.pooler.supabase.com:6543`) for scripts and checks—never derive `db.<ref>.supabase.co`.
- When running Supabase client scripts under PowerShell, write a temp file (e.g. `tmp-seed-ocr.js`) rather than multi-line `node -e` strings to avoid quoting issues.

> **Scope Switch Reminder**
> When moving from Implementation 001 to Implementation 002 (OCR), paste the directive `SWITCH TO IMPLEMENTATION 002 (OCR)` into Codex so the agent resets scope and avoids touching harness scripts.
> Repeat this pattern when stepping into future implementation scopes (e.g., Impl-003) to keep edits focused.

## Seed Contract
- Seed script: `npm run ocr:seed` (runs `scripts/ocr-seed.mjs`).
- Inserts one row per OCR table for `company_id = 'test-org-a'` (vendor, alias, location, inventory image, job, document, line item, note entity).
- IDs are deterministic (UUIDs ending in repeating digits) so re-running the seed is idempotent via `upsert` on `id`.
