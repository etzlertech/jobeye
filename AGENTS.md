# CODEX Agent Instructions

## IMPORTANT: Main Branch Only Workflow
**As a single developer, all work happens directly on the main branch. DO NOT create feature branches.**

## CRITICAL: Execution Order for All Tasks

1. **ALWAYS START BY READING:**
   - `.specify/constitution.md` - Project rules and non-negotiables
   - `.specify/features/[feature-name]/tasks.md` - Task list
   - `CLAUDE.md` - Development commands and patterns

2. **THEN CREATE TODO LIST:**
   - Use TodoWrite to parse ALL tasks from the task file
   - Mark completed tasks as DONE
   - Identify next tasks to execute

3. **BEFORE ANY DATABASE WORK:**
   - Run `npm run check:db-actual` (or `npx tsx scripts/check-actual-db.ts`)
   - Never assume tables exist from migration files
   - Check actual schema state first

   **CRITICAL: To execute SQL migrations on Supabase:**
   - ❌ `psql` command is NOT available
   - ❌ `npx supabase db push` will FAIL with connection errors
   - ✅ USE: Create TypeScript script with `client.rpc('exec_sql', { sql })`
   - See `scripts/fix-rls-policies.ts` and `scripts/apply-job-limit-trigger.ts` for working examples
   - This is the ONLY reliable method to modify hosted Supabase databases

4. **FOR FILE OPERATIONS:**
   - Use Write tool, not complex shell heredocs
   - Keep it simple - avoid cross-shell compatibility issues

5. **FOLLOW THE CONSTITUTION:**
   - 300 LoC complexity budget (500 max with justification)
   - Every file needs AGENT DIRECTIVE BLOCKS
   - Tests FIRST (TDD) - they must fail before implementation
   - Always push after commits

### Demo & Tenant Testing Notes
- Demo pages (e.g., `/demo-items`, `/demo-jobs/[jobId]/items`) call supervisor APIs directly.
- Always send the correct `x-tenant-id` header when exercising those UIs; wrong tenants show empty lists or 404s.
- Surface tenant/user info in debug output when possible to keep context obvious.

## Repository Guidelines

### Project Structure & Module Organization
- `src/app` hosts Next.js routes and layout; `src/components` reusable UI; `src/domains` feature modules; `src/core` platform primitives; `src/lib` shared utilities; `src/types` generated Supabase definitions (`npm run generate:types`).
- Assets sit in `public`; reference material in `docs`; automation lives in `scripts`; database SQL in `supabase/migrations`; cached test output in `test-results`.
- Jest specs reside in `src/__tests__`; Supabase RLS fixtures stay in `test/rls`.

## Build, Test, and Development Commands
- `npm run dev` spins up the dev server with hot reload.
- `npm run build` creates the production bundle; `npm run start:production` serves it.
- `npm run test`, `npm run test:unit`, `npm run test:integration`, and `npm run test:coverage` cover the Jest suites; `npm run test:e2e` runs Playwright specs (create `tests/e2e` if needed).
- `npm run type-check`, `npm run lint:directives`, and `npm run quick-check` catch type and lint regressions.
- `npm run pre-commit` mirrors the Husky gate; run before pushing.

## Coding Style & Naming Conventions
- TypeScript in strict mode with functional React components and hooks.
- Two-space indentation, single quotes, Tailwind utilities for styling, domain-level barrel files.
- PascalCase components (`JobTimeline`), camelCase hooks/utilities (`useJobMetrics`), kebab-case route segments.
- Prefer the `@/` alias for shared imports; avoid deep relative paths.
- ESLint (`eslint --fix`) governs formatting; keep changes lint-clean.

## Testing Guidelines
- Keep specs near features in `src/__tests__` using `*.test.ts(x)` or `integration.*.test.ts(x)`.
- Use `@testing-library/react`, isolate seams with `jest.mock`, and limit snapshots.
- Run `npm run test:integration` after schema work; validate RLS rules with `npm run test:rls`.
- Track coverage via `npm run test:coverage` and flag intentional gaps in PR notes.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) with optional scopes (`feat(domains/voice): add pipeline step`); keep subjects <= 72 chars.
- Use exact commit format from CLAUDE.md with heredoc pattern:
  ```bash
  git commit -m "$(cat <<'EOF'
  commit message here
  
  🤖 Generated with [Claude Code](https://claude.ai/code)
  
  Co-Authored-By: Claude <noreply@anthropic.com>
  EOF
  )"
  ```
- Always push directly to main: `git push`
- Rebase or squash noisy history; confirm `npm run pre-commit` locally.
- PRs need a crisp summary, linked issues, visuals or payload samples for UX/API changes, and the test commands you ran.

## Environment & Security Notes
- Use Node 20+ (`.nvmrc`) and npm 10+; run `npm ci` to stay on the lockfile.
- Copy `.env.local.example` to `.env.local`; guard Supabase keys per developer.
- Set proper SUPABASE_DB_URL (with PGBouncer) before running any migrations or seed scripts.
- Read the actual schema from information_schema to decide when to insert records.
- Apply migration statements one by one instead of relying on multi-statement DO $$ blocks.
- Apply schema updates with `npm run db:migrate`; inventory SQL in `supabase/migrations`.
- Never commit secrets or generated manifests; extend `.gitignore` for new sensitive artifacts.
