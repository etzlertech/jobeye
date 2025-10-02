
# Implementation Plan: Codebase Redundancy Analysis and Cleanup

**Branch**: `008-evaluate-entire` | **Date**: 2025-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-evaluate-entire/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Analyze the entire JobEye codebase to identify and document redundant code, overlapping implementations, and disconnected features. Generate a comprehensive Markdown report showing duplicate functionality across domains, unused database tables, and provide actionable recommendations for code consolidation. The analysis will use automated tooling to scan all code types and database schemas, prioritizing thoroughness over speed.

## Technical Context
**Language/Version**: TypeScript 5.x / Node.js 18+  
**Primary Dependencies**: @typescript-eslint/parser, ts-morph, @babel/parser, glob  
**Storage**: File system (reports), Supabase (database schema analysis)  
**Testing**: Jest for unit tests  
**Target Platform**: CLI tool running on developer machines (Linux/Mac/Windows)
**Project Type**: single - CLI analysis tool  
**Performance Goals**: Complete analysis in reasonable time (no strict limit per clarifications)  
**Constraints**: Handle large codebases (100k+ files), respect memory limits, exclude standard directories  
**Scale/Scope**: Analyze ~105 database tables, ~500+ source files, multiple domains

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Since no specific constitution is defined for this project, using general best practices:
- ✅ Single responsibility: Tool has one clear purpose (redundancy analysis)
- ✅ CLI interface: Text in/out for reports and findings
- ✅ Testable: Analysis logic can be unit tested
- ✅ Simple approach: Direct AST parsing, no complex abstractions

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
tools/redundancy-analyzer/
├── src/
│   ├── models/
│   │   ├── redundancy.model.ts
│   │   ├── code-module.model.ts
│   │   └── analysis-report.model.ts
│   ├── services/
│   │   ├── ast-parser.service.ts
│   │   ├── similarity-detector.service.ts
│   │   ├── database-mapper.service.ts
│   │   └── report-generator.service.ts
│   ├── cli/
│   │   └── analyze.ts
│   └── lib/
│       ├── file-scanner.ts
│       └── metrics-calculator.ts
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/

reports/
└── redundancy-analysis-[timestamp].md
```

**Structure Decision**: Single project CLI tool in `tools/redundancy-analyzer/` directory, following the standard TypeScript project structure with clear separation of concerns between models, services, CLI interface, and supporting libraries.

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each entity in data model → model creation task [P]
- Each service → service implementation task
- CLI interface → command implementation task
- Each analysis type → dedicated analyzer task
- Report generation → formatter task
- Integration tests for end-to-end flow

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models → Services → CLI → Integration
- Mark [P] for parallel execution (independent files)
- Database analysis depends on connection setup

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**Key Task Categories**:
1. Setup and configuration (TypeScript, dependencies)
2. Model implementations (4-5 tasks)
3. Service implementations (5-6 tasks)  
4. CLI command structure (2-3 tasks)
5. Report generation (2-3 tasks)
6. Testing (4-5 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


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
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
