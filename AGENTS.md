# Repository Guidelines

## Project Structure & Module Organization
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
- Rebase or squash noisy history; confirm `npm run pre-commit` locally.
- PRs need a crisp summary, linked issues, visuals or payload samples for UX/API changes, and the test commands you ran.

## Environment & Security Notes
- Use Node 20+ (`.nvmrc`) and npm 10+; run `npm ci` to stay on the lockfile.
- Copy `.env.local.example` to `.env.local`; guard Supabase keys per developer.
- Apply schema updates with `npm run db:migrate`; inventory SQL in `supabase/migrations`.
- Never commit secrets or generated manifests; extend `.gitignore` for new sensitive artifacts.
