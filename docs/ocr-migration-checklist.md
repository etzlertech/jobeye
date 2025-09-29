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
