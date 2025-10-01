
# Implementation Plan: Mobile PWA Vision UI

**Branch**: `006-mobile-pwa-ui` | **Date**: 2025-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-mobile-pwa-ui/spec.md`

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
Build a mobile PWA UI that leverages existing YOLO vision detection (1fps) and VLM cloud fallback for real-time equipment verification. Field technicians point their camera at truck bed, system detects equipment automatically, marks checklist items as verified, and creates timestamped proof of loading. Fully offline-capable with 200-record queue, 30-day data retention, fallback to manual checklist when camera unavailable.

## Technical Context
**Language/Version**: TypeScript 5.x, React 18, Next.js 14 (existing stack)
**Primary Dependencies**:
- Existing: YOLO inference engine (Feature 001), VLM fallback service (Feature 001), Offline queue (Feature 007)
- New: MediaDevices API, IndexedDB, Web Workers for 1fps throttling
**Storage**: IndexedDB (offline queue 200 records), Supabase (verification records 30-day retention)
**Testing**: Jest (unit), Playwright (E2E camera workflows)
**Target Platform**: Mobile browsers (iOS Safari 14+, Chrome Android 90+), PWA installable
**Project Type**: web (mobile-first PWA UI + existing backend services)
**Performance Goals**:
- Camera load <2s
- On-device detection <1s per frame
- Full verification workflow <30s
- 1fps YOLO processing (battery optimized)
**Constraints**:
- Offline-first (full functionality without network)
- 200 verification record queue (FIFO eviction)
- 30-day auto-delete retention
- Camera fallback to manual checklist
**Scale/Scope**: 1 mobile screen, reuses 5 existing vision services, ~2,500 LOC new code (5 components @200 each, 4 hooks @350 avg, 1 service @500, 1 page @200, 1 worker @300, 1 repo extension @50)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (no constitution defined - using JobEye project patterns)

**Project Patterns Followed**:
- **Reuse Existing**: Leverages tested YOLO (Feature 001), VLM (Feature 001), Offline queue (Feature 007)
- **Component-Based**: React components in `src/app/mobile/equipment-verification/`
- **Repository Pattern**: Uses existing vision repositories, no new data layer needed
- **Test Coverage**: E2E camera workflows, unit tests for UI logic
- **Mobile-First**: PWA approach aligns with offline-first architecture

**Complexity Justified**:
- New code minimal (~500 LOC UI only)
- All complex vision logic already exists and tested
- Integration point: wire existing services to new mobile UI

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
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->
```
# Mobile PWA UI (extends existing web app)
src/app/mobile/equipment-verification/
├── page.tsx                          # Main equipment verification screen
├── components/
│   ├── CameraFeed.tsx               # Live camera with 1fps YOLO overlay
│   ├── EquipmentChecklist.tsx       # Auto-updating checklist UI
│   ├── DetectionOverlay.tsx         # Visual indicators for detected items
│   ├── ManualChecklistFallback.tsx  # Tap-to-verify when camera unavailable
│   └── OfflineQueueStatus.tsx       # 200-record queue indicator
├── hooks/
│   ├── useCameraPermissions.ts      # Camera access handling
│   ├── useYOLODetection.ts          # 1fps throttled detection
│   ├── useVLMFallback.ts            # Cloud fallback on low confidence
│   └── useVerificationSession.ts    # Session lifecycle management
└── services/
    └── verification-workflow.service.ts  # Orchestrates existing services

# Reused existing services (no changes)
src/domains/vision/
├── services/
│   ├── yolo-inference.service.ts    # Feature 001 (existing)
│   ├── vlm-fallback.service.ts      # Feature 001 (existing)
│   └── cost-tracking.service.ts     # Feature 001 (existing)
└── repositories/
    └── vision-verification.repository.ts  # Feature 001 (existing)

src/domains/mobile-pwa/
├── services/
│   └── offline-sync.service.ts      # Feature 007 (existing)
└── repositories/
    └── offline-queue.repository.ts  # Feature 007 (existing, extend for 200 limit)

# Tests
src/app/mobile/equipment-verification/__tests__/
├── camera-permissions.test.tsx
├── detection-workflow.test.tsx
├── offline-queue.test.tsx
└── e2e/
    └── equipment-verification-flow.spec.ts  # Playwright E2E
```

**Structure Decision**: Web application extending existing Next.js mobile PWA structure. New UI components in `src/app/mobile/equipment-verification/` integrate with existing vision services from Feature 001 (YOLO, VLM) and offline infrastructure from Feature 007. Zero new backend code - pure frontend integration layer.

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
- [x] Complexity deviations documented (none - minimal new code)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
