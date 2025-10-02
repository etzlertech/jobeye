# Tasks: Codebase Redundancy Analysis and Cleanup

**Input**: Design documents from `/specs/008-evaluate-entire/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `tools/redundancy-analyzer/` per plan.md
- All paths relative to repository root

## Phase 3.1: Setup
- [x] T001 Create project structure at tools/redundancy-analyzer/ with src/, tests/, reports/ directories
- [x] T002 Initialize TypeScript project with package.json, tsconfig.json, and dependencies (@typescript-eslint/parser, ts-morph, @babel/parser, glob, @supabase/supabase-js, commander, chalk)
- [x] T003 [P] Configure ESLint and Prettier for TypeScript code quality
- [x] T004 [P] Set up Jest configuration for unit and integration tests
- [x] T005 [P] Create .gitignore for node_modules, dist, reports/*.md

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T006 [P] Contract test for POST /analyze endpoint in tools/redundancy-analyzer/tests/contract/analyze-endpoint.test.ts
- [x] T007 [P] Contract test for GET /analyze/{id}/status endpoint in tools/redundancy-analyzer/tests/contract/status-endpoint.test.ts
- [x] T008 [P] Contract test for GET /analyze/{id}/report endpoint in tools/redundancy-analyzer/tests/contract/report-endpoint.test.ts
- [x] T009 [P] Integration test for duplicate repository detection scenario in tools/redundancy-analyzer/tests/integration/duplicate-repos.test.ts
- [x] T010 [P] Integration test for abandoned database tables scenario in tools/redundancy-analyzer/tests/integration/abandoned-tables.test.ts
- [x] T011 [P] Integration test for end-to-end analysis workflow in tools/redundancy-analyzer/tests/integration/full-analysis.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
### Models
- [x] T012 [P] RedundancyFinding model in tools/redundancy-analyzer/src/models/redundancy.model.ts
- [x] T013 [P] CodeModule model in tools/redundancy-analyzer/src/models/code-module.model.ts
- [x] T014 [P] DatabaseTableMapping model in tools/redundancy-analyzer/src/models/database-table-mapping.model.ts
- [x] T015 [P] AnalysisReport model in tools/redundancy-analyzer/src/models/analysis-report.model.ts

### Services
- [x] T016 [P] AST parser service using ts-morph in tools/redundancy-analyzer/src/services/ast-parser.service.ts
- [x] T017 Similarity detector service with 70% threshold in tools/redundancy-analyzer/src/services/similarity-detector.service.ts (depends on T016)
- [x] T018 [P] Database mapper service using Supabase client in tools/redundancy-analyzer/src/services/database-mapper.service.ts
- [x] T019 Report generator service for Markdown output in tools/redundancy-analyzer/src/services/report-generator.service.ts (depends on T015)

### Library Functions
- [ ] T020 [P] File scanner with glob patterns in tools/redundancy-analyzer/src/lib/file-scanner.ts
- [ ] T021 [P] Metrics calculator for impact scoring in tools/redundancy-analyzer/src/lib/metrics-calculator.ts

### CLI Implementation
- [ ] T022 Main CLI entry point with commander in tools/redundancy-analyzer/src/cli/analyze.ts
- [ ] T023 Progress tracking and status display in tools/redundancy-analyzer/src/cli/progress.ts (depends on T022)
- [ ] T024 Report output handler in tools/redundancy-analyzer/src/cli/output.ts (depends on T022)

## Phase 3.4: Integration
- [ ] T025 Connect database mapper to live Supabase instance (depends on T018)
- [ ] T026 Wire up all services in main analysis orchestrator (depends on T016-T019)
- [ ] T027 Implement memory-efficient file streaming for large codebases (depends on T020)
- [ ] T028 Add comprehensive error handling and recovery
- [ ] T029 Implement analysis state persistence for resumable operations

## Phase 3.5: Polish
- [ ] T030 [P] Unit tests for AST parser service in tools/redundancy-analyzer/tests/unit/ast-parser.test.ts
- [ ] T031 [P] Unit tests for similarity detector in tools/redundancy-analyzer/tests/unit/similarity-detector.test.ts
- [ ] T032 [P] Unit tests for metrics calculator in tools/redundancy-analyzer/tests/unit/metrics-calculator.test.ts
- [ ] T033 Performance optimization for >100k file codebases
- [ ] T034 [P] Create README.md with installation and usage instructions
- [ ] T035 [P] Generate API documentation from TypeScript interfaces
- [ ] T036 Manual testing following quickstart.md scenarios

## Dependencies
- Setup (T001-T005) blocks all other tasks
- Tests (T006-T011) before implementation (T012-T029)
- Models (T012-T015) can run in parallel
- T016 (AST parser) blocks T017 (similarity detector)
- T015 (AnalysisReport model) blocks T019 (report generator)
- T022 (CLI entry) blocks T023-T024 (CLI features)
- All services (T016-T019) block T026 (orchestrator)
- Implementation complete before polish (T030-T036)

## Parallel Execution Examples

### Launch all contract tests together:
```
Task: "Contract test for POST /analyze endpoint in tools/redundancy-analyzer/tests/contract/analyze-endpoint.test.ts"
Task: "Contract test for GET /analyze/{id}/status endpoint in tools/redundancy-analyzer/tests/contract/status-endpoint.test.ts"
Task: "Contract test for GET /analyze/{id}/report endpoint in tools/redundancy-analyzer/tests/contract/report-endpoint.test.ts"
```

### Launch all models together:
```
Task: "RedundancyFinding model in tools/redundancy-analyzer/src/models/redundancy.model.ts"
Task: "CodeModule model in tools/redundancy-analyzer/src/models/code-module.model.ts"
Task: "DatabaseTableMapping model in tools/redundancy-analyzer/src/models/database-table-mapping.model.ts"
Task: "AnalysisReport model in tools/redundancy-analyzer/src/models/analysis-report.model.ts"
```

### Launch independent services:
```
Task: "AST parser service using ts-morph in tools/redundancy-analyzer/src/services/ast-parser.service.ts"
Task: "Database mapper service using Supabase client in tools/redundancy-analyzer/src/services/database-mapper.service.ts"
Task: "File scanner with glob patterns in tools/redundancy-analyzer/src/lib/file-scanner.ts"
Task: "Metrics calculator for impact scoring in tools/redundancy-analyzer/src/lib/metrics-calculator.ts"
```

## Notes
- All [P] tasks operate on different files with no shared dependencies
- Contract tests must verify request/response schemas match OpenAPI spec
- Integration tests should use mock data to simulate real analysis scenarios
- Supabase connection requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Report output goes to reports/ directory with timestamp
- CLI should support both programmatic and interactive usage

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - analyzer-api.yaml → 3 contract test tasks (T006-T008)
   - Each endpoint → corresponding implementation task
   
2. **From Data Model**:
   - 4 entities → 4 model creation tasks (T012-T015)
   - Relationships → service layer tasks (T016-T019)
   
3. **From User Stories**:
   - Duplicate repository scenario → integration test (T009)
   - Abandoned tables scenario → integration test (T010)
   - Quickstart scenarios → validation tasks (T036)

4. **Ordering**:
   - Setup → Tests → Models → Services → CLI → Integration → Polish
   - Dependencies prevent parallel execution where files are shared

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (3 endpoints → 3 test files)
- [x] All entities have model tasks (4 entities → 4 model files)
- [x] All tests come before implementation (T006-T011 before T012-T029)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task