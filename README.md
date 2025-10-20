# JobEye - Architecture-as-Code Skeleton Generation v2025-08-1

This project uses an enhanced Architecture-as-Code (AaC) approach for building a Voice-First Field Service Management system with 85+ database tables. The v2025-08-1 standard includes advanced features for state machines, cost tracking, and offline capabilities.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Skeleton Generation

Use the master prompt template with Claude to generate skeleton files:

```bash
# 1. Copy the prompt from .claude/MASTER_PROMPT_TEMPLATE.md
# 2. Fill in the phase/domain specifics
# 3. Send to Claude
# 4. Save Claude's response to a file (e.g., phase1-auth.txt)
# 5. Inject the skeleton files:
npm run scaffold:inject < phase1-auth.txt
```

### 3. Check Progress
```bash
npm run report:skeleton-status
```

## Architecture Overview

The project is organized into 5 phases:

1. **Phase 1: Core Infrastructure** (15 tables, ~125 files)
   - Authentication
   - Core Infrastructure
   - Multi-tenant

2. **Phase 2: Domain Models** (25 tables, ~240 files)
   - Customer Management
   - Property Management
   - Equipment Tracking
   - Material Catalog

3. **Phase 3: Voice Pipeline** (12 tables, ~185 files)
   - Voice Core
   - Intent Recognition
   - STT/TTS Integration
   - Offline Support

4. **Phase 4: Job Execution** (18 tables, ~280 files)
   - Job Templates
   - Job Execution
   - AI Verification
   - Irrigation Systems

5. **Phase 5: UI Integration** (15 tables, ~180 files)
   - Shared Components
   - Web App
   - Mobile App
   - Admin Portal

## Directive Block Contract v2025-08-1

Every file must start with an enhanced directive block that includes:

```typescript
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/auth/services/auth-service.ts
// phase: 1
// domain: authentication
// version: 1.0.0
// purpose: Handle user authentication with Supabase
// spec_ref: v4.0/auth-patterns.md#authentication
// complexity_budget: 300 LoC
//
// migrations_touched:
//   - 006_auth_tables.sql
//   - 007_auth_rls_policies.sql
//
// state_machine:
//   id: auth_session_fsm
//   states: [unauthenticated, pending, authenticated, expired]
//
// estimated_llm_cost:
//   tokens_per_operation: 150
//   operations_per_day: 5_000
//   monthly_cost_usd: 25.00
//
// dependencies:
//   internal:
//     - /src/core/logger/logger.ts
//   external:
//     - npm: '@supabase/supabase-js'
//   supabase:
//     - table: users (RLS ON)
//     - function: verify-magic-link
//
// exports:
//   - function authenticateUser(email: string, password: string): Promise<AuthResult>
//
// voice_considerations: >
//   Support "log me in" voice command with biometric verification
//
// offline_capability: NONE
//
// test_requirements:
//   coverage: 0.9
//   test_file: /src/domains/auth/services/__tests__/auth-service.test.ts
//
// tasks:
//   1. [SETUP] Initialize Supabase client
//   2. [VALIDATE] Check email and password format
//   3. [AUTH] Call Supabase auth.signInWithPassword
//   4. [TOKEN] Generate JWT with refresh token
//   5. [LOG] Record in audit_logs
//   6. [ERROR] Handle invalid credentials
// --- END DIRECTIVE BLOCK ---
```

### New Fields in v2025-08-1

| Field | Purpose | Required |
|-------|---------|----------|
| `migrations_touched` | Track DB dependencies | When DB operations exist |
| `state_machine` | Define workflow states | For stateful workflows |
| `estimated_llm_cost` | Prevent cost overruns | For AI/LLM operations |
| `offline_capability` | Guide PWA/mobile sync | Always (REQUIRED/OPTIONAL/NONE) |

## Available Scripts

### Development
- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm run test` - Run tests

### Skeleton Management
- `npm run scaffold:inject` - Create skeleton files from Claude output
- `npm run lint:directives` - Validate all directive blocks (v2025-08-1)
- `npm run validate:deps` - Check dependency graph and generate visualization
- `npm run report:skeleton-status` - Show skeleton generation progress
- `npm run report:api-surface` - List all exported functions
- `npm run report:voice-coverage` - Check voice support coverage

### Database
- `npm run db:migrate` - Run Supabase migrations
- `npm run db:reset` - Reset database
- `npm run generate:types` - Generate TypeScript types from schema

**CRITICAL**: To execute SQL on hosted Supabase, use TypeScript scripts with `client.rpc('exec_sql')`.
See **[Database Migration Guide](docs/database-migration-guide.md)** for complete instructions and working examples.

### Quality Checks
- `npm run check:complexity` - List largest files
- `npm run validate:dependencies` - Check for circular dependencies

## Workflow Example

### Generating Authentication Domain Skeleton

1. **Prepare the prompt:**
```
Current phase: 1
Current domain: Authentication
Tables involved: users, auth_tokens, password_reset_requests
Special requirements: Supabase Auth integration, magic links, JWT refresh tokens
```

2. **Get file list from Claude:**
```
Claude will propose ~15 files for authentication domain
```

3. **Generate directive blocks:**
```
Claude emits 5 files at a time with full directive blocks
```

4. **Create the files:**
```bash
# Save Claude's response to auth-skeleton.txt
npm run scaffold:inject < auth-skeleton.txt
```

5. **Validate:**
```bash
npm run lint:directives
```

## CI/CD Integration

The project includes GitHub Actions that:
- Validate directive blocks on every PR
- Check file complexity limits
- Ensure spec references are valid
- Verify phase assignments

## Best Practices

1. **Always start with skeletons** - Don't write code without a directive block
2. **Respect complexity budgets** - Keep files under 300 LoC
3. **Include voice considerations** - Every user-facing feature needs voice support
4. **Specify offline capability** - Mark as REQUIRED, OPTIONAL, or NONE
5. **Track migrations** - List all SQL files in migrations_touched
6. **Estimate LLM costs** - Include cost projections for AI operations
7. **Define state machines** - For any stateful workflows
8. **Write tests first** - Target 90% coverage from the start
9. **Use proper phases** - Don't mix Phase 2 code with Phase 1 infrastructure
10. **Validate dependencies** - Only reference same or earlier phases

## Troubleshooting

### "No directive blocks found"
Make sure Claude's output includes proper code fences:
```typescript
// directive block here
```

### "Spec ref not found"
Add the referenced spec document to `.claude/spec/` directory

### "Complexity budget exceeded"
Split the file into smaller modules (max 500 LoC after v2025-08-1)

### "Migration file not found"
Ensure files listed in migrations_touched exist in /supabase/migrations/

### "Invalid offline_capability"
Must be one of: REQUIRED, OPTIONAL, NONE

### "Missing LLM cost estimate"
Any file touching AI/LLM must include estimated_llm_cost

## Documentation

### Important Project Documentation

- **[Known Issues](KNOWN_ISSUES.md)** - Technical debt and known issues requiring future attention
- **[Retired Systems](RETIRED_CHECKLIST_SYSTEM.md)** - Documentation of retired features and migration guides
- **[Recent Cleanups](CLEANUP_COMPLETE_20251019.md)** - Summary of completed cleanup operations

### Schema & Architecture

For detailed architecture documentation, see `.claude/spec/` directory.

## Next Steps

1. Start with Phase 1 / Authentication domain
2. Complete all Phase 1 skeletons before moving to Phase 2
3. Begin implementation only after all skeletons are reviewed
4. Run status reports regularly to track progress
