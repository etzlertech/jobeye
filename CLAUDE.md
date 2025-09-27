# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobEye is a Voice-First Field Service Management System built with Architecture-as-Code (AaC) methodology. The project uses Next.js 14 with TypeScript, Supabase for the backend, and follows a strict directive-based development approach.

## Common Development Commands

### Running the Application
```bash
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
```

### Testing
```bash
npm run test            # Run Jest tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
npm run test:e2e        # Run Playwright end-to-end tests
npm run test:rls        # Test Row Level Security policies
```

### Architecture-as-Code (AaC) Commands
```bash
npm run scaffold:inject              # Create skeleton files from Claude output
npm run lint:directives             # Validate all directive blocks (v2025-08-1)
npm run validate:deps               # Check dependency graph
npm run report:skeleton-status      # Show skeleton generation progress
npm run report:api-surface          # List all exported functions
npm run report:voice-coverage       # Check voice support coverage
npm run report:progress             # Generate progress manifest
npm run report:detailed             # Generate detailed manifest
```

### Database Management
```bash
npm run generate:types   # Generate TypeScript types from Supabase schema
npm run db:migrate      # Run Supabase migrations
npm run db:reset        # Reset database to clean state
npm run check:db-actual # Check ACTUAL database schema (ALWAYS run before migrations!)
```

#### CRITICAL: Database Schema Inspection
**ALWAYS check the actual database state before writing migrations or assuming tables exist!**

Use this command to see what tables actually exist in Supabase:
```bash
npx tsx scripts/check-actual-db.ts
```

This script will:
- Connect to Supabase using the service role key
- List ALL actual tables (not assumptions from migration files)
- Show row counts for each table
- Display column schemas

**WARNING**: Migration files in the codebase may NOT reflect the actual database state. Tables you expect may not exist, and tables that exist may be completely different than expected.

See `supabase_direct_access_instructions.md` for detailed connection methods and troubleshooting.

### Edge Functions
```bash
npm run edge:serve      # Serve Supabase edge functions locally
npm run edge:deploy     # Deploy edge functions to production
```

### Code Quality
```bash
npm run check:complexity   # List 20 largest files by line count
npm run check:security    # Security audit of dependencies
npm run check:context     # Check file context limits
```

## Architecture Overview

### Directive Block Contract (v2025-08-1)

Every TypeScript/JavaScript file MUST start with an AGENT DIRECTIVE BLOCK containing:
- `file`: Absolute path to the file
- `phase`: Phase number (1-5)
- `domain`: Domain name
- `purpose`: Brief description
- `spec_ref`: Reference to specification document
- `complexity_budget`: Maximum lines of code allowed
- `migrations_touched`: SQL files affected (when DB operations exist)
- `state_machine`: FSM definition (for stateful workflows)
- `estimated_llm_cost`: AI operation cost estimates
- `offline_capability`: REQUIRED/OPTIONAL/NONE
- `dependencies`: Internal, external, and Supabase dependencies
- `exports`: Public API surface
- `voice_considerations`: Voice interaction requirements
- `test_requirements`: Coverage targets and test file locations
- `tasks`: Implementation steps

### Project Phases

1. **Phase 1: Core Infrastructure** (15 tables)
   - Authentication (Supabase Auth integration)
   - Core Infrastructure (logging, config, error handling)
   - Multi-tenant (RLS policies, tenant isolation)

2. **Phase 2: Domain Models** (25 tables)
   - Customer Management
   - Property Management
   - Equipment Tracking
   - Material Catalog

3. **Phase 3: Voice Pipeline** (12 tables)
   - Voice Core (transcription, sessions)
   - Intent Recognition
   - STT/TTS Integration
   - Offline Support

4. **Phase 4: Job Execution** (18 tables)
   - Job Templates
   - Job Execution workflows
   - AI Verification
   - Irrigation Systems

5. **Phase 5: UI Integration** (15 tables)
   - Shared Components
   - Web App
   - Mobile App
   - Admin Portal

### Key Architectural Patterns

1. **Supabase Integration**
   - All database operations through Supabase client
   - Row Level Security (RLS) on all tables
   - Edge functions for complex operations
   - Real-time subscriptions where needed

2. **Voice-First Design**
   - Every user-facing feature must consider voice interaction
   - Voice metadata tracked for all operations
   - Offline queue for voice commands
   - Cost tracking for all AI/LLM operations

3. **Multi-Tenant Architecture**
   - Company ID injected in all queries
   - Tenant isolation at database level
   - Admin bypass for support operations
   - Company switching for multi-company users

4. **State Machine Management**
   - Complex workflows use FSM patterns
   - States defined in directive blocks
   - State transitions logged for audit

## Development Workflow

### Creating New Features

1. **Start with Skeleton Generation**
   ```bash
   # Use the master prompt template from .claude/MASTER_PROMPT_TEMPLATE.md
   # Generate directive blocks with Claude
   # Save output and inject:
   npm run scaffold:inject < skeleton-output.txt
   ```

2. **Validate Structure**
   ```bash
   npm run lint:directives
   npm run validate:deps
   ```

3. **Implement Following Tasks**
   - Follow the tasks list in each directive block
   - Respect complexity budgets (300 LoC default, 500 LoC max)
   - Include voice considerations
   - Write tests to meet coverage requirements

### Working with Control Tower

The Control Tower at `/control-tower` provides:
- Architecture visualization
- Manifest generation
- Standards library
- Progress tracking

Access locally at: http://localhost:3000/control-tower

## Important Conventions

1. **Import Paths**: Use `@/*` alias for src directory imports
2. **File Naming**: Use kebab-case for files, PascalCase for components
3. **Test Files**: Place in `__tests__` directories with `.test.ts` extension
4. **SQL Migrations**: Name as `YYYYMMDD_HHMM_description.sql`
5. **Error Handling**: Use structured error types from `@/core/errors/error-types`
6. **Logging**: Use voice-aware logger from `@/core/logger/voice-logger`
7. **Database Access**: Always use repositories pattern, never direct Supabase calls outside repos

## Environment Variables

Required variables (see `src/core/config/environment.ts`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

## Testing Strategy

1. **Unit Tests**: Jest with 90% coverage target
2. **Integration Tests**: Test database operations with RLS
3. **E2E Tests**: Playwright for critical user flows
4. **Voice Tests**: Mock voice interactions in tests
5. **RLS Tests**: Dedicated harness for security policies

## Deployment

The project uses:
- Next.js standalone output for containerization
- Railway.app configuration included
- Docker support with multi-stage builds
- Nixpacks configuration for alternative deployment

## Critical Reminders

- Always run `npm run check:db-actual` before making any database-related decisions
- Never assume database state from migration files
- Follow directive block contract for all new files
- Respect complexity budgets to maintain codebase quality
- Include voice considerations in all user-facing features
- Use repository pattern for all database operations

## Backend & Testing Guidelines

1. **Tests are Truth, Not Obstacles.** *Never* alter or "patch" a test simply to make it pass. Failing tests indicate a mismatch between the implementation and the expected behaviour. Always fix the underlying code or revisit the business requirements; do not rewrite the test unless the specification itself has changed.

2. **Schema and Migration Integrity.** Before writing or modifying application code, run all migrations against a test Supabase instance. Use existing scripts (e.g. `check-db-status.ts`) to verify that every table, index, trigger, function and RLS policy defined in the blueprint exists and compiles. Any new migrations must be additive and must not conflict with previous ones.

3. **Multi‑Tenant Security.** RLS policies must be enforced and tested. Create integration tests that attempt to read and write across tenant boundaries and assert that unauthorized operations fail. Ensure that no queries bypass RLS by accident.

4. **Comprehensive CRUD + Offline Coverage.** Each repository (e.g. jobs, media_assets, voice_transcripts) must have unit tests covering:

   * `findById`, `findAll` (with filters/pagination)
   * `create`, `update`, `delete`, `createMany`
   * Offline scenarios: if `navigator.onLine` is false, operations should be queued locally and replayed successfully once back online.

5. **Resilience & Error Handling.** Tests should include edge cases and error paths—failed inserts/updates, invalid payloads, and unexpected Supabase errors—to ensure the code surfaces meaningful errors rather than swallowing them.

6. **Environment Respect.** Don't hard‑code keys or alter environment variables within tests just to force a connection. Either load them from `.env.local` via a setup script or skip integration tests when credentials are unavailable. Never commit secrets or test data to the repository.

7. **Pre‑Commit & Coverage Requirements.** All code must pass the pre-commit suite (TypeScript compile, linting, directive validation, dependency analysis, and build test) and maintain the project's ≥80 % coverage threshold. Use the coverage report to identify untested branches.

8. **Gate UI and LLM Work on Backend Readiness.** Only proceed to UI and LLM integration when:

   * All migrations run cleanly.
   * The RLS isolation tests pass.
   * CRUD + offline tests are comprehensive and green.
   * Critical Supabase functions (e.g. `process_voice_command`, `control_irrigation_zone_voice`) have been smoke‑tested with dummy inputs.
   * The pre‑commit checks and coverage targets are satisfied.

By adhering to these principles, we ensure the Supabase backend is a solid, secure foundation on which the UI and AI features can be confidently built.