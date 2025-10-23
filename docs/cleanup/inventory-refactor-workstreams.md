/*
AGENT DIRECTIVE BLOCK
file: /docs/cleanup/inventory-refactor-workstreams.md
phase: 0
domain: inventory
purpose: Break the inventory lifecycle vision into actionable workstreams
spec_ref: docs/cleanup/inventory-refactor-future-plan.md
complexity_budget: 60
dependencies:
  internal:
    - /docs/cleanup/inventory-refactor-future-plan.md
voice_considerations:
  - Voice intents will trigger several workstream deliveries; note where confirmation images are needed
*/

# Inventory Management Refactor – Proposed Workstreams

This document decomposes the long-term inventory lifecycle vision into focused workstreams so planning, execution, and verification can happen incrementally.

---

## Workstream 1 – Data Model & Schema Foundation

**Objective**: Introduce the tables and enums needed to support reservations, location-aware movements, media evidence, and supply/demand planning.

**Key Deliverables**
- `inventory_locations`, `inventory_location_hierarchy`
- `inventory_transactions` with transaction_type enum (`reserve`, `release`, `load`, `transfer`, `consume`, `return`, `adjust`) and location columns
- `inventory_allocations` to track reservations per job/task/automation rule
- `purchase_orders`, `purchase_order_lines` (or extend existing table if available)
- `inventory_media` to associate images/inspection notes with transactions
- Safety stock & reorder configuration per item/location

**Dependencies**: Align with existing `items` table; ensure compatibility with Supabase RLS strategy.

**Proof of Completion**: ERD + migrations + generated types + database documentation updates.

---

## Workstream 2 – Service & API Layer

**Objective**: Refactor supervisor, crew, and automation-facing services to use the new schema while honoring image-first confirmations.

**Key Deliverables**
- Reservation API (`POST /jobs/:id/allocations`) decoupled from physical movement
- Movement APIs that accept intent (voice/autopilot) and require image evidence to finalize (`/movements/confirm`)
- Consumption & return endpoints tied to job/task completion events
- Purchase order receiving endpoints with photo capture
- Background reconciliation service to ensure transactions + allocations stay balanced

**Dependencies**: Workstream 1 schema availability; decision on auth/role enforcement for new endpoints.

**Proof of Completion**: Updated TypeScript services, unit/integration tests, revised API docs.

---

## Workstream 3 – Vision & Voice Integration

**Objective**: Upgrade the recognition pipeline so images drive transactions, with voice/automation acting as triggers or assistants.

**Key Deliverables**
- Capture pipeline that attaches image metadata (timestamp, GPS, confidence scores) to `inventory_transactions`
- Mapping logic from VLM/YOLO detections → item IDs, quantities, locations (support manual override when ambiguous)
- Voice command flows that open the camera, capture context, and submit intents (`"Load fertilizer to Truck 12"` → prompts image, then confirms)
- Edge strategy for YOLO (later), but design pipeline compatibly now

**Dependencies**: Workstream 1 media schema; Workstream 2 confirmation endpoints.

**Proof of Completion**: Updated VLM workers, load screen integration tests, recognition accuracy telemetry.

---

## Workstream 4 – UI/UX Revamp

**Objective**: Deliver interfaces that expose reservations, on-hand vs. available quantities, and item timelines with photos.

**Key Deliverables**
- Supervisor allocation board (plan vs. actual)
- Crew load screen showing reservation state, expected source bin, and last-seen image
- Item detail timeline (receipt → storage → load → consume) with image carousel
- Reorder dashboard with supply/demand projections
- Mobile-first flows for quick capture and voice prompts

**Dependencies**: Workstreams 1–3 for data+API support.

**Proof of Completion**: Figma updates (if used), React components, usability feedback from pilot users.

---

## Workstream 5 – Migration, Backfill & Data Integrity

**Objective**: Transition from current `item_transactions` + `workflow_task_item_associations` into the new model without losing history.

**Key Deliverables**
- Scripts to infer reservations and movements from historical transactions & checklist data
- Dual-write/dual-read bridges during transition
- Validation reports (before/after counts, reconciliation summaries)
- Rollback plans and feature flags

**Dependencies**: Workstreams 1–2 defined; access to historical data.

**Proof of Completion**: Backfill scripts committed, migration playbook documented, sanity tests green.

---

## Workstream 6 – Telemetry, Analytics & Governance

**Objective**: Provide insight into shrinkage, SLA adherence, recognition accuracy, and compliance.

**Key Deliverables**
- Metrics pipeline (turnover, inventory aging, recognition confidence distribution)
- Alerting for anomalies (unconfirmed moves, missing photos, low confidence)
- Audit views combining transactions, images, voice transcripts (if retained)
- Documentation of SOPs for small rural service teams

**Dependencies**: Workstreams 1–4 for source data.

**Proof of Completion**: Dashboards, alert rules, SOP docs, compliance checklist.

---

## Immediate Next Actions

1. Convert helper scripts (e.g., `scripts/inventory/query-job-items.mjs`) into a lightweight toolkit for validating transaction state during the transition.
2. Draft discovery questions and assumptions for Workstream 1 (since you’re the current stakeholder).
3. Prioritize workstreams (likely 1 → 2 → 3/4 in parallel once schema stabilizes).
4. Start capturing current gaps (e.g., missing location IDs, lack of image metadata) to feed into Workstream 1 requirements.
