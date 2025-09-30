
# Implementation Plan: Voice & Vision Inventory Management

**Branch**: `004-voice-vision-inventory` | **Date**: 2025-09-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-voice-vision-inventory/spec.md`

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
Voice & Vision Inventory Management enables field technicians to manage inventory operations (adding items, check-in/out, purchases, transfers, audits) using camera + voice input. The system uses a hybrid YOLO + VLM detection pipeline with context-aware intent detection (GPS + scene analysis) to automatically infer transaction types. Key workflows include: (1) multi-item detection with auto-grouping and selective addition, (2) background object filtering with learning preferences, (3) OCR receipt processing, (4) container registration and tracking, (5) material usage logging, (6) maintenance issue detection, and (7) training data collection for continuous model improvement. Integrates with Feature 001 (Vision Kit Verification) for container definitions and Feature 003 (Scheduling) for job kit validation.

## Technical Context
**Language/Version**: TypeScript 5.4+ with strict mode enabled
**Primary Dependencies**:
  - Frontend: Next.js 14.2 (App Router), React 18.3, @tanstack/react-query 5.90
  - Vision: onnxruntime-web 1.23+ (YOLO inference), OpenAI SDK 5.23+ (VLM fallback)
  - Backend: @supabase/supabase-js 2.43+, @supabase/auth-helpers-nextjs 0.10+
  - OCR: TBD (Tesseract.js vs Textract vs GPT-4 Vision) - requires research
  - Voice: TBD (existing voice domain integration) - requires research
**Storage**: Supabase (PostgreSQL 15+ with RLS, Supabase Storage for photos/crops)
**Testing**: Jest with @testing-library/react 16.3+, Playwright for E2E, custom RLS test harness
**Target Platform**: Web responsive (mobile-first design, iOS Safari 15+, Chrome Android 90+)
**Project Type**: Single Next.js application with domain-driven architecture (src/domains/{vision,inventory,voice,equipment,material})
**Performance Goals**:
  - YOLO detection: <3s on iPhone 12+ equivalent
  - VLM fallback: <10s with network
  - OCR extraction: <5s per receipt
  - Camera feed: 1fps processing
  - Crop generation: <5s for 20 items
**Constraints**:
  - Offline-capable: IndexedDB queue (50+ capacity, dynamic expansion)
  - Cost: <$0.05 avg per operation, $10/day VLM budget cap per company
  - Privacy: RLS enforced, photos encrypted, 1-year retention
  - Mobile UX: Four-zone TopHand layout, voice-first interactions
**Scale/Scope**: 50-200 photos/day per company, 500-2000 items total per company, 12 workflow categories, 105 functional requirements

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Multi-Tenant RLS Compliance
- All new tables MUST include `company_id UUID NOT NULL REFERENCES companies(id)`
- RLS policies MUST use `request.jwt.claims -> 'app_metadata' ->> 'company_id'`
- Status: **PASS** - Inventory entities follow existing pattern (verified in equipment/material tables)

### ✅ Hybrid Vision Pipeline Compliance
- YOLO local-first (1 fps, <1s inference, confidence 0.7 threshold)
- VLM fallback only when needed (<10% request rate target)
- Cost tracking: <$0.50 per job avg, $10/day cap per company
- Status: **PASS** - Aligns with Feature 001 architecture (CONFIDENCE_THRESHOLD = 0.7, $10 daily budget)

### ✅ Voice-First UX Compliance
- Every UI action must have voice equivalent
- Offline IndexedDB queue with background sync
- Voice sessions maintain state
- Status: **PASS** - Feature extends existing voice patterns from equipment/material domains

### ✅ Cost Governance Compliance
- Daily VLM budget: $10/company (within $25 constitution limit)
- Per-request VLM: <$0.10 avg (within $0.25 limit)
- Cost tracking for all AI operations
- Status: **PASS** - Budget tighter than constitutional max

### ✅ Development Standards Compliance
- Agent directive blocks required
- Complexity budget: 300 LoC default, 500 max
- Test coverage: ≥80%
- Repository pattern for all DB access
- Status: **PASS** - Will follow existing domain patterns

### ✅ Database Precheck Compliance (RULE 1)
- MUST inspect actual DB state before migrations using `scripts/check-actual-db.ts`
- Use idempotent single-statement migrations (CREATE IF NOT EXISTS)
- NEVER assume state from migration files
- Status: **ACKNOWLEDGED** - Will verify actual schema before Phase 1 migrations

### ✅ Git Push Compliance (RULE 2)
- Push immediately after every commit
- Inform user of push status
- Status: **ACKNOWLEDGED** - Will follow push protocol

**GATE RESULT**: ✅ PASS - No constitutional violations. Proceed to Phase 0.

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
src/
├── domains/
│   ├── inventory/           # Existing domain - EXTEND
│   │   ├── types/          # Add new transaction types
│   │   ├── repositories/   # Add container, transaction repos
│   │   ├── services/       # Add multi-workflow services
│   │   └── __tests__/
│   ├── vision/             # Existing domain - EXTEND
│   │   ├── lib/            # Reuse yolo-inference, vlm-fallback-router
│   │   ├── services/       # Add OCR service, crop generation
│   │   └── __tests__/
│   ├── voice/              # Existing domain - INTEGRATE
│   │   └── services/       # Extend for attribute extraction
│   ├── equipment/          # Existing domain - INTEGRATE
│   │   └── types/          # Reference for equipment tracking
│   └── material/           # Existing domain - INTEGRATE
│       └── types/          # Reference for material tracking
├── app/
│   └── api/
│       ├── inventory/      # NEW: CRUD endpoints
│       ├── containers/     # NEW: Container management endpoints
│       └── transactions/   # NEW: Check-in/out/transfer endpoints
└── components/
    └── inventory/          # NEW: Mobile-first UI components

tests/
├── integration/
│   ├── inventory-rls.test.ts    # NEW: RLS isolation tests
│   └── offline-sync.test.ts     # NEW: IndexedDB queue tests
└── e2e/
    └── inventory-workflows.spec.ts  # NEW: E2E scenarios

supabase/
└── migrations/
    └── 050_inventory_vision_extend.sql  # NEW: Schema extension
```

**Structure Decision**: Single Next.js project with domain-driven architecture. This feature **extends** existing inventory, vision, and voice domains rather than creating new ones. New code will:
- Add types/repositories/services to `/src/domains/inventory/` for transactions, containers, training data
- Add OCR and crop services to `/src/domains/vision/services/`
- Add API routes to `/src/app/api/inventory/`, `/src/app/api/containers/`, `/src/app/api/transactions/`
- Add mobile-first React components to `/src/components/inventory/`
- Add migration files to `/supabase/migrations/` following naming convention `050_inventory_vision_extend.sql`

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
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

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
- [x] Phase 0: Research complete (/plan command) - 2025-09-29
- [x] Phase 1: Design complete (/plan command) - 2025-09-29
- [x] Phase 2: Task planning complete (/plan command - approach described below)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS - 2025-09-29
- [x] Post-Design Constitution Check: PASS - 2025-09-29 (no violations after design)
- [x] All NEEDS CLARIFICATION resolved - 2025-09-29 (13 clarifications in spec.md)
- [x] Complexity deviations documented - N/A (no deviations needed)

**Artifacts Generated**:
- [x] research.md - 5 research questions resolved (OCR, YOLO, Voice-LLM, IndexedDB, Crop Generation)
- [x] data-model.md - 10 entities defined with RLS policies, triggers, JSONB schemas
- [x] contracts/inventory-detection.yaml - Detection + selection endpoints
- [x] contracts/inventory-transactions.yaml - Check-in/out, transfer, audit, material-usage endpoints
- [x] quickstart.md - 7 manual test scenarios with SQL verification

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
