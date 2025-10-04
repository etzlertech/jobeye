# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- Last updated: 2025-10-02 for testing git workflow -->

## Project Overview

JobEye is a Voice-First Field Service Management System built with Architecture-as-Code (AaC) methodology. The project uses Next.js 14 with TypeScript, Supabase for the backend, and follows a strict directive-based development approach.

**Latest Completed Feature**: Codebase Cleanup and Refactoring (Feature 009) ✅
- Standardized tenant_id across all tables and code (was mix of company_id/tenant_id)
- Reduced database from 157 to ~30 tables by removing orphaned tables
- Converted repositories to class-based pattern extending BaseRepository
- Created unified inventory model with items and item_transactions tables
- Implemented cleanup verification scripts and fast pre-commit hooks
- **Pre-Frontend Cleanup (2025-10-03)**: Removed 9 additional orphaned tables
  - Now 40 tables total (was 49)
  - Ready for UI development on Customer, Property, Job, Vision, and Voice features
  - See `docs/ui-ready-features.md` for frontend quick start

**Previous Features**:
- Feature 008: Codebase Redundancy Analysis - Analysis tools for finding duplicate code
- Feature 007: MVP Intent-Driven Mobile App
- Camera-based intent recognition for inventory, job loads, receipts, and maintenance
- Voice-driven workflows (STT→LLM→TTS) with max 4 buttons per screen
- Role-based access: Super Admin, Supervisor, Crew Member
- Offline support with IndexedDB and background sync
- Single company deployment with 6 jobs/crew/day limit

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

### Railway Deployment Monitoring
```bash
# Monitor a specific deployment
npm run railway:monitor <deployment-id>

# View build logs
npm run railway:build-logs <deployment-id> [limit]

# View runtime/deployment logs  
npm run railway:deploy-logs <deployment-id> [limit]

# Check latest deployment
npm run railway:check
```

**Finding Deployment IDs:**
- After pushing to GitHub, check the Actions tab for the deployment workflow
- The deployment ID is shown in the Railway CLI output
- Or visit https://railway.app to find recent deployments

**Example Railway debugging workflow:**
1. Push changes: `git push`
2. Wait for GitHub Actions to trigger Railway deployment
3. Monitor deployment: `npm run railway:monitor <deployment-id>`
4. If failed, the script will automatically show error logs
5. Fix issues and push again

#### CRITICAL: Direct Database Modifications via Supabase
**The ONLY reliable method to execute SQL migrations and schema changes on hosted Supabase is through the Supabase JavaScript client using `client.rpc('exec_sql', { sql: '...' })`**

**Why traditional methods DON'T work:**
- ❌ `psql` command is not available in most environments
- ❌ `npx supabase db push` fails with connection errors (tries to connect to local postgres)
- ❌ Direct TCP connections to Postgres are often blocked by firewalls
- ❌ PGBouncer URLs don't work with standard postgres clients

**✅ WORKING METHOD - Use Supabase Client RPC:**

Create a TypeScript script using this pattern:

```typescript
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Applying migration...\n');

  // Execute SQL directly via RPC
  const { error } = await client.rpc('exec_sql', {
    sql: 'DROP POLICY IF EXISTS my_policy ON my_table;'
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
}

applyMigration().catch(console.error);
```

**Real examples that worked:**
- `scripts/fix-rls-policies.ts` - Fixed RLS policies to use app_metadata
- `scripts/apply-job-limit-trigger.ts` - Added database trigger for job limit enforcement
- Both successfully executed complex SQL (DROP POLICY, CREATE POLICY, CREATE TRIGGER) via Supabase RPC

**BEST PRACTICES**:
1. Always use `.env.local` for credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
2. Execute SQL statements individually via `client.rpc('exec_sql', { sql })`
3. Store migration SQL in `supabase/migrations/*.sql` for documentation
4. Use TypeScript scripts in `scripts/` directory for applying them
5. Always verify changes by querying the database after application

**When to check actual schema:**
```bash
# Use Supabase client to query information_schema
npx tsx scripts/check-actual-db.ts
```

**WARNING**: Migration files in the codebase may NOT reflect the actual database state. Always verify by querying the live database using Supabase client, never assume based on migration files.

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
npm run verify:cleanup    # Verify Feature 009 cleanup was applied correctly
npm run pre-commit        # Run fast pre-commit checks
npm run pre-commit:full   # Run comprehensive pre-commit validation
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
   - **Vision-Based Verification** (Feature 001, MERGED ✓)
     - Hybrid YOLO + VLM detection pipeline
     - Offline-first kit verification
     - Cost-optimized cloud fallback (<$10/day)
     - Multi-container tracking

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

### Railway Deployment Validation Strategy

**Force Deploy and Debug Pattern**: A highly effective strategy for identifying deployment issues:

1. **Push Incomplete Code to Railway**
   ```bash
   git add .
   git commit --no-verify -m "feat: force deployment to reveal bugs"
   git push  # Triggers automatic Railway deployment
   ```

2. **Use Deployment Validation Script**
   ```bash
   # Test against live deployment
   NEXTAUTH_URL=https://your-app.railway.app npx tsx scripts/validate-mvp-deployment.ts
   ```

3. **Analyze Production Failures**
   - **API Route Response Errors**:
     ```
     Error: No response is returned from route handler '/app/src/app/api/*/route.ts'
     ```
     - Fix: Ensure all route handlers return NextResponse in all code paths
     - Common cause: Wrapper functions not properly returning responses
   
   - **Static Generation Errors**:
     ```
     ReferenceError: navigator is not defined
     ```
     - Fix: Move browser-only code into useEffect or client components
     - Use typeof checks: `if (typeof window !== 'undefined')`
   
   - **Import/Export Errors**:
     ```
     Attempted import error: 'X' is not exported from '@/path/to/module'
     ```
     - Fix: Check export statements match import expectations
     - Common with service classes and utility functions
   
   - **Other Common Issues**:
     - API routes returning 404 = Missing dependencies/build failures
     - Database connection issues = Environment variables or RLS problems
     - Storage access issues = Missing buckets or permissions

4. **Benefits of This Approach**
   - **Real Production Environment**: Tests actual deployment, not just local dev
   - **Concrete Error Messages**: Railway build logs show exact missing dependencies
   - **End-to-End Validation**: Tests full stack from frontend to database
   - **Fast Feedback Loop**: Railway deployments complete in 2-3 minutes
   - **No Guesswork**: Precise error identification vs. theoretical problems

5. **Railway Monitoring Commands**
   ```bash
   npm run railway:check              # Find latest deployment
   npm run railway:monitor <id>       # Monitor specific deployment  
   npm run railway:build-logs <id>    # View build errors
   npm run railway:deploy-logs <id>   # View runtime errors
   ```

**Key Insight**: Railway's production environment reveals dependency issues that local development misses due to different module resolution, environment variables, and build processes.

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

## Implemented Features

### Feature 001: Vision-Based Kit Verification ✅ MERGED

**Status**: Merged to main (Commit: 23314d7) | **Docs**: `src/domains/vision/README.md`, `docs/api/vision.md`

Automated equipment detection using hybrid YOLO + VLM pipeline for single-photo load verification.

**Key Components**:
- **Local Detection**: YOLOv11n ONNX model with <3s inference on mobile
- **VLM Fallback**: OpenAI GPT-4 Vision for low-confidence cases (<70%)
- **Offline Queue**: IndexedDB-based queue (50-photo capacity)
- **Cost Tracking**: $10/day budget cap with real-time monitoring
- **Multi-Container**: Track items across truck, trailer, storage bins

**Directory**: `src/domains/vision/`
```
vision/
├── lib/                 # YOLO inference, VLM routing, offline queue
├── services/            # Verification, cost tracking, batch processing
├── repositories/        # Data access with RLS
├── components/          # Camera capture, results display, cost dashboard
└── __tests__/           # Unit, scenario, API tests
```

**API Endpoints**:
- `POST /api/vision/verify` - Single photo verification
- `POST /api/vision/batch-verify` - Multi-photo verification
- `GET /api/vision/verifications` - History with filters
- `GET /api/vision/cost/summary` - Budget monitoring

**Database Tables** (Migrations 040-044):
- `vision_verification_records` - Verification history
- `detected_items` - Detected equipment per verification
- `vision_cost_records` - Cost tracking per request
- `detection_confidence_thresholds` - Company-specific thresholds

**Performance**:
- YOLO Inference: ~2.5s average
- FPS Throttle: 1.0 fps stable
- VLM Usage: ~20% of verifications
- Average Cost: ~$0.02/verification

**Usage Example**:
```typescript
import { VisionVerificationService } from '@/domains/vision/services/vision-verification.service';

const result = await visionService.verifyKit({
  photo: imageBlob,
  kitId: 'kit-123',
  jobId: 'job-456'
});

console.log(result.verified); // true/false
console.log(result.detectedItems); // ['mower', 'trimmer', 'blower']
console.log(result.missingItems); // []
console.log(result.cost); // 0.00 (used local YOLO)
```

**Integration with Scheduling (Feature 003)**:
- Fetches kit definitions from scheduling system
- Updates kit verification status in job records
- Triggers supervisor notifications for incomplete kits

**Known Issues**:
- ⚠️ Test failures: 342 tests failing (ImageData mock now fixed)
- ⚠️ Test coverage: ~75% (target >80%)
- ⚠️ Some scenario tests timing out (IndexedDB mock issues)

**Next Steps**:
- Fix remaining test failures
- Achieve >80% test coverage
- Production deployment to staging

---

## Recent Changes
- 009-codebase-cleanup-and: Added TypeScript 5.x, Node.js 18+  
 + Next.js 14, Supabase Client SDK, @supabase/supabase-js  

### Feature 008: Codebase Redundancy Analysis (2025-01-02)
- Created redundancy analyzer tool specifications
- Designed data model for tracking duplicate code and abandoned tables

### Feature 007: MVP Intent-Driven Mobile App (2025-01-27)

### Previous Features

## Important Conventions

1. **Import Paths**: Use `@/*` alias for src directory imports
2. **File Naming**: Use kebab-case for files, PascalCase for components
3. **Test Files**: Place in `__tests__` directories with `.test.ts` extension
4. **SQL Migrations**: Name as `YYYYMMDD_HHMM_description.sql`
5. **Error Handling**: Use structured error types from `@/core/errors/error-types`
6. **Logging**: Use voice-aware logger from `@/core/logger/voice-logger`
7. **Database Access**: Always use repositories pattern, never direct Supabase calls outside repos
8. **Vision Integration**: Use `VisionVerificationService` for kit verification, respects budget caps and offline capability
9. **Multi-Tenant Fields**: ALWAYS use `tenant_id` (never `company_id`) for multi-tenant isolation
10. **Repository Pattern**: New repositories must extend `BaseRepository` and use class-based pattern
11. **RLS Policies**: Use standardized JWT path: `current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'`

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
- **IMPORTANT: Claude can push changes directly - never ask the user to push or commit. Always use `git push` directly when changes need to be deployed**

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
