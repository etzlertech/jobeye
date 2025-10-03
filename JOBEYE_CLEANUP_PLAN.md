# JobEye Codebase Cleanup Project

## Background

JobEye's architecture-as-code approach has delivered a robust foundation for building a voice-first, offline-capable field-service management system. Over time, rapid evolution has introduced several inconsistencies, redundancies and documentation gaps. Analysis reveals:

- **Tenancy inconsistency**: 50+ files use `tenant_id` while 50+ use `company_id`, with some tables having both columns
- **Duplicate repositories**: Two separate container repository implementations exist
- **Overlapping domains**: Equipment, inventory, and material systems have unclear boundaries
- **Mixed patterns**: Three different repository patterns (class-based, functional, singleton)
- **Migration fragmentation**: Multiple vision migrations modifying same tables without clear versioning

To realign the project and maintain momentum, a structured cleanup is required.

## Objectives

1. **Eliminate architectural inconsistencies** and remove redundant code/files while preserving existing functionality
2. **Standardize multi-tenant terminology** and repository patterns across the codebase
3. **Consolidate overlapping domains** (equipment vs. inventory) into unified models
4. **Ensure database schema alignment** by applying all migrations and automating future migration checks
5. **Provide clear guidance** for AI agents and developers through consolidated documentation

## Scope

This project addresses refactoring, migration and documentation tasks. It does not introduce new business features. Workstreams may run concurrently where dependencies permit, and effort estimates are expressed in prompts, tokens and lines of code (LoC).

## Key Issues and Solutions

| Issue | Evidence | Solution | Priority |
|-------|----------|----------|----------|
| Tenancy inconsistency | 50+ files use `tenant_id`, 50+ use `company_id`; some tables have both; RLS policies mix approaches | Standardize on `tenant_id`; migrate columns; update code, RLS policies and docs | **HIGH** |
| Duplicate container repositories | Class-based (equipment) and functional (inventory) implementations exist | Adopt equipment repository, port missing features, delete duplicate | **HIGH** |
| Overlapping equipment/inventory/material systems | Three parallel systems with unclear boundaries | Merge into unified inventory table with category/tracking enums | **MEDIUM** |
| Mixed repository patterns | Class-based (majority), functional (legacy), singleton instances | Convert all to class-based pattern with dependency injection | **MEDIUM** |
| Unapplied/fragmented migrations | Vision migrations 040-044 exist but status unclear; multiple files modify same tables | Consolidate migrations; apply missing ones; automate verification | **HIGH** |
| Documentation fragmentation | Session summaries clutter docs; no ADRs; outdated blueprints | Reorganize docs hierarchy; archive old content; create ADRs | **LOW** |

## Workstreams and Tasks

### Workstream 1 – Tenancy Standardization (HIGH PRIORITY)

**Effort estimate**: 8-10 prompts (~1,800 tokens) for migration scripts and code refactoring  
**LoC impact**: ~180 lines for migrations, ~150-200 lines of code changes across repositories  
**Dependencies**: None - can start immediately

**Tasks**:
1. **T1.1** - Create comprehensive inventory of all `company_id` references using AST analysis
2. **T1.2** - Generate SQL migration to rename `company_id` to `tenant_id` with:
   - Backup of affected tables
   - Column renames with constraint preservation
   - RLS policy updates in same transaction
   - Rollback script
3. **T1.3** - Update all TypeScript interfaces and types from `companyId` to `tenantId`
4. **T1.4** - Refactor all repository methods to use `tenantId` consistently
5. **T1.5** - Update all RLS policies to use `tenant_id` column and JWT claim consistently
6. **T1.6** - Create ESLint rule to prevent future use of `company_id`
7. **T1.7** - Update TENANCY.md to reflect completed standardization

**Validation**: Run `grep -r "company_id\|companyId" src/` should return only historical comments

### Workstream 2 – Repository Consolidation & Domain Cleanup (HIGH PRIORITY)

**Effort estimate**: 10-12 prompts (~2,200 tokens)  
**LoC impact**: Remove ~400 lines of duplicate code; consolidate to ~250 lines  
**Dependencies**: Can run parallel to W1

**Tasks**:
1. **T2.1** - Audit all container-related code across domains
2. **T2.2** - Port any unique methods from inventory container repo to equipment container repo
3. **T2.3** - Update all imports from inventory container repo to equipment version
4. **T2.4** - Delete `src/domains/inventory/repositories/container-assignments.repository.ts`
5. **T2.5** - Design unified `inventory_items` schema with:
   ```sql
   item_category ENUM ('equipment', 'material', 'consumable', 'tool')
   tracking_mode ENUM ('serial', 'quantity', 'batch')
   ```
6. **T2.6** - Create migration to consolidate equipment and inventory tables
7. **T2.7** - Refactor services to use unified inventory model
8. **T2.8** - Update vision domain references to use new structure

### Workstream 3 – Repository Pattern Standardization (MEDIUM PRIORITY)

**Effort estimate**: 7 prompts (~1,050 tokens) - one per functional repository  
**LoC impact**: ~1,400 lines refactored (no net change)  
**Dependencies**: Should complete W1 first for consistency

**Tasks**:
1. **T3.1** - Create standardized BaseRepository template with:
   - Constructor dependency injection
   - Consistent error handling
   - Tenant isolation built-in
   - TypeScript generics for type safety
2. **T3.2** - Convert vision repositories from functional to class-based
3. **T3.3** - Convert inventory repositories from functional to class-based
4. **T3.4** - Convert singleton repositories to proper DI pattern
5. **T3.5** - Standardize directory structure:
   - Rename all `repos/` to `repositories/`
   - Ensure all services are under `services/`
6. **T3.6** - Create domain index files for clean exports
7. **T3.7** - Update all imports to use new structure

### Workstream 4 – Migration Alignment & CI/CD (HIGH PRIORITY)

**Effort estimate**: 4-5 prompts (~800 tokens)  
**LoC impact**: ~140 lines for scripts and CI config  
**Dependencies**: Needs database access

**Tasks**:
1. **T4.1** - Consolidate vision migrations 040-044 into single comprehensive migration
2. **T4.2** - Apply all missing migrations using Supabase RPC method
3. **T4.3** - Create `scripts/verify-schema-alignment.ts` that:
   - Queries information_schema
   - Compares with migration files
   - Reports discrepancies
   - Exits with error code for CI
4. **T4.4** - Add schema verification to CI pipeline (GitHub Actions)
5. **T4.5** - Create `scripts/auto-apply-migrations.ts` for development
6. **T4.6** - Document migration process in CLAUDE.md

### Workstream 5 – Documentation Reorganization (LOW PRIORITY)

**Effort estimate**: 5-6 prompts (~1,000 tokens)  
**LoC impact**: ~500 lines of documentation  
**Dependencies**: Best done after other workstreams for accuracy

**Tasks**:
1. **T5.1** - Archive session summaries to `docs/archive/sessions/`
2. **T5.2** - Create `docs/architecture/decisions/` for ADRs
3. **T5.3** - Update AGENTS.md with:
   - New repository patterns
   - Unified inventory model
   - Tenancy standards
   - Common pitfalls and solutions
4. **T5.4** - Consolidate README.md to reference key docs
5. **T5.5** - Update TENANCY.md to reflect completed migration
6. **T5.6** - Create `TECHNICAL_DEBT.md` for tracking future issues
7. **T5.7** - Reorganize docs structure:
   ```
   docs/
   ├── architecture/
   │   ├── overview.md
   │   ├── decisions/
   │   └── patterns/
   ├── domains/
   │   ├── inventory/
   │   ├── vision/
   │   └── ...
   ├── guides/
   │   ├── development/
   │   ├── deployment/
   │   └── testing/
   └── archive/
   ```

## Opportunities for Parallel Development

1. **W1 (Tenancy) and W2 (Repository Consolidation)** can run fully in parallel
2. **W3 (Pattern Standardization)** can start after base template from T3.1 is created
3. **W4 (Migration Alignment)** can run independently once database access is available
4. **W5 (Documentation)** can begin immediately with structure setup, refined as code changes

## Implementation Order Recommendation

**Phase 1 (Critical - Week 1)**:
- W1: Tenancy Standardization (prevents further divergence)
- W4: Migration Alignment (ensures database consistency)
- W2: Repository Consolidation (reduces confusion)

**Phase 2 (Important - Week 2)**:
- W3: Repository Pattern Standardization (improves maintainability)
- W5: Documentation Reorganization (captures changes)

## Deliverables & Acceptance Criteria

### Required Deliverables:
1. ✅ Migration scripts standardizing all tables to use `tenant_id`
2. ✅ Unified container repository with duplicates removed
3. ✅ Consolidated inventory model replacing equipment/material separation
4. ✅ All repositories following class-based pattern
5. ✅ CI pipeline with automatic migration verification
6. ✅ Updated documentation suite (README, TENANCY.md, AGENTS.md)
7. ✅ ESLint rules preventing deprecated patterns

### Acceptance Criteria:
- [ ] `grep -r "company_id" src/` returns no active code references
- [ ] Only one container repository exists in codebase
- [ ] All repositories extend BaseRepository class
- [ ] `npm run verify:schema` passes in CI
- [ ] All existing tests pass without modification
- [ ] Coverage remains ≥80%
- [ ] No new TypeScript errors introduced
- [ ] Documentation reflects actual implementation

## Risk Mitigation

1. **Data Loss Risk**: Create full database backup before migrations
2. **Breaking Changes**: Run all changes in staging environment first
3. **Test Coverage**: Ensure all refactored code has equivalent test coverage
4. **Rollback Plan**: Keep rollback scripts for all migrations
5. **Communication**: Alert team before major refactoring begins

## Success Metrics

- **Code Quality**: Reduction in duplicate code by ~40%
- **Consistency**: 100% of repositories follow single pattern
- **Clarity**: Single source of truth for each domain concept
- **Automation**: Zero manual migration steps required
- **Documentation**: All architectural decisions captured in ADRs

## Notes for AI Agents

When executing this plan:
1. Always check current state before making changes
2. Run tests after each significant change
3. Commit changes in logical units with clear messages
4. Update documentation as you go, not at the end
5. Use the Supabase RPC method for all database changes
6. Verify changes against acceptance criteria before marking complete

This cleanup project will establish a solid foundation for JobEye's continued evolution while maintaining the flexibility needed for rapid feature development.