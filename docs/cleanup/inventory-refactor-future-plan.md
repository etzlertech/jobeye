/*
AGENT DIRECTIVE BLOCK
file: /docs/cleanup/inventory-refactor-future-plan.md
phase: 0
domain: inventory
purpose: Capture long-term inventory tracking requirements prior to detailed refactor planning
spec_ref: docs/unified-inventory-schema-design.md
complexity_budget: 40
dependencies:
  internal:
    - /docs/unified-inventory-schema-design.md
    - /docs/cleanup/root-docs-inventory.csv
voice_considerations:
  - Inventory moves can be initiated via voice; image capture should confirm execution
*/

# Inventory Lifecycle Vision – Draft Planning Notes

## Strategic Outcomes

- **Single-Item Traceability**: Every `item_id` must carry a full lifecycle record that spans purchase, storage, transit, job consumption, and return/reuse.
- **Real-Time Availability Awareness**: Distinguish clearly between on-hand quantity, reserved/allocated quantity, safety stock and true available-to-load quantity so planners can promise jobs confidently.
- **Location Fidelity**: Record physical location transitions (warehouse bin → vehicle → jobsite → return) with timestamps and responsible actors.
- **Quality & Evidence Trail**: Attach imagery or inspection metadata at each hand-off (receipt, storage, load, utilization) so auditors can verify condition and compliance.
- **Supply/Demand Projections**: Tie inbound supply (POs, online orders) and anticipated demand (scheduled jobs, automation forecasts) to each SKU so exception handling and re-order signals are automated.
- **Image-First Interaction**: Treat imagery + VLM/YOLO recognition as the primary capture mechanism for moves, supported by optional barcode/manual fallback. Voice commands or automation may propose actions, but an image should confirm each change.

## Core Capabilities To Model

1. **Inbound Supply Tracking**
   - Link purchase orders / vendor shipments to `item_id` batches.
   - Expected arrival dates, quantities, and receiving locations captured pre-receipt.
   - Support partial receipts and over/short reporting.

2. **Physical Inventory State**
   - Maintain `quantity_on_hand` per location (bin, yard pallet, vehicle compartment, job locker).
   - Model serialized vs. quantity-tracked items uniformly using a location-led ledger.
   - Support safety stock thresholds and reorder points per location & tenant.

3. **Allocation & Reservation Layer**
   - Separate reservation (`allocated_to_job`, `reserved_for_work_order`) from physical movement.
   - Allow automation rules (e.g., kit templates) to create reservations ahead of scheduling.
   - Track “anticipated demand” for forecasting (jobs in planning stage, predictive rules).

4. **Movement & Consumption Ledger**
   - Normalize transaction types: `reserve`, `release`, `load`, `transfer`, `consume`, `return`, `adjust`.
   - Every transaction records `from_location`, `to_location`, responsible user, timestamp, quantity, and optional media evidence.
   - Consumption should integrate with job costing and task completion events.

5. **Imaging & Quality Attachments**
   - Require or encourage photo/document capture on key events (receipt, storage audit, loading, job verification).
   - Store metadata for “last seen”, “condition rating”, “inspection notes”.
   - Enable quick audits from the UI (timeline per item).

6. **Vision-Driven Interaction Layer**
   - Support inventory actions initiated by human voice, scheduled automations, or manual UI—but require image capture at the actual movement point for verification.
   - Build an inference pipeline (VLM today, YOLO/local edge later) that identifies items, counts, and context (location markers) from each photo.
   - Maintain a “last seen” feed that ties each item/location state to the most recent image + recognition confidence, enabling auditors to replay movements.

7. **Forecasting & Replenishment**
   - Aggregate inbound vs. outbound commitments to compute **Available-To-Promise** by date.
   - Surface reorder alerts when projected available drops below safety stock before next confirmed supply.
   - Support manual overrides and vendor lead-time adjustments.

## High-Level Implementation Roadmap (Pre-Refactor)

1. **Discovery & Data Audit**
   - Catalogue current tables (`items`, `item_transactions`, `workflow_task_item_associations`, planned allocation tables).
   - Identify gaps: missing purchase order schema, absent location hierarchy, lack of transaction type coverage, no media linkage.
   - As sole stakeholder, synthesize target scenarios for small rural service teams; later, validate with beta users to confirm assumptions.

2. **Domain Model Redesign**
   - Draft ERD covering: `item_master`, `item_locations`, `inventory_transactions`, `item_allocations`, `purchase_orders`, `location_hierarchy`, `media_assets`.
   - Define enums / status fields for transaction types, allocation states, quality grades.
   - Align with existing docs (`docs/unified-inventory-schema-design.md`) and extend where necessary.

3. **API & Service Contract Planning**
   - Outline CRUD / workflow endpoints: reservation, movement, consumption, PO receiving, reconciliation.
   - Define read models for planners (ATS dashboards), crews (load lists with location hints), supervisors (allocation monitors), finance (consumption cost).
   - Ensure every endpoint can be triggered by automation or voice intents but requires an accompanying image event to finalize state changes.

4. **UI/UX Vision**
   - Map journeys: inventory manager, crew lead, dispatcher, with emphasis on quick capture using mobile camera + minimal taps.
   - Plan views for: item timeline (with image carousel), location inventory, job allocation matrix, reorder board.
   - Provide voice-guided flows (“show me Truck 12 inventory”, “capture fertilizer loading”) that immediately open the camera and tag the resulting image.

5. **Migration & Backfill Strategy**
   - Plan migration path from legacy `checklist_items` + basic `item_transactions` to new schema.
   - Design scripts to backfill historical data into the new ledger with inferred states.
   - Stage feature flags to roll out reservation → load → consume lifecycle incrementally.

6. **Telemetry & Auditing**
   - Decide on metrics to capture (turnover, shrinkage, SLA on load completion, recognition accuracy).
   - Ensure every transaction is auditable with actor (human, automation rule, voice agent), timestamp, required image, and recognition confidence.

## Next Steps Before Detailed Refactor Plan

- Validate this vision internally, then with early adopters in rural service teams to capture additional states or compliance requirements.
- Review current technical debt (e.g., reliance on `item_transactions` for reservations) and prioritize interim fixes vs. full redesign.
- Produce detailed refactor plan after agreement: include workstreams for schema changes, service updates, UI rewrites, backfill scripts, and testing strategy.
