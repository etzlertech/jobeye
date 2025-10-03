# Implementation Plan: Codebase Cleanup and Refactoring

**Branch**: `009-codebase-cleanup-and` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-codebase-cleanup-and/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → No NEEDS CLARIFICATION markers found
   → Set Project Type: web (Next.js + Supabase)
   → Set Structure Decision: JobEye existing structure
3. Fill the Constitution Check section based on the constitution document
   → Loaded JobEye constitution v1.1.2
4. Evaluate Constitution Check section below
   → All checks align with cleanup objectives
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → Research migration patterns and cleanup strategies
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
7. Re-evaluate Constitution Check section
   → Design supports constitutional principles
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Comprehensive codebase cleanup to standardize tenant isolation, consolidate duplicate implementations, remove orphaned tables, and establish consistent patterns. This refactoring addresses 157 tables (15 using company_id, 127 orphaned) and multiple repository pattern inconsistencies across the JobEye codebase.

## Technical Context
**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: Next.js 14, Supabase Client SDK, @supabase/supabase-js  
**Storage**: Supabase (PostgreSQL with RLS)  
**Testing**: Jest, React Testing Library, Playwright  
**Target Platform**: Web (Next.js), deployed on Railway  
**Project Type**: web - JobEye voice-first field service management  
**Performance Goals**: Migration execution < 5 minutes, zero downtime  
**Constraints**: Preserve all 692 rows of test data, maintain ≥80% test coverage  
**Scale/Scope**: 157 tables, ~50+ files with tenant_id/company_id mix, 127 orphaned tables

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Database Architecture: Supabase Multi-Tenant with RLS-First
- ✅ **Tenant Isolation**: Cleanup standardizes all tables to use `tenant_id`
- ✅ **RLS Policies**: All migrated tables will maintain RLS with correct app_metadata path
- ✅ **Migration Method**: Will use Supabase client RPC for all schema changes
- ✅ **Testing**: Will include RLS isolation tests for all affected tables

### Development Standards
- ✅ **Repository Pattern**: Consolidating to class-based pattern only
- ✅ **Complexity Budget**: Cleanup reduces complexity by removing duplicates
- ✅ **Testing Requirements**: Maintaining ≥80% line coverage throughout
- ✅ **Pre-Commit Gates**: Adding ESLint rules to prevent pattern regression

### Non-Negotiables
- ✅ **DB Precheck**: Will analyze actual schema before migrations
- ✅ **Push After Commit**: All changes will be pushed immediately
- ✅ **Idempotent Migrations**: All migrations will be CREATE IF NOT EXISTS style

## Project Structure

### Documentation (this feature)
```
specs/009-codebase-cleanup-and/
├── spec.md              # Feature specification with clarifications
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# JobEye existing structure (cleanup targets)
src/
├── domains/
│   ├── equipment/       # Merge container repositories
│   ├── inventory/       # Remove duplicate container repo
│   └── [other domains]  # Convert functional to class repos
├── core/
│   ├── config/          # Update tenant configuration
│   └── repositories/    # Base repository pattern
└── app/
    └── api/             # Update API handlers for tenant_id

scripts/
├── migrations/          # New migration scripts
│   ├── migrate-company-to-tenant.ts
│   ├── remove-orphaned-tables.ts
│   └── seed-empty-tables.ts
└── validation/          # Schema verification
    └── verify-schema-alignment.ts

.eslintrc.js            # Add deprecated pattern rules
.husky/                 # Pre-commit hooks configuration
```

**Structure Decision**: Working within existing JobEye structure. Cleanup will modify existing files in-place, add migration scripts to scripts/ directory, and update configuration files at root level.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - All technical context is clear from constitution and existing codebase
   - No NEEDS CLARIFICATION items remain

2. **Generate and dispatch research agents**:
   ```
   Task: "Research safe tenant_id migration patterns for Supabase"
   Task: "Find best practices for repository consolidation in TypeScript"
   Task: "Research orphaned table detection and removal strategies"
   Task: "Study ESLint rule creation for deprecated pattern prevention"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with migration strategies and consolidation patterns

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Migration tracking entity (track progress)
   - Table inventory entity (categorize tables)
   - Code pattern violations entity (for reporting)

2. **Generate API contracts** from functional requirements:
   - Schema verification endpoint
   - Migration status endpoint
   - Pattern violation reporting endpoint
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - Schema alignment verification tests
   - Migration rollback tests
   - Pattern detection tests

4. **Extract test scenarios** from user stories:
   - Developer searches for tenant code → only tenant_id found
   - CI pipeline detects schema drift → build fails appropriately
   - Empty tables get seeded → repositories work correctly

5. **Update agent file incrementally**:
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
   - Add cleanup patterns and migration approach
   - Update recent changes section

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Migration tasks for each table group (tenant_id conversion)
- Repository consolidation tasks (one per functional repo)
- Orphaned table analysis and removal tasks
- ESLint rule creation tasks
- Test data seeding tasks for empty tables
- Validation and verification tasks

**Ordering Strategy**:
1. Database analysis tasks first [P]
2. Migration script creation [P]
3. Repository consolidation [P]
4. ESLint and pre-commit setup
5. Execution and validation tasks

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, verify all tables migrated)

## Complexity Tracking
*No violations - cleanup reduces complexity*

All aspects of this cleanup align with constitutional principles and actively reduce codebase complexity by:
- Standardizing patterns
- Removing duplicates
- Establishing automated guards

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none needed)

---
*Based on Constitution v1.1.2 - See `.specify/constitution.md`*